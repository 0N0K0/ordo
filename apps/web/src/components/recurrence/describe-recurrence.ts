import { parseDay, ruleValues, type Duration, type Recurrence, type RepetitionCase } from '@ordo/shared';
import type { RepetitionTimes } from './RepetitionEditor';
import * as fmt from '../../lib/format';

export const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ORDINALS = ['', '1er', '2e', '3e', '4e'];

/**
 * Nth weekday as text: "le 2e mardi", "le dernier vendredi".
 * @param {number} position 1 to 4, or -1 for the last one.
 * @param {number} weekday 1 (Monday) to 7.
 * @returns {string} Label.
 */
export function nthWeekday(position: number, weekday: number): string {
  return `le ${position === -1 ? 'dernier' : ORDINALS[position]} ${WEEKDAY_NAMES[weekday - 1]}`;
}

/**
 * Month after a day of it: "d’avril", "de mai".
 * @param {number} month 1 to 12.
 * @returns {string} Label.
 */
export function ofMonth(month: number): string {
  const name = MONTHS[month - 1];
  return /^[aeiou]/.test(name) ? `d’${name}` : `de ${name}`;
}
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Formats a YYYY-MM-DD date: "3 novembre 2026".
 * @param {string} date Calendar date.
 * @returns {string} Label.
 */
export function formatLongDate(date: string): string {
  return fmt.day(parseDay(date));
}

/**
 * Weekday of the month of a date, as text: "le 2e mardi", "le dernier vendredi".
 * @param {string} date Calendar date.
 * @returns {string} Label.
 */
export function weekdayOfMonth(date: string): string {
  const day = parseDay(date);
  const weekday = WEEKDAY_NAMES[(day.getUTCDay() + 6) % 7];
  const daysInMonth = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
  if (day.getUTCDate() + 7 > daysInMonth) return `le dernier ${weekday}`;
  return `le ${ORDINALS[Math.ceil(day.getUTCDate() / 7)]} ${weekday}`;
}

/**
 * Day and month of a date: "4 avril".
 * @param {string} date Calendar date.
 * @returns {string} Label.
 */
export function formatDayMonth(date: string): string {
  const day = parseDay(date);
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}

/**
 * Month of a date after a day of it: "d’avril", "de mai".
 * @param {string} date Calendar date.
 * @returns {string} Label.
 */
export function monthOf(date: string): string {
  const month = MONTHS[parseDay(date).getUTCMonth()];
  return /^[aeiou]/.test(month) ? `d’${month}` : `de ${month}`;
}

/**
 * Readable repetition: "Toutes les 2 semaines le lundi et le jeudi, jusqu’au 20 décembre 2026".
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {boolean} [weekdays] Weekdays told (weekly rules). Optional. Default = true.
 * @returns {string} Description.
 */
export function describeRecurrence(rule: Recurrence, start: string, weekdays = true): string {
  const values = ruleValues(rule, start);
  const n = rule.interval;
  let text: string;
  switch (rule.frequency) {
    case 'DAILY':
      text = n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
      break;
    case 'WEEKLY': {
      const days = (rule.weekdays.length ? rule.weekdays : [values.weekday]).map((weekday) => WEEKDAY_NAMES[weekday - 1]);
      const list = days.length === 5 && !days.includes('samedi') && !days.includes('dimanche') ? 'du lundi au vendredi' : `le ${days.join(', le ')}`;
      const weeks = rule.weekParity ? `Les semaines ${rule.weekParity === 'EVEN' ? 'paires' : 'impaires'}` : n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`;
      text = weekdays ? `${weeks} ${list}` : weeks;
      break;
    }
    case 'MONTHLY':
      text = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} ${rule.monthlyMode === 'WEEKDAY' ? nthWeekday(values.position, values.weekday) : `le ${values.monthDay}`}`;
      break;
    case 'YEARLY':
      text = `${n === 1 ? 'Tous les ans' : `Tous les ${n} ans`} ${
        rule.monthlyMode === 'WEEK'
          ? `le ${WEEKDAY_NAMES[values.weekday - 1]} de la semaine ${values.week}`
          : rule.monthlyMode === 'WEEKDAY'
            ? `${nthWeekday(values.position, values.weekday)} ${ofMonth(values.month)}`
            : `le ${values.monthDay} ${MONTHS[values.month - 1]}`
      }`;
      break;
  }
  if (rule.until) text += `, jusqu’au ${formatLongDate(rule.until)}`;
  if (rule.count) text += `, ${rule.count} fois`;
  if (rule.pauses.length) text += ` (${rule.pauses.length} pause${rule.pauses.length > 1 ? 's' : ''})`;
  return text;
}

/**
 * How long each occurrence lasts, as text ("pendant 3 jours", "jusqu’au 20 août"); empty for a single day.
 * @param {Duration} duration Duration.
 * @returns {string} Label.
 */
export function describeDuration(duration: Duration): string {
  switch (duration.unit) {
    case 'DAYS':
      return duration.count > 1 ? `pendant ${duration.count} jours` : '';
    case 'WEEKS':
      return duration.count > 1 ? `pendant ${duration.count} semaines` : 'toute la semaine';
    case 'MONTHS':
      return duration.count > 1 ? `pendant ${duration.count} mois` : 'tout le mois';
    case 'TO_DAY':
      return `jusqu’au ${duration.day ?? ''}${duration.month ? ` ${MONTHS[duration.month - 1]}` : ''}`;
    case 'TO_WEEK':
      return `jusqu’à la semaine ${duration.week ?? ''}`;
    case 'TO_MONTH':
      return `jusqu’à fin ${duration.month ? MONTHS[duration.month - 1] : ''}`;
  }
}

/**
 * Text of a case: its period, rule, length and times ("Du 1 juin · Toutes les semaines le samedi · pendant 2 jours ·
 * 8:30–11:30").
 * @template T
 * @param {RepetitionCase<T>} item Case.
 * @param {string} start First day of what repeats.
 * @param {{ weekly?: boolean, times?: RepetitionTimes<T> }} [options] Weekdays told, times. Optional.
 * @returns {string} Text.
 */
export function describeCase<T>(item: RepetitionCase<T>, start: string, options: { weekly?: boolean; times?: RepetitionTimes<T> } = {}): string {
  const ruleStart = item.since && item.since > start ? item.since : start;
  const period = [item.since && `du ${fmt.dayShort(new Date(`${item.since}T00:00:00Z`))}`, item.until && `au ${fmt.dayShort(new Date(`${item.until}T00:00:00Z`))}`].filter(Boolean).join(' ');
  return [
    period && fmt.capitalize(period),
    item.rule ? describeRecurrence(item.rule, ruleStart, options.weekly !== false) : 'Ne se répète pas',
    item.rule?.duration ? describeDuration(item.rule.duration) : '',
    options.times?.describe(item.times, item.rule),
  ]
    .filter(Boolean)
    .join(' · ');
}
