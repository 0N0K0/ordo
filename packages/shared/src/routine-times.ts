import { filterConditionSchemaFor, filterGroupSchemaFor, type FilterConditionOf, type FilterGroupOf } from './filters';
import type { PlannedSlot } from './work-schedules';

/**
 * Fields of the conditions on calendar schedules: some schedules (on or out of them), or the free time (out of every
 * schedule, those created later too, but some of them).
 */
export const SLOT_CONDITION_FIELDS = { schedules: 'reference', freeTime: 'reference' } as const;
export type SlotConditionField = keyof typeof SLOT_CONDITION_FIELDS;
/** Schedules: on the slots of one of them, or out of all of them. Free time: out of every schedule (but some of them). */
export const SLOT_CONDITION_FIELD_OPERATORS: Record<SlotConditionField, readonly string[]> = { schedules: ['in', 'notIn'], freeTime: ['isEmpty', 'notIn'] };
/** Every schedule, in the schedules asked for the slots of a day. */
export const ALL_SCHEDULES = '*';

/** Condition on some calendar schedules. */
export type SlotConditionItem = FilterConditionOf<SlotConditionField>;
/** Conditions on calendar schedules, in groups combined with « et » / « ou » (the filters of the tables). */
export type SlotCondition = FilterGroupOf<SlotConditionField>;

const slotConditionItemSchema = filterConditionSchemaFor(SLOT_CONDITION_FIELDS, {}).refine((condition) => (SLOT_CONDITION_FIELD_OPERATORS[condition.field] ?? []).includes(condition.operator), {
  path: ['operator'],
  message: 'Sur ou hors des plages.',
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
 * Schedules a condition names.
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {string[]} Schedule ids.
 */
export function conditionScheduleIds(node: SlotCondition | SlotConditionItem | null | undefined): string[] {
  if (!node) return [];
  if (node.type === 'condition') return Array.isArray(node.value) ? node.value : [];
  return [...new Set(node.children.flatMap(conditionScheduleIds))];
}

/**
 * Whether a condition limits the hours (it has a condition on some schedules or on the free time).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Condition.
 * @returns {boolean} It limits them.
 */
export function conditionConstrains(node: SlotCondition | SlotConditionItem | null | undefined): boolean {
  if (!node) return false;
  if (node.type === 'condition') return node.field === 'freeTime' || conditionScheduleIds(node).length > 0;
  return node.children.some(conditionConstrains);
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
 * Hours of the day a condition on calendar schedules allows: on the slots of some schedules (`in`), out of them
 * (`notIn`), combined in groups with « et » (all) or « ou » (at least one); null when it constrains nothing (no
 * condition, or an empty group).
 * @param {SlotCondition | null | undefined} condition Condition.
 * @param {(ids: readonly string[]) => readonly PlannedSlot[]} slotsOf Slots of some schedules on the day.
 * @returns {TimeWindow[] | null} Windows allowed, in order (none: never that day).
 */
export function conditionWindows(condition: SlotCondition | null | undefined, slotsOf: (ids: readonly string[]) => readonly PlannedSlot[]): TimeWindow[] | null {
  const intervals = conditionIntervals(condition, slotsOf);
  return intervals ? intervals.map(windowOf) : null;
}

/** The whole day. */
const WHOLE_DAY: Interval[] = [{ start: '00:00', end: '24:00' }];

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
 * Intervals of the day a condition allows (null: anywhere).
 * @param {SlotCondition | SlotConditionItem | null | undefined} node Group or condition.
 * @param {(ids: readonly string[]) => readonly PlannedSlot[]} slotsOf Slots of some schedules on the day.
 * @returns {Interval[] | null} Intervals.
 */
function conditionIntervals(node: SlotCondition | SlotConditionItem | null | undefined, slotsOf: (ids: readonly string[]) => readonly PlannedSlot[]): Interval[] | null {
  if (!node) return null;
  if (node.type === 'condition') {
    const ids = Array.isArray(node.value) ? node.value : [];
    // Free time: out of every schedule, but those named.
    if (node.field === 'freeTime') {
      const others = slotsOf([ALL_SCHEDULES]).filter((slot) => node.operator !== 'notIn' || !ids.includes(slot.scheduleId));
      return windowsOutside({ fromTime: null, dueTime: null }, others).map(intervalOf);
    }
    const on = merged(slotsOf(ids));
    if (node.operator === 'notIn') return windowsOutside({ fromTime: null, dueTime: null }, slotsOf(ids)).map(intervalOf);
    return on;
  }
  const parts = node.children.map((child) => conditionIntervals(child, slotsOf)).filter((part): part is Interval[] => part !== null);
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
