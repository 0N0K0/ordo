/** Fields synchronized between a task and an item of a GitHub board. */
export const SYNC_FIELDS = ['title', 'body', 'closed', 'status', 'priority', 'iteration', 'start', 'end', 'effort', 'assignees', 'labels', 'parent'] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];
export type SyncValue = string | number | boolean | string[] | null;
/** Values of the synchronized fields, in a shape common to both sides (absent: not synchronized). */
export type SyncFields = Partial<Record<SyncField, SyncValue>>;

/**
 * Value with no counterpart on the other side: an Ordo status, priority or sprint without GitHub option or
 * iteration ("ordo:<id>"), or a GitHub option without Ordo status or priority ("gh:<id>").
 * @param {SyncValue | undefined} value Value.
 * @param {'ordo' | 'gh'} side Side the value cannot leave.
 * @returns {boolean} True when it cannot be applied to the other side.
 */
export function isUnmapped(value: SyncValue | undefined, side: 'ordo' | 'gh'): boolean {
  return typeof value === 'string' && value.startsWith(`${side}:`);
}

/**
 * Whether two values are the same (lists regardless of order).
 * @param {SyncValue | undefined} a Value.
 * @param {SyncValue | undefined} b Value.
 * @returns {boolean} Same value.
 */
export function sameValue(a: SyncValue | undefined, b: SyncValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().every((item, index) => item === [...b].sort()[index]);
  return (a ?? null) === (b ?? null);
}

export interface MergeResult {
  /** Values to write on the task. */
  pull: SyncFields;
  /** Values to write on the item. */
  push: SyncFields;
  /** Values of both sides once synchronized: the next snapshot. */
  snapshot: SyncFields;
}

/**
 * Three-way merge, field by field, against the values of the last sync: a field changed on one side only goes
 * to the other; changed on both sides, the side changed last wins. Without snapshot (first sync of a pair),
 * the side changed last wins every differing field. A value that cannot be applied on the other side is
 * kept in the snapshot as the other side's value, so that it is not sent again and again.
 * @param {SyncFields} local Values of the task.
 * @param {SyncFields} remote Values of the item.
 * @param {SyncFields | null} snapshot Values at the last sync.
 * @param {boolean} localNewer The task changed after the item.
 * @returns {MergeResult} Changes on each side and new snapshot.
 */
export function mergeFields(local: SyncFields, remote: SyncFields, snapshot: SyncFields | null, localNewer: boolean): MergeResult {
  const result: MergeResult = { pull: {}, push: {}, snapshot: {} };
  for (const field of SYNC_FIELDS) {
    if (!(field in local) || !(field in remote)) continue;
    const mine = local[field] ?? null;
    const theirs = remote[field] ?? null;
    if (sameValue(mine, theirs)) {
      result.snapshot[field] = mine;
      continue;
    }
    const base = snapshot && field in snapshot ? (snapshot[field] ?? null) : undefined;
    const pull = base !== undefined ? sameValue(mine, base) || (!sameValue(theirs, base) && !localNewer) : !localNewer;
    if (pull) {
      if (isUnmapped(theirs, 'gh')) {
        result.snapshot[field] = mine;
      } else {
        result.pull[field] = theirs;
        result.snapshot[field] = theirs;
      }
    } else if (isUnmapped(mine, 'ordo')) {
      result.snapshot[field] = theirs;
    } else {
      result.push[field] = mine;
      result.snapshot[field] = mine;
    }
  }
  return result;
}
