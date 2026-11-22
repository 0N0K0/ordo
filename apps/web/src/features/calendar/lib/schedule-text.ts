import { DEFAULT_RECURRENCE, withRuleValues, type ScheduleCase, type ScheduleException, type ScheduleTimes } from '@ordo/shared';
import { describeCase } from '../../../components/recurrence/describe-recurrence';
import * as fmt from '../../../lib/format';
import { plural } from '../../../lib/text';

/**
 * Name of the work schedules, everywhere: « Créneaux de travail » in a pro workspace, « Créneaux » in a personal one.
 * @param {boolean} perso A personal workspace.
 * @returns {string} Name.
 */
// eslint-disable-next-line no-restricted-syntax -- the brick the rule points to.
export const schedulesTitle = (perso: boolean): string => (perso ? 'Créneaux' : 'Créneaux de travail');

/** Title of the éphémérides (holidays, birthdays…), apart from the créneaux. */
export const EPHEMERIDES_TITLE = 'Éphémérides';

/**
 * Warning of something placed during slots « Indisponible »: « Pendant « Sommeil » (indisponible). »; null when none.
 * @param {readonly string[]} names Names of the schedules « Indisponible » met (`SlotRules.unavailable`).
 * @returns {string | null} Warning.
 */
export const unavailableWarning = (names: readonly string[]): string | null =>
  names.length ? `Pendant ${names.map((name) => `« ${name} »`).join(', ')} (${plural(names.length, 'indisponible')}).` : null;

/**
 * Hours of a case in words: "journée entière", "09:00–12:30, 14:00–18:00".
 * @param {ScheduleTimes} times Hours.
 * @returns {string} Text.
 */
export const describeScheduleTimes = (times: ScheduleTimes) => (times.allDay ? 'journée entière' : times.ranges.map((range) => `${range.start}–${range.end}`).join(', '));

/** New hours: 9:00–17:00. */
export const defaultScheduleTimes = (): ScheduleTimes => ({ allDay: false, ranges: [{ start: '09:00', end: '17:00' }] });

/**
 * New case: weekdays Monday to Friday, 9:00–17:00.
 * @param {string} start First day of its period.
 * @returns {ScheduleCase} Case.
 */
export function newScheduleCase(start: string): ScheduleCase {
  return { since: null, until: null, anchor: null, rule: withRuleValues({ ...DEFAULT_RECURRENCE, weekdays: [1, 2, 3, 4, 5] }, start), times: defaultScheduleTimes() };
}

/**
 * Days and hours of a case in words: "Toutes les semaines du lundi au vendredi · 09:00–12:30, 14:00–18:00".
 * @param {ScheduleCase} item Case.
 * @param {string} start First day of its period.
 * @returns {string} Text.
 */
export const describeScheduleCase = (item: ScheduleCase, start: string) =>
  fmt.capitalize(describeCase(item, start, { times: { describe: describeScheduleTimes, empty: defaultScheduleTimes, render: () => null } }));

/**
 * Period of an exception in words.
 * @param {ScheduleException} exception Exception.
 * @returns {string} "le 12 nov. 2026" or "du 1 août 2026 au 15 août 2026".
 */
export const exceptionPeriod = (exception: ScheduleException) => (exception.from === exception.to ? `le ${fmt.day(exception.from)}` : `du ${fmt.day(exception.from)} au ${fmt.day(exception.to)}`);
