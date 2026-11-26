import { parisParts } from '../dates/days';
import { minutesToTime, timeToMinutes } from '../dates/times';
import { slotSpan, type TimeWindow } from './slot-conditions';
import type { PlannedSlot } from './work-schedules';

/**
 * What « Ma journée » lists, in the order the head of the day tells them: éphémérides, events, birthdays, groups of
 * routines (a parent routine, its sub-routines under it), routines, tasks.
 */
export const MY_DAY_KINDS = ['ephemeris', 'event', 'birthday', 'routineGroup', 'routine', 'task'] as const;
export type MyDayKind = (typeof MY_DAY_KINDS)[number];

/** Times of an item on a day, HH:MM (null: none): its start and its end (on the last day of an event over several days). */
export interface MyDayTime {
  start: string | null;
  end: string | null;
}

/** An item of « Ma journée », as far as its place in the day goes (an occurrence, a moment of a routine, a task…). */
export interface MyDayItem {
  /** Unique key in the day. */
  key: string;
  kind: MyDayKind;
  /** First and last days it lasts (YYYY-MM-DD, the last one included): an event over several days. Optional. Default = the day alone. */
  startDate?: string;
  endDate?: string;
  /** All day (an event: at the head of the day). Optional. Default = false. */
  allDay?: boolean;
  /** Its times (an event, a moment of a routine with hours). Optional. Default = none. */
  time?: MyDayTime | null;
  /**
   * Windows of the day it can be done in (`itemWindowsOn`, or the windows of a moment of a routine): placed by them
   * rather than by its times; null: no limit; none: it cannot be done that day and is not in it. Optional. Default = null.
   */
  windows?: readonly TimeWindow[] | null;
  /** Late (a routine whose occurrence is past due, a task past its « Échéance »): at the head of the day, today only. Optional. Default = false. */
  late?: boolean;
  /** Done (a task, a moment of a routine): at the bottom. Optional. Default = false. */
  done?: boolean;
  /** Time it was done, HH:MM in Paris (the order of those done). Optional. */
  doneAt?: string | null;
  /** Cancelled: a task or a routine at the bottom, after those done; an event stays at its place. Optional. Default = false. */
  cancelled?: boolean;
  /** Events it is linked to (their keys): shown under the first one shown that day, not on its own. Optional. Default = none. */
  eventKeys?: readonly string[];
  /**
   * Group it belongs to (the key of a `routineGroup` item of the day: its parent routine): shown under it, not on its
   * own, unless it is under an event. Optional. Default = none.
   */
  groupKey?: string;
}

/** A slot of the day as « Ma journée » colours its hours: a planned slot, « Indisponible » or not. */
export interface MyDaySlot extends Pick<PlannedSlot, 'scheduleId' | 'start' | 'end' | 'allDay'> {
  /** Of a schedule « Indisponible ». Optional. Default = false. */
  unavailable?: boolean;
}

/** Day of an event over several days its row stands for: its first day (at its start) or its last day (at its end). */
export type MyDayPart = 'start' | 'end';

/** Row of « Ma journée »: an item, where it is placed, and the items under it (linked to an event, of a group). */
export interface MyDayRow<T extends MyDayItem> {
  item: T;
  /** Time it is placed at (HH:MM; done: the time it was done); null: none. */
  time: string | null;
  /** Day of an event over several days it stands for; null: neither its first nor its last day apart. */
  part: MyDayPart | null;
  /** Window it is placed in; null: not placed by its windows. */
  window: TimeWindow | null;
  /** Its other windows that day, in order. */
  otherWindows: TimeWindow[];
  /** Items under it (linked to an event, of a group), in the order of the day, those done or cancelled last. */
  children: MyDayRow<T>[];
}

/** An hour of « Ma journée » shown: its rows, and the slots met during it. */
export interface MyDayHour<T extends MyDayItem, S extends MyDaySlot> {
  /** 0 to 23. */
  hour: number;
  /** The hour of now (today only). */
  current: boolean;
  /** Slots met during the hour, in the order given. */
  slots: S[];
  /** A slot « Indisponible » is met during the hour. */
  unavailable: boolean;
  rows: MyDayRow<T>[];
}

/** « Ma journée » in blocks: its head, the items without hours, the hours, those done or cancelled. */
export interface MyDayLayout<T extends MyDayItem, S extends MyDaySlot> {
  /** Éphémérides, events of the whole day (and middle days of those over several days), birthdays, late routines and tasks (today only). */
  header: MyDayRow<T>[];
  /** Items without hours and without limit. */
  unscheduled: MyDayRow<T>[];
  /** Hours with a row or a slot (not of the whole day), and the hour of now, in order. */
  hours: MyDayHour<T, S>[];
  /** Done (in the order they were done), then cancelled. */
  finished: MyDayRow<T>[];
}

/** Day shown, now, and the slots of the day. */
export interface MyDayOptions<S extends MyDaySlot> {
  /** Day shown (YYYY-MM-DD). */
  day: string;
  /** Now (today and the time of now are read in Paris). */
  now: Date;
  /** Slots of the day shown (those hidden left out). Optional. Default = none. */
  slots?: readonly S[];
}

type Block = 'header' | 'unscheduled' | 'hour' | 'finished';

/** Order of the blocks in the day. */
const BLOCKS: readonly Block[] = ['header', 'unscheduled', 'hour', 'finished'];

/** Where an item goes in the day. */
interface Placement {
  block: Block;
  time: string | null;
  part: MyDayPart | null;
  window: TimeWindow | null;
  otherWindows: TimeWindow[];
}

/**
 * Start of an hour, HH:MM ("24:00" after the last one).
 * @param {number} hour 0 to 24.
 * @returns {string} HH:MM.
 */
const hourStart = (hour: number): string => minutesToTime(hour * 60);

/**
 * Hour of a time of the day.
 * @param {string} time HH:MM.
 * @returns {number} 0 to 23.
 */
const hourOf = (time: string): number => Math.floor(timeToMinutes(time) / 60);

/**
 * Whether a slot lasts the whole day (`slotSpan`: from "00:00" to "24:00").
 * @param {MyDaySlot} slot Slot.
 * @returns {boolean} Whole day.
 */
function wholeDay(slot: MyDaySlot): boolean {
  const { start, end } = slotSpan(slot);
  return start === '00:00' && end === '24:00';
}

/**
 * Where an item goes on a day; null when it does not show that day.
 * @param {MyDayItem} item Item.
 * @param {string} day Day shown.
 * @param {string} today Today in Paris.
 * @param {string} nowTime Time of now in Paris.
 * @returns {Placement | null} Placement.
 */
function placementOf(item: MyDayItem, day: string, today: string, nowTime: string): Placement | null {
  const none = { time: null, part: null, window: null, otherWindows: [] };
  const startDate = item.startDate ?? day;
  const endDate = item.endDate ?? startDate;
  if (day < startDate || day > endDate) return null;
  if (item.kind === 'ephemeris' || item.kind === 'birthday' || (item.kind === 'event' && item.allDay)) return { block: 'header', ...none };
  if (startDate < day && day < endDate) return { block: 'header', ...none };
  if (startDate < day) {
    // Last day of an event over several days: at its end; one ending at midnight ended the day before.
    const end = item.time?.end ?? null;
    if (end === '00:00') return null;
    return { block: end ? 'hour' : 'header', ...none, time: end, part: 'end' };
  }
  const part = day < endDate ? 'start' : null;
  if (item.done) return { block: 'finished', ...none, time: item.doneAt ?? null };
  if (finished(item)) return { block: 'finished', ...none };
  const windows = item.windows ?? null;
  // No window that day: it cannot be done, it is not in the day.
  if (windows && !windows.length) return null;
  if ((item.kind === 'routine' || item.kind === 'task') && item.late && day === today) return { block: 'header', ...none };
  // A single window of the whole day: nothing limits it that day.
  if (windows && !(windows.length === 1 && windows[0].fromTime === null && windows[0].dueTime === null)) {
    // The next window still to come today (the last one once all are past), the first one another day; one under
    // way today is placed at the time of now.
    const next = day === today ? windows.findIndex((window) => (window.dueTime ?? '24:00') > nowTime) : 0;
    const index = next === -1 ? windows.length - 1 : next;
    const window = windows[index];
    const start = window.fromTime ?? '00:00';
    const time = next !== -1 && day === today && start < nowTime ? nowTime : start;
    return { block: 'hour', time, part, window, otherWindows: windows.filter((_, other) => other !== index) };
  }
  // A time « jusqu’à » alone places it at that time.
  const time = item.time?.start ?? item.time?.end ?? null;
  return time ? { block: 'hour', ...none, time, part } : { block: 'unscheduled', ...none, part };
}

/**
 * Order of rows: by time (none first), then kind (`MY_DAY_KINDS`), then as given.
 * @param {{ row: MyDayRow<MyDayItem>, index: number }} a Row and its rank in the items.
 * @param {{ row: MyDayRow<MyDayItem>, index: number }} b Row and its rank.
 * @returns {number} Comparison.
 */
function byTime(a: { row: MyDayRow<MyDayItem>; index: number }, b: { row: MyDayRow<MyDayItem>; index: number }): number {
  return (a.row.time ?? '').localeCompare(b.row.time ?? '') || MY_DAY_KINDS.indexOf(a.row.item.kind) - MY_DAY_KINDS.indexOf(b.row.item.kind) || a.index - b.index;
}

/**
 * Order of rows done or cancelled: done first, in the order they were done (time unknown last), then cancelled.
 * @param {{ row: MyDayRow<MyDayItem>, index: number }} a Row and its rank in the items.
 * @param {{ row: MyDayRow<MyDayItem>, index: number }} b Row and its rank.
 * @returns {number} Comparison.
 */
function byDone(a: { row: MyDayRow<MyDayItem>; index: number }, b: { row: MyDayRow<MyDayItem>; index: number }): number {
  return Number(!a.row.item.done) - Number(!b.row.item.done) || (a.row.time ?? '99:99').localeCompare(b.row.time ?? '99:99') || a.index - b.index;
}

/**
 * Whether an item is done or cancelled, apart from the others (an event cancelled stays at its place).
 * @param {MyDayItem} item Item.
 * @returns {boolean} Finished.
 */
function finished(item: MyDayItem): boolean {
  return Boolean(item.done) || (Boolean(item.cancelled) && item.kind !== 'event');
}

/**
 * « Ma journée » of a day in blocks (pure: the items, already chosen and filtered, are only placed):
 * - head: éphémérides, events of the whole day and the middle days of an event over several days (its first day at
 *   its start, its last day at its end), birthdays, routines then tasks late (today only);
 * - without hours: items with neither times nor windows (no limit); those with no window that day are left out (done
 *   or cancelled that day, they stay at the bottom);
 * - hours: an item at its time (a time « jusqu’à » alone: at it), or in one of its windows: the next one still to
 *   come today (one under way at the time of now; the last one once all are past), the first one another day, its
 *   other windows told with it (a single window of the whole day: without hours); only the hours with a row or a slot
 *   (a slot of the whole day only colours them), and the hour of now today; each hour with the slots met during it and
 *   whether one is « Indisponible »;
 * - at the bottom: those done, in the order they were done, then those cancelled (an event cancelled stays at its
 *   place);
 * - an item linked to an event shown that day is under that event (the first of its linked events shown), nowhere else;
 * - otherwise an item of a group (`groupKey`) is under the group, nowhere else; a group is placed where the first of
 *   its items still to do is (the head, without hours, or its hour), at the bottom once they are all done or
 *   cancelled; without any item under it, by its own times.
 * @param {readonly T[]} items Items of the day.
 * @param {MyDayOptions<S>} options Day shown, now, slots of the day.
 * @returns {MyDayLayout<T, S>} Blocks.
 */
export function myDayRows<T extends MyDayItem, S extends MyDaySlot = MyDaySlot>(items: readonly T[], { day, now, slots = [] }: MyDayOptions<S>): MyDayLayout<T, S> {
  const { date: today, time: nowTime } = parisParts(now);
  const placed = items.flatMap((item, index) => {
    const placement = placementOf(item, day, today, nowTime);
    if (!placement) return [];
    const { block, ...rest } = placement;
    return [{ block, index, row: { item, ...rest, children: [] } as MyDayRow<T> }];
  });
  const events = new Map(placed.filter(({ row }) => row.item.kind === 'event').map((entry) => [entry.row.item.key, entry]));
  /**
   * Event shown that day an item is linked to: the first of its linked events, in the order it gives them.
   * @param {T} item Item.
   * @returns {(typeof placed)[number] | undefined} Event.
   */
  const parentOf = (item: T) => (item.kind === 'event' ? undefined : (item.eventKeys ?? []).map((key) => events.get(key)).find(Boolean));
  const groups = new Map(placed.filter(({ row }) => row.item.kind === 'routineGroup').map((entry) => [entry.row.item.key, entry]));
  const entryOf = new Map(placed.map((entry) => [entry.row, entry]));
  const own = placed.filter((entry) => {
    const event = parentOf(entry.row.item);
    const group = event ? undefined : entry.row.item.groupKey ? groups.get(entry.row.item.groupKey) : undefined;
    const parent = event ?? (group !== entry ? group : undefined);
    if (parent) parent.row.children.push(entry.row);
    return !parent;
  });
  /**
   * Places a group where the first of its items still to do is (its groups inside it placed first), at the bottom once
   * all are done or cancelled (at the time the last was done); without items, it keeps its own place.
   * @param {(typeof placed)[number]} entry Group.
   * @param {Set<string>} seen Groups being placed (a loop stops).
   * @returns {void}
   */
  const placeGroup = (entry: (typeof placed)[number], seen: Set<string>): void => {
    if (seen.has(entry.row.item.key)) return;
    seen.add(entry.row.item.key);
    const children = entry.row.children.flatMap((child) => entryOf.get(child) ?? []);
    for (const child of children) if (child.row.item.kind === 'routineGroup') placeGroup(child, seen);
    if (!children.length) return;
    const open = children.filter((child) => child.block !== 'finished').sort((a, b) => BLOCKS.indexOf(a.block) - BLOCKS.indexOf(b.block) || (a.row.time ?? '').localeCompare(b.row.time ?? ''));
    const first = open[0];
    const last = children.map((child) => child.row.time).filter((time): time is string => time !== null).sort().pop() ?? null;
    entry.block = first ? first.block : 'finished';
    Object.assign(entry.row, { time: first ? first.row.time : last, part: null, window: null, otherWindows: [] });
  };
  const placedGroups = new Set<string>();
  for (const entry of groups.values()) placeGroup(entry, placedGroups);
  const indexOf = new Map(placed.map(({ row, index }) => [row, index]));
  // Linked items in the order of the day, those done or cancelled last.
  for (const { row } of placed) {
    if (!row.children.length) continue;
    const ranked = row.children.map((child) => ({ row: child, index: indexOf.get(child) ?? 0 }));
    row.children = [...ranked.filter(({ row }) => !finished(row.item)).sort(byTime), ...ranked.filter(({ row }) => finished(row.item)).sort(byDone)].map(({ row }) => row);
  }
  /**
   * Rows of a block (those under an event left out).
   * @param {Block} block Block.
   * @returns {typeof own} Rows.
   */
  const of = (block: Block) => own.filter((entry) => entry.block === block);
  const rowsAt = new Map<number, MyDayRow<T>[]>();
  for (const entry of of('hour').sort(byTime)) {
    const hour = hourOf(entry.row.time ?? '00:00');
    rowsAt.set(hour, [...(rowsAt.get(hour) ?? []), entry.row]);
  }
  const hours: MyDayHour<T, S>[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const met = slots.filter((slot) => {
      const { start, end } = slotSpan(slot);
      return start < hourStart(hour + 1) && end > hourStart(hour);
    });
    const current = day === today && hourOf(nowTime) === hour;
    const rows = rowsAt.get(hour) ?? [];
    // A slot of the whole day colours the hours shown, without showing them all.
    if (rows.length || met.some((slot) => !wholeDay(slot)) || current) hours.push({ hour, current, slots: met, unavailable: met.some((slot) => slot.unavailable), rows });
  }
  const header = of('header').sort((a, b) => MY_DAY_KINDS.indexOf(a.row.item.kind) - MY_DAY_KINDS.indexOf(b.row.item.kind) || a.index - b.index);
  return {
    header: header.map(({ row }) => row),
    unscheduled: of('unscheduled').sort(byTime).map(({ row }) => row),
    hours,
    finished: of('finished').sort(byDone).map(({ row }) => row),
  };
}
