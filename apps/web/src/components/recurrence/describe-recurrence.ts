import { parseDay, type Recurrence } from '@ordo/shared';

export const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ORDINALS = ['', '1er', '2e', '3e', '4e'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Formats a YYYY-MM-DD date: "3 novembre 2026".
 * @param {string} date Calendar date.
 * @returns {string} Label.
 */
export function formatLongDate(date: string): string {
  return dateFormat.format(parseDay(date));
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
 * @returns {string} Description.
 */
export function describeRecurrence(rule: Recurrence, start: string): string {
  const day = parseDay(start);
  const n = rule.interval;
  let text: string;
  switch (rule.frequency) {
    case 'DAILY':
      text = n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
      break;
    case 'WEEKLY': {
      const days = (rule.weekdays.length ? rule.weekdays : [((day.getUTCDay() + 6) % 7) + 1]).map((weekday) => WEEKDAY_NAMES[weekday - 1]);
      const list = days.length === 5 && !days.includes('samedi') && !days.includes('dimanche') ? 'du lundi au vendredi' : `le ${days.join(', le ')}`;
      const weeks = rule.weekParity ? `Les semaines ${rule.weekParity === 'EVEN' ? 'paires' : 'impaires'}` : n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`;
      text = `${weeks} ${list}`;
      break;
    }
    case 'MONTHLY':
      text = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} ${rule.monthlyMode === 'WEEKDAY' ? weekdayOfMonth(start) : `le ${day.getUTCDate()}`}`;
      break;
    case 'YEARLY':
      text = `${n === 1 ? 'Tous les ans' : `Tous les ${n} ans`} ${rule.monthlyMode === 'WEEKDAY' ? `${weekdayOfMonth(start)} ${monthOf(start)}` : `le ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`}`;
      break;
  }
  if (rule.until) text += `, jusqu’au ${formatLongDate(rule.until)}`;
  if (rule.count) text += `, ${rule.count} fois`;
  if (rule.pauses.length) text += ` (${rule.pauses.length} pause${rule.pauses.length > 1 ? 's' : ''})`;
  return text;
}
