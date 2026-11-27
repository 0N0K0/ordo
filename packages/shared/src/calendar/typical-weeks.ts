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
 * Weeks named by their numbers: « Semaine 5 », « Semaines 2, 5, 8 », 3 consecutive weeks or more as a range, across
 * the change of ISO year too (« Semaines 36 à 4 », « Semaines 53 à 2 »: week 53 followed by week 1); the ISO year
 * of a number the period has twice.
 * @param {readonly string[]} weeks Mondays of the weeks, in order.
 * @param {readonly string[]} mondays Mondays of the period.
 * @returns {string} Name.
 */
function listedWeeks(weeks: readonly string[], mondays: readonly string[]): string {
  const runs: string[][] = [];
  for (const monday of weeks) {
    const run = runs[runs.length - 1];
    if (run && daysBetween(run[run.length - 1], monday) === 7) run.push(monday);
    else runs.push([monday]);
  }
  const parts = runs.flatMap((run) => (run.length >= 3 ? [`${weekLabel(run[0], mondays)} à ${weekLabel(run[run.length - 1], mondays)}`] : run.map((monday) => weekLabel(monday, mondays))));
  return `${plural(weeks.length, 'Semaine')} ${parts.join(', ')}`;
}

/** A name a typical week may take, and the weeks of the period it speaks of (no other typical week may speak of them). */
interface WeeksName {
  name: string;
  weeks: ReadonlySet<string>;
  /** One week out of n: given before the others. */
  rhythm: boolean;
}

/**
 * Names a typical week may take, in the order they are preferred: one week out of n (n ≥ 3, or 2 across a week 53:
 * both parities; its most frequent gap, its weeks on that rhythm), then every even or odd week, then every week. A
 * pattern is offered when its weeks hold all those of the typical week, most of their gaps no longer than the
 * pattern's (two weeks set apart are no rhythm; 3 for a parity, around a week 53), 3 weeks at least for one out of n, and when it holds at least three
 * quarters of the weeks of the pattern that have slots: over the period, or else from its first week, up to its last
 * one, or between both (« Semaines paires, jusqu’au 01/11 », « Toutes les semaines, à partir du 02/11 », « …, du
 * 02/11 au 13/12 »; one out of n always says the first week of its rhythm in the name that has slots, of another typical week too: « 1 semaine sur 3,
 * à partir du 05/01 »).
 * The name goes on past the weeks of the typical week only over other weeks of the pattern that have slots, or where
 * the pattern has no week: a rule starting or stopping during the period says when. A bound leaves out none of the
 * weeks of the pattern that have slots, or 2 at least (another rule there): a week set apart does not move it. None
 * below 3 weeks.
 * @param {readonly string[]} weeks Mondays of its weeks, in order.
 * @param {readonly string[]} mondays Mondays of every week of the period, in order.
 * @param {readonly string[]} filled Mondays of the weeks of the period that have slots.
 * @param {{ from: string, to: string }} period First and last days of the period.
 * @returns {WeeksName[]} Names.
 */
function weeksNames(weeks: readonly string[], mondays: readonly string[], filled: readonly string[], period: { from: string; to: string }): WeeksName[] {
  // Two weeks are no pattern: their numbers.
  if (weeks.length < 3) return [];
  const [first, last] = [weeks[0], weeks[weeks.length - 1]];
  const [start, end] = [mondays[0], mondays[mondays.length - 1]];
  /**
   * « 05/01 »: a day and its month; its year too over several calendar years, or out of the year of the period's start.
   * @param {string} day Day.
   * @returns {string} Text.
   */
  const dayText = (day: string) => (yearOfDay(period.from) === yearOfDay(period.to) && yearOfDay(day) === yearOfDay(period.from) ? printedDay(day).slice(0, 5) : printedDay(day));
  /**
   * A name with the days it goes from or up to (the Sunday of its last week).
   * @param {string} base Name of the pattern.
   * @param {string | null} since First Monday, none: from the start of the period.
   * @param {string | null} until Last Monday, none: up to the end of the period.
   * @returns {string} Name.
   */
  const bounded = (base: string, since: string | null, until: string | null) => {
    if (since && until) return `${base}, du ${dayText(since)} au ${dayText(addDays(until, 6))}`;
    if (since) return `${base}, à partir du ${dayText(since)}`;
    return until ? `${base}, jusqu’au ${dayText(addDays(until, 6))}` : base;
  };
  const gaps = weeks.slice(1).map((monday, index) => daysBetween(weeks[index], monday) / 7);
  const counts = groupBy(gaps, (gap) => gap);
  const step = [...counts.keys()].sort((a, b) => (counts.get(b)?.length ?? 0) - (counts.get(a)?.length ?? 0) || a - b)[0];
  const mixed = WEEK_PARITIES.every((parity) => weeks.some((monday) => isoWeekHasParity(monday, parity)));
  const patterns: { base: string; every: number; has: (monday: string) => boolean; rhythm: boolean }[] = [
    ...(weeks.length >= 3 && (step >= 3 || (step === 2 && mixed))
      ? [{ base: `1 semaine sur ${step}`, every: step, has: (monday: string) => (((daysBetween(first, monday) / 7) % step) + step) % step === 0, rhythm: true }]
      : []),
    ...WEEK_PARITIES.map((parity) => ({ base: `Semaines ${WEEK_PARITY_WORDS[parity]}s`, every: 3, has: (monday: string) => isoWeekHasParity(monday, parity), rhythm: false })),
    { base: 'Toutes les semaines', every: 1, has: () => true, rhythm: false },
  ];
  const names: WeeksName[] = [];
  for (const { base, every, has, rhythm } of patterns) {
    // Its weeks all of the pattern, mostly in its rhythm.
    if (!weeks.every(has) || gaps.filter((gap) => gap <= every).length * 2 <= gaps.length) continue;
    const others = filled.filter(has);
    /**
     * Whether the name may go on past the weeks of the typical week on one side (over other weeks of the pattern with
     * slots, or where the pattern has no week), and whether it may stop there (leaving out none of those weeks, or 2
     * at least).
     * @param {(monday: string) => boolean} beyond The side.
     * @returns {{ on: boolean, stop: boolean }} Whether it goes on, whether it stops.
     */
    const side = (beyond: (monday: string) => boolean) => {
      const left = others.filter(beyond).length;
      return { on: left > 0 || !mondays.some((monday) => beyond(monday) && has(monday)), stop: left !== 1 };
    };
    const before = side((monday) => monday < first);
    const after = side((monday) => monday > last);
    const windows: [string, string, boolean][] = [
      [start, end, before.on && after.on],
      [first, end, before.stop && after.on],
      [start, last, before.on && after.stop],
      [first, last, before.stop && after.stop],
    ];
    for (const [from, to, allowed] of windows) {
      if (!allowed || weeks.length * 4 < others.filter((monday) => from <= monday && monday <= to).length * 3) continue;
      const shown = mondays.filter((monday) => from <= monday && monday <= to && has(monday));
      // No bound where the pattern has no other week; one out of n says the first week of its rhythm in the name that
      // has slots.
      const since = rhythm ? (shown.find((monday) => others.includes(monday)) ?? first) : mondays.some((monday) => monday < from && has(monday)) ? shown[0] : null;
      const until = mondays.some((monday) => monday > to && has(monday)) ? shown[shown.length - 1] : null;
      names.push({ name: bounded(base, since, until), weeks: new Set(shown), rhythm });
    }
  }
  return names;
}

/**
 * Names of the typical weeks of a period, read from their weeks and those of the others, those of one week out of n
 * first, then the largest first: each takes the first name it may take (`weeksNames`) that speaks of none of the weeks of the pattern names
 * already given, else its numbers (`listedWeeks`): a pattern name may span weeks of other typical weeks, listed by
 * their numbers, never those of another pattern name. All the even weeks but weeks 36 and 46, and those two
 * apart: « Semaines paires », « Semaine 36 », « Semaine 46 »; a change during the period: « Toutes les semaines,
 * jusqu’au 01/11 », « Toutes les semaines, à partir du 02/11 ».
 * @param {readonly (readonly string[])[]} cases Mondays of the weeks of each typical week, in order.
 * @param {readonly string[]} mondays Mondays of every week of the period, in order.
 * @param {{ from: string, to: string }} period First and last days of the period.
 * @returns {string[]} Names, in the order of the typical weeks.
 */
export function typicalWeekNames(cases: readonly (readonly string[])[], mondays: readonly string[], period: { from: string; to: string }): string[] {
  const filled = cases.flat();
  const names: string[] = cases.map((weeks) => listedWeeks(weeks, mondays));
  const said: ReadonlySet<string>[] = [];
  const options = cases.map((weeks) => weeksNames(weeks, mondays, filled, period));
  /**
   * Rank of a typical week: those of one week out of n first.
   * @param {number} index Typical week.
   * @returns {number} 0 or 1.
   */
  const rank = (index: number) => (options[index][0]?.rhythm ? 0 : 1);
  // Then the largest first.
  const order = cases.map((_, index) => index).sort((a, b) => rank(a) - rank(b) || cases[b].length - cases[a].length || a - b);
  for (const index of order) {
    const name = options[index].find((option) => said.every((weeks) => ![...option.weeks].some((monday) => weeks.has(monday))));
    if (!name) continue;
    names[index] = name.name;
    said.push(name.weeks);
  }
  return names;
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
