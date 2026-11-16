/** Time of the day of a routine occurrence to place in the calendar. */
export interface RoutineBlock {
  /** Its event. */
  key: string;
  routineId: string;
  day: string;
  /** Who does it (the same people chain their routines). */
  assigneeIds: readonly string[];
  /** Window it is done in (HH:MM, null: no limit on that side). */
  fromTime: string | null;
  dueTime: string | null;
  /** Minutes it takes. */
  minutes: number;
  /** Rank of the routine in the manual order of the routines. */
  position: number;
}

/** Place of a block: its start and end (HH:MM). */
export interface BlockPlace {
  start: string;
  end: string;
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

/**
 * Places of the timed routine occurrences in the calendar: each as long as the time it takes, within its window.
 * Those of a same day, window and people follow one another in the manual order of the routines, from the start of the window
 * (up to its end without a start); when they take longer all together than the window, each starts with it.
 * @param {readonly RoutineBlock[]} blocks Blocks with at least one time.
 * @returns {Map<string, BlockPlace>} Places, by key.
 */
export function placeRoutineBlocks(blocks: readonly RoutineBlock[]): Map<string, BlockPlace> {
  const groups = new Map<string, RoutineBlock[]>();
  for (const block of blocks) {
    const key = [block.day, block.fromTime ?? '', block.dueTime ?? '', [...block.assigneeIds].sort().join(',')].join('|');
    groups.set(key, [...(groups.get(key) ?? []), block]);
  }
  const places = new Map<string, BlockPlace>();
  for (const group of groups.values()) {
    const list = [...group].sort((a, b) => a.position - b.position);
    const from = group[0].fromTime ? toMinutes(group[0].fromTime) : null;
    const due = group[0].dueTime ? toMinutes(group[0].dueTime) : null;
    const room = from !== null && due !== null ? due - from : null;
    // A block never lasts longer than its window.
    const length = (block: RoutineBlock) => Math.max(5, room !== null ? Math.min(block.minutes, room) : block.minutes);
    const total = list.reduce((sum, block) => sum + length(block), 0);
    if (room !== null && total > room) {
      for (const block of list) places.set(block.key, { start: toTime(from!), end: toTime(from! + length(block)) });
      continue;
    }
    // From the start of the window, else ending at its end.
    let cursor = from ?? due! - total;
    for (const block of list) {
      places.set(block.key, { start: toTime(cursor), end: toTime(cursor + length(block)) });
      cursor += length(block);
    }
  }
  return places;
}
