import { groupBy, joinedKey } from '../core/collections';
import { plural } from '../core/text';
import { addDays, daysBetween, isoWeek, isoWeekHasParity, isoYear, printedDay, WEEK_PARITIES, WEEK_PARITY_WORDS, weekdayOfDate, yearOfDay } from '../dates/days';
import { lastCountedOccurrence, type Recurrence } from '../dates/recurrence';
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
  /** « Toutes les semaines », « Semaines paires », « 1 semaine sur 3, à partir du 05/01 », « Semaine 5 », « Semaines 2, 5, 8 ». */
  name: string;
  /** Mondays of its weeks, in order. */
  weeks: string[];
  /** Slots of its first week (the others have the same, a week later each). */
  slots: PlannedSlot[];
}

/**
 * Bare rule of a case: without its days deleted one by one nor its pauses. A rule limited to a number of occurrences
 * ends on its last occurrence as it counts them (its days deleted and paused not counted, `lastCountedOccurrence`):
 * the days it gives back are those it skipped, its end does not move.
 * @param {Recurrence} rule Rule of the case.
 * @param {string} start First day its rhythm and its count start from.
 * @returns {Recurrence} Bare rule.
 */
function bareRule(rule: Recurrence, start: string): Recurrence {
  const bare = { ...rule, exceptions: [], pauses: [] };
  if (rule.count === null) return bare;
  // No occurrence at all (every one deleted or paused): none either, a day before its first one.
  return { ...bare, count: null, until: lastCountedOccurrence(rule, start) ?? addDays(start, -1) };
}

/**
 * A schedule reduced to its rules: its cases that repeat, by their bare rule (`bareRule`: without days deleted one by
 * one nor pauses), and without its exceptions (days or periods changed, moved or paused); none when it has no case
 * that repeats.
 * @param {WorkScheduleRule} schedule Schedule.
 * @returns {WorkScheduleRule | null} Schedule of its rules, or none.
 */
export function ruleOnlySchedule(schedule: WorkScheduleRule): WorkScheduleRule | null {
  const cases = schedule.cases.flatMap((item) => (item.rule ? [{ ...item, rule: bareRule(item.rule, item.anchor ?? item.since ?? schedule.startDate) }] : []));
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
 * Weeks named by their numbers: « Semaine 5 », « Semaines 2, 5, 8 » (the ISO year of a number the period has twice).
 * @param {readonly string[]} weeks Mondays of the weeks, in order.
 * @param {readonly string[]} mondays Mondays of the period.
 * @returns {string} Name.
 */
function listedWeeks(weeks: readonly string[], mondays: readonly string[]): string {
  return `${plural(weeks.length, 'Semaine')} ${weeks.map((monday) => weekLabel(monday, mondays)).join(', ')}`;
}

/**
 * Pattern the weeks of a typical week follow, and its name: one week out of n (n ≥ 3, 3 weeks at least), exactly from
 * its first week to the end of the period; every even or odd week (all its weeks of that parity, more than half of
 * the weeks of that parity that have slots: one case at most, the largest); every week from its first one, none
 * having slots before; every other week across a week 53 (both parities, 3 weeks at least); every week (more than
 * half of the weeks that have slots); none for a single week, or otherwise.
 * @param {readonly string[]} weeks Mondays of its weeks, in order.
 * @param {readonly string[]} mondays Mondays of every week of the period, in order.
 * @param {readonly string[]} filled Mondays of the weeks of the period that have slots.
 * @param {{ from: string, to: string }} period First and last days of the period.
 * @returns {string | null} Name of its pattern, or none.
 */
function weeksPattern(weeks: readonly string[], mondays: readonly string[], filled: readonly string[], period: { from: string; to: string }): string | null {
  if (weeks.length < 2) return null;
  const step = daysBetween(weeks[0], weeks[1]) / 7;
  // Regular up to the end of the period: the next one would be after it.
  const regular = weeks.every((monday, index) => index === 0 || daysBetween(weeks[index - 1], monday) === step * 7) && addDays(weeks[weeks.length - 1], step * 7) > mondays[mondays.length - 1];
  // « 05/01 »: the day and the month of its first Monday; its year too over several calendar years, or when that
  // Monday is in another year than the start of the period.
  const year = yearOfDay(period.from);
  const since = year === yearOfDay(period.to) && year === yearOfDay(weeks[0]) ? printedDay(weeks[0]).slice(0, 5) : printedDay(weeks[0]);
  const everyStep = step === 1 ? `Toutes les semaines, à partir du ${since}` : `1 semaine sur ${step}, à partir du ${since}`;
  if (regular && step >= 3 && weeks.length >= 3) return everyStep;
  for (const parity of WEEK_PARITIES) {
    const ofParity = filled.filter((monday) => isoWeekHasParity(monday, parity));
    if (weeks.every((monday) => isoWeekHasParity(monday, parity)) && weeks.length * 2 > ofParity.length) return `Semaines ${WEEK_PARITY_WORDS[parity]}s`;
  }
  // Every week from one after the start of the period, none having slots before; every other week across a week 53
  // (both parities: else a parity above, or the weeks of another case of that parity).
  const mixed = WEEK_PARITIES.every((parity) => weeks.some((monday) => isoWeekHasParity(monday, parity)));
  if (regular && ((step === 1 && weeks[0] !== mondays[0] && filled.every((monday) => monday >= weeks[0])) || (step === 2 && weeks.length >= 3 && mixed))) return everyStep;
  return weeks.length * 2 > filled.length ? 'Toutes les semaines' : null;
}

/**
 * Names of the typical weeks of a period, read from their weeks and those of the others: each takes the name of the
 * pattern its weeks follow (`weeksPattern`: « 1 semaine sur 3, à partir du 05/01 », « Semaines paires » / « Semaines
 * impaires », « Toutes les semaines, à partir du 05/01 », « Toutes les semaines »); a typical week holding more than
 * half of the weeks of a parity, or of the period, takes its name (the largest one: two cannot), the others keep
 * their numbers (« Semaine 36 », « Semaines 36, 46 »). All the even weeks but weeks 36 and 46, and those two apart:
 * « Semaines paires », « Semaine 36 », « Semaine 46 ».
 * @param {readonly (readonly string[])[]} cases Mondays of the weeks of each typical week, in order.
 * @param {readonly string[]} mondays Mondays of every week of the period, in order.
 * @param {{ from: string, to: string }} period First and last days of the period.
 * @returns {string[]} Names, in the order of the typical weeks.
 */
export function typicalWeekNames(cases: readonly (readonly string[])[], mondays: readonly string[], period: { from: string; to: string }): string[] {
  const filled = cases.flat();
  return cases.map((weeks) => weeksPattern(weeks, mondays, filled, period) ?? listedWeeks(weeks, mondays));
}

/**
 * Typical weeks of a period: its weeks (Monday to Sunday, whole, those it overlaps) with the same slots of the
 * schedules given, from their rules only (`ruleOnlySchedule`: neither the days changed, moved, deleted or paused,
 * nor the cases that do not repeat), each named from its weeks among the others (`typicalWeekNames`), in the order of their first week. The
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
  const found = [...groups.values()];
  const names = typicalWeekNames(
    found.map((group) => group.weeks),
    mondays,
    { from, to },
  );
  return found.map((group, index) => ({ name: names[index], ...group }));
}
