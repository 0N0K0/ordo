import { filterConditionSchemaFor, filterGroupSchemaFor, type FilterConditionOf, type FilterGroupOf } from '../tables/filters';
import { addDays } from '../dates/days';
import { casesSlotsOn, countedSchedules, plannedSlots, slotSchedules, type PlannedSlot, type ScheduleCase, type WorkScheduleRule } from './work-schedules';
import { BIRTHDAY_SLOT_KIND, birthdaySlotId, birthdaySlotPerson, scheduleSlotKind } from './slot-kinds';
import { birthdaysBetween, readBirthDate } from '../people/birthdays';

/**
 * Fields of the conditions on calendar schedules: some schedules (on or out of them), some kinds of schedules (on or
 * out of the schedules of those kinds, those created later too), of this workspace or of another one of the user, or
 * the free time (out of every schedule of this workspace, those created later too, but some of them).
 */
export const SLOT_CONDITION_FIELDS = { schedules: 'reference', kinds: 'reference', freeTime: 'reference' } as const;
export type SlotConditionField = keyof typeof SLOT_CONDITION_FIELDS;
/**
 * Schedules and kinds: on the slots of one of them, or out of all of them. Free time: out of every schedule (but some
 * of them).
 */
export const SLOT_CONDITION_FIELD_OPERATORS: Record<SlotConditionField, readonly string[]> = { schedules: ['in', 'notIn'], kinds: ['in', 'notIn'], freeTime: ['isEmpty', 'notIn'] };
/** Every schedule of the workspace, in the schedules asked for the slots of a day. */
export const ALL_SCHEDULES = '*';

/** Condition on some calendar schedules. */
export type SlotConditionItem = FilterConditionOf<SlotConditionField>;
/** Conditions on calendar schedules, in groups combined with « et » / « ou » (the filters of the tables). */
export type SlotCondition = FilterGroupOf<SlotConditionField>;

const slotConditionItemSchema = filterConditionSchemaFor(SLOT_CONDITION_FIELDS, {}).refine((condition) => (SLOT_CONDITION_FIELD_OPERATORS[condition.field] ?? []).includes(condition.operator), {
  path: ['operator'],
  message: 'Sur ou hors des créneaux.',
});
/** Schema of a condition on calendar schedules. */
export const slotConditionSchema = filterGroupSchemaFor(slotConditionItemSchema);

/**
 * Condition stored or received (JSON), validated: null when none or invalid.
 * @param {unknown} value Condition.
 * @returns {SlotCondition | null} Condition.
 */
export function readSlotCondition(value: unknown): SlotCondition | null {
  const parsed = slotConditionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Values a condition names in some of its fields.
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @param {readonly SlotConditionField[]} fields Fields looked at.
 * @returns {string[]} Values, each once.
 */
function conditionValues(node: SlotCondition | SlotConditionItem | null | undefined, fields: readonly SlotConditionField[]): string[] {
  if (!node) return [];
  if (node.type === 'condition') return fields.includes(node.field) && Array.isArray(node.value) ? node.value : [];
  return [...new Set(node.children.flatMap((child) => conditionValues(child, fields)))];
}

/**
 * Schedules a condition names (on or out of them, or kept out of the free time).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {string[]} Schedule ids.
 */
export const conditionScheduleIds = (node: SlotCondition | SlotConditionItem | null | undefined): string[] => conditionValues(node, ['schedules', 'freeTime']);

/**
 * Kinds of schedules a condition names (`ownSlotKind`, `foreignSlotKind`).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {string[]} Kinds.
 */
export const conditionKinds = (node: SlotCondition | SlotConditionItem | null | undefined): string[] => conditionValues(node, ['kinds']);

/**
 * Everything a condition names: its schedules and its kinds (they never share an id).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {string[]} Schedule ids and kinds.
 */
export const conditionReferences = (node: SlotCondition | SlotConditionItem | null | undefined): string[] => conditionValues(node, ['schedules', 'kinds', 'freeTime']);

/**
 * Whether a condition names birthdays: that of a person (`birthdaySlotId`) or all of them (`BIRTHDAY_SLOT_KIND`).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {boolean} It names some.
 */
export const conditionCitesBirthdays = (node: SlotCondition | SlotConditionItem | null | undefined): boolean =>
  conditionKinds(node).includes(BIRTHDAY_SLOT_KIND) || conditionScheduleIds(node).some((id) => birthdaySlotPerson(id) !== null);

/**
 * Whether a condition limits the hours (it has a condition on some schedules, some kinds or on the free time).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {boolean} It limits them.
 */
export function conditionConstrains(node: SlotCondition | SlotConditionItem | null | undefined): boolean {
  if (!node) return false;
  if (node.type === 'condition') return node.field === 'freeTime' || conditionReferences(node).length > 0;
  // A group « ou » limits them only when each of its choices does (an empty group allows anywhere).
  return node.combinator === 'or' ? node.children.length > 0 && node.children.every(conditionConstrains) : node.children.some(conditionConstrains);
}

/** A window of the day: from a time (null: the start of the day) to a time (null: its end). */
export interface TimeWindow {
  fromTime: string | null;
  dueTime: string | null;
}

/** Interval of the day, HH:MM to HH:MM ("24:00": the end of the day). */
interface Interval {
  start: string;
  end: string;
}

/**
 * Interval of a window.
 * @param {TimeWindow} window Window.
 * @returns {Interval} Interval.
 */
const intervalOf = (window: TimeWindow): Interval => ({ start: window.fromTime ?? '00:00', end: window.dueTime ?? '24:00' });

/**
 * Window of an interval (the start and end of the day as none).
 * @param {Interval} interval Interval.
 * @returns {TimeWindow} Window.
 */
const windowOf = (interval: Interval): TimeWindow => ({ fromTime: interval.start === '00:00' ? null : interval.start, dueTime: interval.end === '24:00' ? null : interval.end });

/**
 * Hours of planned slots (a whole day: the whole day), merged where they meet or overlap.
 * @param {readonly PlannedSlot[]} slots Slots of a day.
 * @returns {Interval[]} Intervals, in order.
 */
function merged(slots: readonly PlannedSlot[]): Interval[] {
  // A slot up to 23:59 (the latest time a slot can end) lasts to the end of the day.
  const sorted = slots
    .map((slot) => (slot.allDay ? { start: '00:00', end: '24:00' } : { start: slot.start, end: slot.end === '23:59' ? '24:00' : slot.end }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const result: Interval[] = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last && interval.start <= last.end) last.end = interval.end > last.end ? interval.end : last.end;
    else result.push({ ...interval });
  }
  return result;
}

/**
 * Parts of a window out of slots: its free time (several when slots cut it; a whole-day slot leaves none).
 * @param {TimeWindow} window Window.
 * @param {readonly PlannedSlot[]} slots Slots of the day.
 * @returns {TimeWindow[]} Windows, in order (none: no free time).
 */
function windowsOutside(window: TimeWindow, slots: readonly PlannedSlot[]): TimeWindow[] {
  let parts = [intervalOf(window)];
  for (const block of merged(slots)) {
    parts = parts.flatMap((part) =>
      block.end <= part.start || block.start >= part.end
        ? [part]
        : [...(part.start < block.start ? [{ start: part.start, end: block.start }] : []), ...(block.end < part.end ? [{ start: block.end, end: part.end }] : [])],
    );
  }
  return parts.map(windowOf);
}

/**
 * Schedules asked for: some by id (`ALL_SCHEDULES`: every schedule of the workspace), and those of some kinds.
 */
export interface ScheduleQuery {
  /** Schedule ids. Optional. */
  ids?: readonly string[];
  /** Kinds (`ownSlotKind`, `foreignSlotKind`). Optional. */
  kinds?: readonly string[];
  /** The schedules « Indisponible » in the workspace (of it, or of another one through its subscription). Optional. Default = false. */
  unavailable?: boolean;
}

/** Slots of some schedules on the day. */
export type SlotsOf = (query: ScheduleQuery) => readonly PlannedSlot[];

/** The whole day. */
const WHOLE_DAY: Interval[] = [{ start: '00:00', end: '24:00' }];

/**
 * Hours of the day out of the slots « Indisponible » of the workspace; null when it has none that day.
 * @param {SlotsOf} slotsOf Slots of some schedules on the day.
 * @returns {Interval[] | null} Intervals, in order (none: unavailable the whole day).
 */
function availableIntervals(slotsOf: SlotsOf): Interval[] | null {
  const unavailable = slotsOf({ unavailable: true });
  return unavailable.length ? windowsOutside({ fromTime: null, dueTime: null }, unavailable).map(intervalOf) : null;
}

/**
 * Hours of the day something can be scheduled in: those a condition on calendar schedules allows (on the slots of
 * some schedules or kinds, `in`, out of them, `notIn`, combined in groups with « et » (all) or « ou » (at least
 * one)), always out of the slots « Indisponible » of the workspace; null when neither limits that day (no condition,
 * or an empty group, and nothing unavailable).
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {SlotsOf} slotsOf Slots of some schedules on the day.
 * @returns {TimeWindow[] | null} Windows allowed, in order (none: never that day).
 */
export function conditionWindows(condition: SlotCondition | null | undefined, slotsOf: SlotsOf): TimeWindow[] | null {
  const byCondition = conditionConstrains(condition) ? (conditionIntervals(condition, slotsOf) ?? []) : null;
  const available = availableIntervals(slotsOf);
  const intervals = byCondition && available ? intersect(byCondition, available) : (byCondition ?? available);
  return intervals ? intervals.map(windowOf) : null;
}

/**
 * Intervals where two sets of intervals meet.
 * @param {readonly Interval[]} a Intervals, in order.
 * @param {readonly Interval[]} b Intervals, in order.
 * @returns {Interval[]} Intervals.
 */
function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const left of a)
    for (const right of b) {
      const start = left.start > right.start ? left.start : right.start;
      const end = left.end < right.end ? left.end : right.end;
      if (start < end) result.push({ start, end });
    }
  return result.sort((x, y) => x.start.localeCompare(y.start));
}

/**
 * Intervals of either set, merged.
 * @param {readonly Interval[]} a Intervals.
 * @param {readonly Interval[]} b Intervals.
 * @returns {Interval[]} Intervals, in order.
 */
const unite = (a: readonly Interval[], b: readonly Interval[]): Interval[] => merged([...a, ...b].map((part) => ({ date: '', scheduleId: '', allDay: false, ...part })));

/**
 * Intervals of the day a condition allows (null: anywhere; an empty group, or a group « ou » with one, too).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Group or condition.
 * @param {SlotsOf} slotsOf Slots of some schedules on the day.
 * @returns {Interval[] | null} Intervals.
 */
function conditionIntervals(node: SlotCondition | SlotConditionItem | null | undefined, slotsOf: SlotsOf): Interval[] | null {
  if (!node) return null;
  if (node.type === 'condition') {
    const values = Array.isArray(node.value) ? node.value : [];
    // Free time: out of every schedule of the workspace, but those named.
    if (node.field === 'freeTime') {
      const others = slotsOf({ ids: [ALL_SCHEDULES] }).filter((slot) => node.operator !== 'notIn' || !values.includes(slot.scheduleId));
      return windowsOutside({ fromTime: null, dueTime: null }, others).map(intervalOf);
    }
    const slots = slotsOf(node.field === 'kinds' ? { kinds: values } : { ids: values });
    if (node.operator === 'notIn') return windowsOutside({ fromTime: null, dueTime: null }, slots).map(intervalOf);
    return merged(slots);
  }
  // A child without constraint (an empty group) allows anywhere: in a group « ou », the whole group does.
  const all = node.children.map((child) => conditionIntervals(child, slotsOf));
  if (node.combinator === 'or' && all.includes(null)) return null;
  const parts = all.filter((part): part is Interval[] => part !== null);
  if (!parts.length) return null;
  return node.combinator === 'and' ? parts.reduce((all, part) => intersect(all, part), WHOLE_DAY) : parts.reduce((all, part) => unite(all, part), [] as Interval[]);
}

/**
 * Parts of a window a condition allows (the window itself without constraint).
 * @param {TimeWindow} window Window.
 * @param {TimeWindow[] | null} allowed Windows allowed (null: anywhere).
 * @returns {TimeWindow[]} Windows, in order (none: not doable).
 */
export function windowsAllowed(window: TimeWindow, allowed: TimeWindow[] | null): TimeWindow[] {
  if (!allowed) return [window];
  return intersect([intervalOf(window)], allowed.map(intervalOf)).map(windowOf);
}

/** Slots of some schedules (by id, `ALL_SCHEDULES`: every one of the workspace, or by kind) on a day. */
export type SlotsOn = (query: ScheduleQuery, date: string) => PlannedSlot[];

/** Schedule of another workspace of the user, with its workspace. */
export interface ForeignScheduleRule {
  workspaceId: string;
  rule: WorkScheduleRule;
}

/**
 * Birthday of a person, as slot conditions count it: its id (`personBirthdayId`), the birth date, whether
 * its person is archived (it then gives no moment), and the other ids it is the birthday of (a relation
 * linked to a contributor: one person, one birthday).
 */
export interface BirthdaySource {
  /** `contributor:<id>` or `relation:<id>`. */
  id: string;
  /** YYYY-MM-DD, or --MM-DD without year. */
  birthDate: string;
  /** Its person is archived: no moment. Optional. Default = false. */
  archived?: boolean;
  /** Other birthday ids (`personBirthdayId`) naming the same one: the relation linked to the contributor, or the reverse. Optional. Default = none. */
  aliases?: readonly string[];
}

/**
 * Slots of some schedules on a day, the slots of each day computed when first asked: what conditions on calendar
 * schedules are evaluated on, for tasks and routines alike. The schedules of the other workspaces only count where a
 * condition names them (or their kinds), never in the free time; nor do the éphémérides of the workspace, nor the
 * birthdays (whole days, named by `birthdaySlotId` or all of them by `BIRTHDAY_SLOT_KIND`). Archived
 * schedules, those of archived kinds and the birthdays of archived people count nowhere.
 * @param {readonly WorkScheduleRule[]} rules Schedules of the workspace.
 * @param {readonly ForeignScheduleRule[]} [foreign] Schedules of the other workspaces of the user. Optional. Default = none.
 * @param {readonly BirthdaySource[]} [birthdays] Birthdays of the people of the workspace. Optional. Default = none.
 * @returns {SlotsOn} Slots of some schedules on a day.
 */
export function scheduleSlotsOn(rules: readonly WorkScheduleRule[], foreign: readonly ForeignScheduleRule[] = [], birthdays: readonly BirthdaySource[] = []): SlotsOn {
  // Archived schedules, those of archived kinds and the birthdays of archived people give no moment.
  const counted = countedSchedules(rules);
  const others = foreign.filter(({ rule }) => countedSchedules([rule]).length);
  // The free time: out of the créneaux of the workspace, its éphémérides left out.
  const own = new Set(slotSchedules(counted).map((rule) => rule.id));
  // « Indisponible » here: of the workspace, or of another one through the subscription of this one.
  const unavailable = new Set([...counted, ...others.map(({ rule }) => rule)].filter((rule) => rule.unavailable).map((rule) => rule.id));
  const kindOf = new Map<string, string | null>([...counted.map((rule) => [rule.id, scheduleSlotKind(rule)] as const), ...others.map(({ workspaceId, rule }) => [rule.id, scheduleSlotKind(rule, workspaceId)] as const)]);
  const all = [...counted, ...others.map(({ rule }) => rule)];
  // Birthdays: a whole day each year, of the kind of every birthday; a reference to another id of the same person
  // names it too.
  const births = birthdays.flatMap((birthday) => {
    const birth = !birthday.archived && readBirthDate(birthday.birthDate);
    return birth ? [{ scheduleId: birthdaySlotId(birthday.id), birth }] : [];
  });
  const aliasOf = new Map(birthdays.filter((birthday) => !birthday.archived).flatMap((birthday) => (birthday.aliases ?? []).map((alias) => [birthdaySlotId(alias), birthdaySlotId(birthday.id)] as const)));
  for (const { scheduleId } of births) kindOf.set(scheduleId, BIRTHDAY_SLOT_KIND);
  const byDay = new Map<string, PlannedSlot[]>();
  return ({ ids: asked = [], kinds = [], unavailable: unavailableAsked = false }, date) => {
    if (!asked.length && !kinds.length && !(unavailableAsked && unavailable.size)) return [];
    const ids = asked.map((id) => aliasOf.get(id) ?? id);
    let slots = byDay.get(date);
    if (!slots) {
      const birthdaySlots = births.filter(({ birth }) => birthdaysBetween(birth, date, date).length).map(({ scheduleId }) => ({ date, start: '00:00', end: '24:00', allDay: true, scheduleId }));
      byDay.set(date, (slots = [...plannedSlots(all, date, date), ...birthdaySlots]));
    }
    // Every schedule of the workspace (the free time), those named, or those of the kinds named.
    const every = ids.includes(ALL_SCHEDULES);
    return slots.filter(
      (slot) => (every && own.has(slot.scheduleId)) || ids.includes(slot.scheduleId) || kinds.includes(kindOf.get(slot.scheduleId) ?? '') || (unavailableAsked && unavailable.has(slot.scheduleId)),
    );
  };
}

/**
 * Intervals of a day an item can be done in: those its condition on calendar schedules allows, within its own hours (the
 * « Horaires » of a task) when it has some, out of the slots « Indisponible »; null when none of them limits it (any time).
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {SlotsOn} slotsOn Slots of some schedules on a day.
 * @param {string} date YYYY-MM-DD.
 * @param {readonly ScheduleCase[]} hours Its own hours (none: no limit).
 * @returns {Interval[] | null} Intervals, in order (none: never that day).
 */
function allowedIntervals(condition: SlotCondition | null | undefined, slotsOn: SlotsOn, date: string, hours: readonly ScheduleCase[]): Interval[] | null {
  const parts = [
    conditionConstrains(condition) ? (conditionIntervals(condition, (query) => slotsOn(query, date)) ?? []) : null,
    hours.length ? merged(casesSlotsOn(hours, date)) : null,
    availableIntervals((query) => slotsOn(query, date)),
  ].filter((part): part is Interval[] => part !== null);
  return parts.length ? parts.reduce((all, part) => intersect(all, part)) : null;
}

/**
 * What keeps an item from a moment: its own hours (the « Horaires » of a task), its condition on calendar schedules, or
 * a slot « Indisponible » of the workspace.
 */
export type ConditionBlock = 'hours' | 'slots' | 'unavailable';

/**
 * What keeps an item from a moment, its own hours first, then its condition on calendar schedules, then the slots
 * « Indisponible » of the workspace; null when all allow it (none: any moment).
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {SlotsOn} slotsOn Slots of some schedules on a day.
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @param {readonly ScheduleCase[]} [hours] Own hours of the item. Optional. Default = none (no limit).
 * @returns {ConditionBlock | null} What keeps it, null: allowed.
 */
export function conditionBlockAt(condition: SlotCondition | null | undefined, slotsOn: SlotsOn, date: string, time: string, hours: readonly ScheduleCase[] = []): ConditionBlock | null {
  const holds = (intervals: readonly Interval[]) => intervals.some((interval) => interval.start <= time && time < interval.end);
  if (hours.length && !holds(merged(casesSlotsOn(hours, date)))) return 'hours';
  if (conditionConstrains(condition) && !holds(conditionIntervals(condition, (query) => slotsOn(query, date)) ?? [])) return 'slots';
  if (slotsOn({ unavailable: true }, date).some((slot) => holds(merged([slot])))) return 'unavailable';
  return null;
}

/**
 * Whether a condition on calendar schedules, and the own hours of the item (the « Horaires » of a task), allow a
 * moment out of the slots « Indisponible »: all must (none: any moment). The only test of when a task can be done, for
 * the API and the app.
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {SlotsOn} slotsOn Slots of some schedules on a day.
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @param {readonly ScheduleCase[]} [hours] Own hours of the item. Optional. Default = none (no limit).
 * @returns {boolean} Allowed.
 */
export function conditionAllowsAt(condition: SlotCondition | null | undefined, slotsOn: SlotsOn, date: string, time: string, hours: readonly ScheduleCase[] = []): boolean {
  return conditionBlockAt(condition, slotsOn, date, time, hours) === null;
}

/**
 * First moment a condition on calendar schedules, and the own hours of the item, allow from a moment on out of the
 * slots « Indisponible », within some days (the moment itself when none limits it); null when none.
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {SlotsOn} slotsOn Slots of some schedules on a day.
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @param {number} days Days looked at, the date included.
 * @param {readonly ScheduleCase[]} [hours] Own hours of the item. Optional. Default = none (no limit).
 * @returns {{ date: string, time: string } | null} Moment.
 */
export function nextConditionMoment(
  condition: SlotCondition | null | undefined,
  slotsOn: SlotsOn,
  date: string,
  time: string,
  days: number,
  hours: readonly ScheduleCase[] = [],
): { date: string; time: string } | null {
  for (let offset = 0; offset < days; offset++) {
    const day = addDays(date, offset);
    const from = offset ? '00:00' : time;
    const interval = (allowedIntervals(condition, slotsOn, day, hours) ?? WHOLE_DAY).find((item) => item.end > from);
    if (interval) return { date: day, time: interval.start > from ? interval.start : from };
  }
  return null;
}

/**
 * The schedules « Indisponible » of the workspace met at a moment, or during a period (its end excluded): those of
 * the workspace, and those of other workspaces through its subscriptions.
 * @param {SlotsOn} slotsOn Slots of some schedules on a day.
 * @param {{ date: string, time: string }} from Moment, or start of the period (YYYY-MM-DD, HH:MM).
 * @param {{ date: string, time: string }} [to] End of the period. Optional. Default = the moment alone.
 * @returns {string[]} Schedule ids, each once, in the order met.
 */
export function unavailableScheduleIds(slotsOn: SlotsOn, from: { date: string; time: string }, to?: { date: string; time: string }): string[] {
  const ids = new Set<string>();
  for (let day = from.date; day <= (to ?? from).date; day = addDays(day, 1)) {
    const start = day === from.date ? from.time : '00:00';
    const end = !to ? null : day === to.date ? to.time : '24:00';
    for (const slot of slotsOn({ unavailable: true }, day)) {
      const [interval] = merged([slot]);
      if (end === null ? interval.start <= start && start < interval.end : interval.start < end && start < interval.end) ids.add(slot.scheduleId);
    }
  }
  return [...ids];
}
