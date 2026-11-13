import { isoWeek, type ScheduleCase, type ScheduleCaseInput } from '@ordo/shared';

export const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const WEEKDAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const POSITIONS: Record<number, string> = { 1: '1er', 2: '2e', 3: '3e', 4: '4e', [-1]: 'dernier' };
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} "12 nov. 2026".
 */
export const printedDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * New case: weekdays Monday to Friday, 9:00–17:00 (every day of a one-day period).
 * @param {boolean} oneDay The period is one day.
 * @returns {ScheduleCase} Case.
 */
export function newCase(oneDay: boolean): ScheduleCase {
  return {
    pattern: oneDay ? 'DAILY' : 'WEEKLY',
    weekdays: oneDay ? [] : [1, 2, 3, 4, 5],
    every: 1,
    from: null,
    monthlyMode: 'DAY',
    monthDay: 1,
    position: 1,
    weekday: 1,
    month: 1,
    allDay: false,
    ranges: [{ start: '09:00', end: '17:00' }],
    since: null,
    until: null,
  };
}

/**
 * Days of a weekly case in words: "tous les jours", "en semaine", "le week-end", or the days.
 * @param {readonly number[]} weekdays 1 (Monday) to 7.
 * @returns {string} Days.
 */
function weekdaysText(weekdays: readonly number[]): string {
  const sorted = [...weekdays].sort();
  const key = sorted.join('');
  if (key === '1234567') return 'tous les jours';
  if (key === '12345') return 'en semaine';
  if (key === '67') return 'le week-end';
  return sorted.map((day) => WEEKDAY_SHORT[day - 1]).join(', ');
}

/**
 * Day of a monthly or yearly case: "le 15", "le dernier vendredi".
 * @param {ScheduleCaseInput} item Case.
 * @returns {string} Day.
 */
function monthDayText(item: ScheduleCaseInput): string {
  return item.monthlyMode === 'WEEKDAY' ? `le ${POSITIONS[item.position ?? 1]} ${WEEKDAY_NAMES[(item.weekday ?? 1) - 1].toLowerCase()}` : `le ${item.monthDay ?? 1}`;
}

/**
 * Days and hours of a case in words: "En semaine · semaines paires · 09:00–12:30, 14:00–18:00".
 * @param {ScheduleCaseInput} item Case.
 * @returns {string} Description.
 */
export function describeCase(item: ScheduleCaseInput): string {
  const every = item.every ?? 1;
  let days: string;
  switch (item.pattern) {
    case 'DAILY':
      days = 'tous les jours';
      break;
    case 'WEEKLY': {
      const rhythm =
        every === 1
          ? ''
          : every === 2 && item.from
            ? ` · semaines ${isoWeek(item.from) % 2 === 0 ? 'paires' : 'impaires'}`
            : ` · une semaine sur ${every}${item.from ? ` dès le ${printedDate(item.from)}` : ''}`;
      days = `${weekdaysText(item.weekdays ?? [])}${rhythm}`;
      break;
    }
    case 'EVERY_N_DAYS':
      days = `tous les ${every} jours${item.from ? ` dès le ${printedDate(item.from)}` : ''}`;
      break;
    case 'MONTHLY':
      days = `${monthDayText(item)} ${every === 1 ? 'de chaque mois' : `tous les ${every} mois`}`;
      break;
    case 'YEARLY':
      days = `${monthDayText(item)} ${item.monthlyMode === 'WEEKDAY' ? 'de ' : ''}${MONTH_NAMES[(item.month ?? 1) - 1]}${every === 1 ? '' : ` tous les ${every} ans`}`;
      break;
  }
  const hours = item.allDay ? 'toute la journée' : (item.ranges ?? []).map((range) => `${range.start}–${range.end}`).join(', ');
  const bounds = item.since && item.until ? ` · du ${printedDate(item.since)} au ${printedDate(item.until)}` : item.since ? ` · dès le ${printedDate(item.since)}` : item.until ? ` · jusqu’au ${printedDate(item.until)}` : '';
  return `${days.charAt(0).toUpperCase()}${days.slice(1)} · ${hours}${bounds}`;
}

/**
 * Cases fitted to the rhythms a period allows: one day, every day; a week at most, every day or weekdays every
 * week; longer, as they are.
 * @param {readonly ScheduleCase[]} cases Cases.
 * @param {'DAY' | 'WEEK' | 'ANY'} rhythm Rhythms allowed.
 * @returns {ScheduleCase[]} Cases.
 */
export function fitCases(cases: readonly ScheduleCase[], rhythm: 'DAY' | 'WEEK' | 'ANY'): ScheduleCase[] {
  if (rhythm === 'ANY') return [...cases];
  return cases.map((item) => (rhythm === 'WEEK' && item.pattern === 'WEEKLY' ? { ...item, every: 1, from: null } : item.pattern === 'DAILY' ? item : { ...item, pattern: 'DAILY' as const }));
}

/**
 * Monday of the first week of a parity (ISO week numbers) from a date: the start of an "every other week" case.
 * @param {string} date Start of the period.
 * @param {'even' | 'odd'} parity Even or odd weeks.
 * @returns {string} Monday.
 */
export function parityStart(date: string, parity: 'even' | 'odd'): string {
  const monday = new Date(`${date}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const first = monday.toISOString().slice(0, 10);
  if ((isoWeek(first) % 2 === 0) === (parity === 'even')) return first;
  monday.setUTCDate(monday.getUTCDate() + 7);
  return monday.toISOString().slice(0, 10);
}
