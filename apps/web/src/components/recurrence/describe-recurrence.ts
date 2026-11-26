import {
  dayOfMonthText,
  LAST_DAY,
  lastDayWords,
  MONTH_LABELS,
  ofMonth,
  POSITION_LABELS,
  ruleValues,
  WEEK_PARITY_WORDS,
  WEEK_POSITION_LABELS,
  WEEKDAY_LABELS,
  type Duration,
  type Recurrence,
  type RepetitionCase,
  type WeekParity,
} from '@ordo/shared';
import type { RepetitionTimes } from './RepetitionEditor';
import * as fmt from '../../lib/format';
import { countOf } from '../../lib/text';

/**
 * Nth weekday as text: "le 2e mardi", "le dernier vendredi".
 * @param {number} position 1 to 4, or -1 for the last one.
 * @param {number} weekday 1 (Monday) to 7.
 * @returns {string} Label.
 */
function nthWeekday(position: number, weekday: number): string {
  return `le ${POSITION_LABELS[position]} ${WEEKDAY_LABELS[weekday - 1]}`;
}

/**
 * Weekday of the nth (or last) even or odd week of the month as text: « le mardi de la 1re semaine paire ».
 * @param {number} position 1 to 3, or -1 for the last one.
 * @param {number} weekday 1 (Monday) to 7.
 * @param {WeekParity} parity Parity of the week.
 * @returns {string} Label.
 */
function weekdayOfParityWeek(position: number, weekday: number, parity: WeekParity): string {
  return `le ${WEEKDAY_LABELS[weekday - 1]} de la ${WEEK_POSITION_LABELS[position]} semaine ${WEEK_PARITY_WORDS[parity]}`;
}

/**
 * Even or odd weeks of a weekly rule as text: « Les semaines paires », « Toutes les 2 semaines impaires ».
 * @param {WeekParity} parity Parity.
 * @param {number} every One week of that parity out of n.
 * @returns {string} Label.
 */
const parityWeeks = (parity: WeekParity, every: number): string => `${every === 1 ? 'Les' : `Toutes les ${every}`} semaines ${WEEK_PARITY_WORDS[parity]}s`;

/**
 * Day of the month of a monthly or yearly rule as text: « le 14 », « le 1er »; the last day: « le dernier jour du mois »
 * (monthly), « le dernier jour de février » (yearly, its month).
 * @param {number} monthDay Day number, or `LAST_DAY`.
 * @param {number | null} month Month of a yearly rule (1 to 12), null for a monthly one.
 * @returns {string} Label.
 */
function dayOfRule(monthDay: number, month: number | null): string {
  if (monthDay === LAST_DAY) return `le ${lastDayWords(month)}`;
  return `le ${dayOfMonthText(monthDay)}${month === null ? '' : ` ${MONTH_LABELS[month - 1]}`}`;
}

/**
 * Readable repetition: "Toutes les 2 semaines le lundi et le jeudi, jusqu’au 20 décembre 2026", « Toutes les 2 semaines
 * paires le lundi », « Le mardi de la 1re semaine paire de chaque mois ».
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
      const days = (rule.weekdays.length ? rule.weekdays : [values.weekday]).map((weekday) => WEEKDAY_LABELS[weekday - 1]);
      const list = days.length === 5 && !days.includes('samedi') && !days.includes('dimanche') ? 'du lundi au vendredi' : `le ${days.join(', le ')}`;
      const weeks = rule.weekParity ? parityWeeks(rule.weekParity, rule.parityInterval ?? 1) : n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`;
      text = weekdays ? `${weeks} ${list}` : weeks;
      break;
    }
    case 'MONTHLY':
      if (rule.monthlyMode === 'WEEKDAY' && rule.weekdayParity) {
        const day = weekdayOfParityWeek(values.position, values.weekday, rule.weekdayParity);
        text = n === 1 ? `${fmt.capitalize(day)} de chaque mois` : `Tous les ${n} mois ${day} du mois`;
        break;
      }
      text = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} ${rule.monthlyMode === 'WEEKDAY' ? nthWeekday(values.position, values.weekday) : dayOfRule(values.monthDay, null)}`;
      break;
    case 'YEARLY':
      text = `${n === 1 ? 'Tous les ans' : `Tous les ${n} ans`} ${
        rule.monthlyMode === 'WEEK'
          ? `le ${WEEKDAY_LABELS[values.weekday - 1]} de la semaine ${values.week}`
          : rule.monthlyMode === 'WEEKDAY'
            ? `${nthWeekday(values.position, values.weekday)} ${ofMonth(values.month)}`
            : dayOfRule(values.monthDay, values.month)
      }`;
      break;
  }
  if (rule.until) text += `, jusqu’au ${fmt.dayInWords(rule.until)}`;
  if (rule.count) text += `, ${rule.count} fois`;
  if (rule.pauses.length) text += ` (${countOf(rule.pauses.length, 'pause')})`;
  return text;
}

/**
 * How long each occurrence lasts, as text ("pendant 3 jours", "jusqu’au 20 août", "jusqu’au dernier jour du mois",
 * "jusqu’au dernier jour de février"); empty for a single day.
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
      if (duration.day === LAST_DAY) return `jusqu’au ${lastDayWords(duration.month)}`;
      return `jusqu’au ${duration.day ? dayOfMonthText(duration.day) : ''}${duration.month ? ` ${MONTH_LABELS[duration.month - 1]}` : ''}`;
    case 'TO_WEEK':
      return `jusqu’à la semaine ${duration.week ?? ''}`;
    case 'TO_MONTH':
      return `jusqu’à fin ${duration.month ? MONTH_LABELS[duration.month - 1] : ''}`;
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
  const period = [item.since && `du ${fmt.dayShort(item.since)}`, item.until && `au ${fmt.dayShort(item.until)}`].filter(Boolean).join(' ');
  return [
    period && fmt.capitalize(period),
    item.rule ? describeRecurrence(item.rule, ruleStart, options.weekly !== false) : 'Ne se répète pas',
    item.rule?.duration ? describeDuration(item.rule.duration) : '',
    options.times?.describe(item.times, item.rule),
  ]
    .filter(Boolean)
    .join(' · ');
}
