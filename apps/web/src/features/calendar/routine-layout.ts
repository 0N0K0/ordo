/** Time of the day of a routine occurrence to place in the calendar. */
export interface RoutineBlock {
  /** Its event. */
  key: string;
  routineId: string;
  day: string;
  /** Who does it (each one busy while they do it); none: its own timeline. */
  assigneeIds: readonly string[];
  /** Window it is done in (HH:MM, null: no limit on that side). */
  fromTime: string | null;
  dueTime: string | null;
  /** Minutes it takes. */
  minutes: number;
  /** Rank of the routine in the manual order of the routines. */
  position: number;
  /** Routines done before it (that day). */
  requiredIds: readonly string[];
  /** Minutes to go there and to come back. */
  travelBefore: number;
  travelAfter: number;
}

/** Place of a block: when it is done, and its travel there and back (HH:MM). */
export interface BlockPlace {
  start: string;
  end: string;
  /** Start of the way there (its start without any). */
  leave: string;
  /** End of the way back (its end without any). */
  back: string;
}

/** Interval of the day, in minutes. */
interface Interval {
  start: number;
  end: number;
}

/**
 * Minutes of a time of the day.
 * @param {string} time HH:MM.
 * @returns {number} Minutes.
 */
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * Time of the day of some minutes, within the day (the last minute at most).
 * @param {number} minutes Minutes.
 * @returns {string} HH:MM.
 */
const toTime = (minutes: number) => {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

/** Timeline of a block without assignee: its own (nobody else waits for it). */
const NOBODY = '';

/**
 * Blocks in the order they are placed: those another one waits for first, then the manual order (a loop of
 * dependencies is broken in the manual order).
 * @param {readonly RoutineBlock[]} blocks Blocks of a day.
 * @returns {RoutineBlock[]} Blocks, in order.
 */
function inOrder(blocks: readonly RoutineBlock[]): RoutineBlock[] {
  const pending = [...blocks].sort((a, b) => a.position - b.position);
  const result: RoutineBlock[] = [];
  while (pending.length) {
    const index = Math.max(
      0,
      pending.findIndex((block) => !block.requiredIds.some((id) => pending.some((other) => other !== block && other.routineId === id))),
    );
    result.push(...pending.splice(index, 1));
  }
  return result;
}

/**
 * Places of the timed routine occurrences in the calendar, day by day: each as long as the time it takes, within its
 * window, its travel there and back around it. Each person does one thing at a time (their routines, ways included,
 * follow one another); a routine starts once those it waits for are done; they come in the order of their
 * dependencies, then the manual order. Placed as early as its window allows (from its start), or as late as it allows
 * when it only has a latest time; one that cannot fit keeps the start of its window (or ends at its latest time).
 * @param {readonly RoutineBlock[]} blocks Blocks with at least one time.
 * @returns {Map<string, BlockPlace>} Places, by key.
 */
export function placeRoutineBlocks(blocks: readonly RoutineBlock[]): Map<string, BlockPlace> {
  const byDay = new Map<string, RoutineBlock[]>();
  for (const block of blocks) byDay.set(block.day, [...(byDay.get(block.day) ?? []), block]);
  const places = new Map<string, BlockPlace>();
  for (const dayBlocks of byDay.values()) {
    const busy = new Map<string, Interval[]>();
    const placed = new Map<string, Interval>();
    const people = (block: RoutineBlock) => (block.assigneeIds.length ? block.assigneeIds : [`${NOBODY}${block.key}`]);
    /**
     * First busy interval of its people the block (with its ways) would overlap at a start.
     * @param {RoutineBlock} block Block.
     * @param {number} start Start of the routine itself.
     * @param {number} length Minutes on it.
     * @returns {Interval | null} Interval, or null when they are free.
     */
    const clash = (block: RoutineBlock, start: number, length: number): Interval | null => {
      const from = start - block.travelBefore;
      const to = start + length + block.travelAfter;
      for (const person of people(block)) for (const interval of busy.get(person) ?? []) if (interval.start < to && from < interval.end) return interval;
      return null;
    };
    /**
     * Places a block: its people busy from the way there to the way back.
     * @param {RoutineBlock} block Block.
     * @param {number} start Start of the routine itself.
     * @param {number} length Minutes on it.
     * @returns {void}
     */
    const put = (block: RoutineBlock, start: number, length: number) => {
      const own = { start: start - block.travelBefore, end: start + length + block.travelAfter };
      for (const person of people(block)) busy.set(person, [...(busy.get(person) ?? []), own]);
      placed.set(block.routineId, { start, end: start + length });
      places.set(block.key, { start: toTime(start), end: toTime(start + length), leave: toTime(own.start), back: toTime(own.end) });
    };
    const order = inOrder(dayBlocks);
    // From the start of their window, in order.
    for (const block of order.filter((item) => item.fromTime)) {
      const from = toMinutes(block.fromTime!);
      const due = block.dueTime ? toMinutes(block.dueTime) : 1440;
      const length = Math.max(5, Math.min(block.minutes, due - from));
      // Once those it waits for (placed that day) are done.
      let start = Math.max(from, ...block.requiredIds.map((id) => placed.get(id)?.end ?? 0));
      for (let tries = 0; tries < 200; tries += 1) {
        const other = clash(block, start, length);
        if (!other) break;
        start = other.end + block.travelBefore;
      }
      put(block, start + length <= due ? start : from, length);
    }
    // Up to their latest time, the last ones first.
    for (const block of [...order].reverse().filter((item) => !item.fromTime)) {
      const due = toMinutes(block.dueTime!);
      const length = Math.max(5, Math.min(block.minutes, due));
      // Before those waiting for it (placed that day) start.
      const waiting = dayBlocks.filter((other) => other.requiredIds.includes(block.routineId)).map((other) => placed.get(other.routineId)?.start ?? 1440);
      let end = Math.min(due, ...waiting);
      for (let tries = 0; tries < 200; tries += 1) {
        const other = clash(block, end - length, length);
        if (!other) break;
        end = other.start - block.travelAfter;
      }
      put(block, end - length >= 0 ? end - length : due - length, length);
    }
  }
  return places;
}
