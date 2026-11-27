import { groupBy, joinedKey } from '../core/collections';
import { addDays, daysBetween, isoWeek, isoWeekHasParity, isoYear, printedDay, WEEK_PARITIES, WEEK_PARITY_WORDS, weekdayOfDate } from '../dates/days';
import { weekStartOf } from '../dates/weeks';
import { plannedSlots, type PlannedSlot, type WorkScheduleRule } from './work-schedules';

/** Most typical weeks a document of typical weeks shows (one page each). */
export const TYPICAL_WEEKS_MAX = 6;

/**
 * Refusal of a document of typical weeks with more weeks than it may show.
 * @param {number} count Typical weeks of the period.
 * @returns {string} « 9 semaines différentes sur cette période : réduisez la période ou filtrez les créneaux et éphémérides (6 au plus). »
 */
export const typicalWeeksRefusal = (count: number): string =>
  `${count} semaines différentes sur cette période : réduisez la période ou filtrez les créneaux et éphémérides (${TYPICAL_WEEKS_MAX} au plus).`;

/** Said when no week of the period has a slot from a rule. */
export const NO_TYPICAL_WEEK = 'Aucun créneau ni éphéméride répété sur cette période.';

/** Weeks of a period that have the same slots, with the name that tells which they are. */
export interface TypicalWeek {
  /** « Toutes les semaines », « Semaines paires », « 1 semaine sur 3, à partir du 05/01 », « Sem. 2, 5, 8 ». */
  name: string;
  /** Mondays of its weeks, in order. */
  weeks: string[];
  /** Slots of its first week (the others have the same, a week later each). */
  slots: PlannedSlot[];
}

/**
 * A schedule reduced to its rules: its cases that repeat, without their days deleted one by one, and without its
 * exceptions (days or periods changed, moved or paused); none when it has no case that repeats.
 * @param {WorkScheduleRule} schedule Schedule.
 * @returns {WorkScheduleRule | null} Schedule of its rules, or none.
 */
export function ruleOnlySchedule(schedule: WorkScheduleRule): WorkScheduleRule | null {
  const cases = schedule.cases.flatMap((item) => (item.rule ? [{ ...item, rule: { ...item.rule, exceptions: [] } }] : []));
  return cases.length ? { ...schedule, cases, exceptions: [] } : null;
}

/**
 * Mondays of the weeks (Monday to Sunday) a period overlaps, in order.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Mondays (none when the end is before the start).
 */
export function periodMondays(from: string, to: string): string[] {
  const mondays: string[] = [];
  if (to < from) return mondays;
  for (let monday = weekStartOf(from); monday <= to; monday = addDays(monday, 7)) mondays.push(monday);
  return mondays;
}

/**
 * Label of a week in a list of weeks: its ISO number, with its ISO year when the period has that number twice.
 * @param {string} monday Monday of the week.
 * @param {readonly string[]} mondays Mondays of the period.
 * @returns {string} « 5 », or « 5 (2027) ».
 */
function weekLabel(monday: string, mondays: readonly string[]): string {
  const twice = mondays.filter((other) => isoWeek(other) === isoWeek(monday)).length > 1;
  return twice ? `${isoWeek(monday)} (${isoYear(monday)})` : String(isoWeek(monday));
}

/**
 * Name of the weeks of a typical week among those of the period, read from them: « Toutes les semaines »; every even
 * or odd week (ISO numbers) « Semaines paires » / « Semaines impaires »; one week out of n from its first one to the
 * end of the period « 1 semaine sur 3, à partir du 05/01 » (n = 1: « Toutes les semaines, à partir du 05/01 »);
 * otherwise their numbers « Sem. 2, 5, 8 ».
 * @param {readonly string[]} weeks Mondays of its weeks, in order.
 * @param {readonly string[]} mondays Mondays of every week of the period, in order.
 * @returns {string} Name.
 */
export function typicalWeekName(weeks: readonly string[], mondays: readonly string[]): string {
  if (weeks.length === mondays.length) return 'Toutes les semaines';
  /**
   * Whether some weeks are those of the typical week.
   * @param {readonly string[]} others Mondays, in order.
   * @returns {boolean} The same weeks.
   */
  const same = (others: readonly string[]) => others.length === weeks.length && others.every((monday, index) => monday === weeks[index]);
  for (const parity of WEEK_PARITIES) {
    if (same(mondays.filter((monday) => isoWeekHasParity(monday, parity)))) return `Semaines ${WEEK_PARITY_WORDS[parity]}s`;
  }
  if (weeks.length > 1) {
    const step = daysBetween(weeks[0], weeks[1]) / 7;
    const regular = weeks.every((monday, index) => index === 0 || daysBetween(weeks[index - 1], monday) === step * 7);
    // Up to the end of the period: the next one would be after it.
    if (regular && addDays(weeks[weeks.length - 1], step * 7) > mondays[mondays.length - 1]) {
      // « 05/01 »: the day and the month of its first Monday.
      const since = printedDay(weeks[0]).slice(0, 5);
      return step === 1 ? `Toutes les semaines, à partir du ${since}` : `1 semaine sur ${step}, à partir du ${since}`;
    }
  }
  return `Sem. ${weeks.map((monday) => weekLabel(monday, mondays)).join(', ')}`;
}

/**
 * Typical weeks of a period: its weeks (Monday to Sunday, whole, those it overlaps) with the same slots of the
 * schedules given, from their rules only (`ruleOnlySchedule`: neither the days changed, moved or deleted, nor the
 * cases that do not repeat), each named from its weeks (`typicalWeekName`), in the order of their first week. The
 * weeks without any slot are left out.
 * @param {readonly WorkScheduleRule[]} schedules Schedules taken into account.
 * @param {string} from First day of the period.
 * @param {string} to Last day of the period.
 * @returns {TypicalWeek[]} Typical weeks.
 */
export function typicalWeeks(schedules: readonly WorkScheduleRule[], from: string, to: string): TypicalWeek[] {
  const mondays = periodMondays(from, to);
  if (!mondays.length) return [];
  const rules = schedules.flatMap((schedule) => ruleOnlySchedule(schedule) ?? []);
  const byWeek = groupBy(plannedSlots(rules, mondays[0], addDays(mondays[mondays.length - 1], 6)), (slot) => weekStartOf(slot.date));
  const groups = new Map<string, { weeks: string[]; slots: PlannedSlot[] }>();
  for (const monday of mondays) {
    const slots = byWeek.get(monday);
    if (!slots?.length) continue;
    // The same slots of the same schedules on the same weekdays.
    const key = slots
      .map((slot) => joinedKey(slot.scheduleId, weekdayOfDate(slot.date), slot.start, slot.end))
      .sort()
      .join(';');
    const group = groups.get(key);
    if (group) group.weeks.push(monday);
    else groups.set(key, { weeks: [monday], slots });
  }
  return [...groups.values()].map((group) => ({ name: typicalWeekName(group.weeks, mondays), ...group }));
}
