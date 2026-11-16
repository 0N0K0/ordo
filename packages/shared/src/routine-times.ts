import type { PlannedSlot } from './work-schedules';

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
  const sorted = slots.map((slot) => (slot.allDay ? { start: '00:00', end: '24:00' } : { start: slot.start, end: slot.end })).sort((a, b) => a.start.localeCompare(b.start));
  const result: Interval[] = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last && interval.start <= last.end) last.end = interval.end > last.end ? interval.end : last.end;
    else result.push({ ...interval });
  }
  return result;
}

/**
 * Parts of a window within slots: where it meets them (several when they are apart).
 * @param {TimeWindow} window Window.
 * @param {readonly PlannedSlot[]} slots Slots of the day.
 * @returns {TimeWindow[]} Windows, in order (none: it meets none).
 */
export function windowsWithin(window: TimeWindow, slots: readonly PlannedSlot[]): TimeWindow[] {
  const own = intervalOf(window);
  return merged(slots)
    .map((slot) => ({ start: slot.start > own.start ? slot.start : own.start, end: slot.end < own.end ? slot.end : own.end }))
    .filter((part) => part.start < part.end)
    .map(windowOf);
}

/**
 * Parts of a window out of slots: its free time (several when slots cut it; a whole-day slot leaves none).
 * @param {TimeWindow} window Window.
 * @param {readonly PlannedSlot[]} slots Slots of the day.
 * @returns {TimeWindow[]} Windows, in order (none: no free time).
 */
export function windowsOutside(window: TimeWindow, slots: readonly PlannedSlot[]): TimeWindow[] {
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
 * Windows of the slots of a day, merged where they meet: the moments of a routine following schedules without
 * moments of its own.
 * @param {readonly PlannedSlot[]} slots Slots of the day.
 * @returns {TimeWindow[]} Windows, in order.
 */
export const slotWindows = (slots: readonly PlannedSlot[]): TimeWindow[] => merged(slots).map(windowOf);
