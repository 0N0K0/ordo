import { printedDay } from '../dates/days';

/** Fields synchronized between a task and an item of a GitHub board. */
const SYNC_FIELDS = [
  'title',
  'body',
  'closed',
  'archived',
  'status',
  'priority',
  'type',
  'iteration',
  'start',
  'end',
  'deadline',
  'effort',
  'assignees',
  'labels',
  'parent',
  'milestone',
  'blockedBy',
  'relatesTo',
] as const;
type SyncField = (typeof SYNC_FIELDS)[number];
type SyncValue = string | number | boolean | string[] | null;
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
 * Synchronized parent of a task: the issue of its parent task on the board, archived or not (an archived parent is
 * merged like any other, so that both sides always show the same parent), or no counterpart ("ordo:<id>") when its
 * parent has no issue.
 * @param {string | null} parentId Parent task.
 * @param {string | null} parentIssueId Issue of the parent task on the board (archived or not), or null.
 * @returns {string | null} Synchronized value.
 */
export function taskParentValue(parentId: string | null, parentIssueId: string | null): string | null {
  return parentId ? (parentIssueId ?? `ordo:${parentId}`) : null;
}

/**
 * Synchronized parent of an issue: its parent issue when it is linked to a task, archived or not, or no counterpart
 * ("gh:<id>") when it is not (outside the board).
 * @param {string | null} parentIssueId Parent issue on GitHub.
 * @param {boolean} linked The parent issue is linked to a task (archived or not).
 * @returns {string | null} Synchronized value.
 */
export function itemParentValue(parentIssueId: string | null, linked: boolean): string | null {
  return parentIssueId ? (linked ? parentIssueId : `gh:${parentIssueId}`) : null;
}

/**
 * Snapshot of a former sync read as one of today: a state closed without its reason counts as closed as done; a
 * snapshot without archived state was written while the archive was not synchronized (an item archived on the board
 * was then seen as removed): the item was not archived.
 * @param {SyncFields | null} snapshot Snapshot as stored.
 * @returns {SyncFields | null} Snapshot to compare with (a copy).
 */
export function upgradedSnapshot(snapshot: SyncFields | null): SyncFields | null {
  if (!snapshot) return null;
  const upgraded = { ...snapshot };
  if (upgraded.closed === true) upgraded.closed = 'COMPLETED';
  if (!('archived' in upgraded)) upgraded.archived = false;
  return upgraded;
}

/**
 * Comment added to a task whose item was removed from the GitHub board, when it is archived in Ordo.
 * @param {string} day Day of the sync (YYYY-MM-DD, Paris).
 * @returns {string} Comment body, « Retirée du tableau GitHub le JJ/MM/AAAA : tâche archivée. ».
 */
export function removedFromBoardComment(day: string): string {
  return `Retirée du tableau GitHub le ${printedDay(day)} : tâche archivée.`;
}

/**
 * Whether two values are the same (lists regardless of order).
 * @param {SyncValue | undefined} a Value.
 * @param {SyncValue | undefined} b Value.
 * @returns {boolean} Same value.
 */
function sameValue(a: SyncValue | undefined, b: SyncValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().every((item, index) => item === [...b].sort()[index]);
  return (a ?? null) === (b ?? null);
}

interface MergeResult {
  /** Values to write on the task. */
  pull: SyncFields;
  /** Values to write on the item. */
  push: SyncFields;
  /** Values of both sides once synchronized: the next snapshot. */
  snapshot: SyncFields;
}

/**
 * Whether a value is empty (no value, empty list or text).
 * @param {SyncValue} value Value.
 * @returns {boolean} Empty.
 */
const isEmpty = (value: SyncValue) => value === null || value === '' || (Array.isArray(value) && !value.length);

/**
 * Three-way merge, field by field, against the values of the last sync: a field changed on one side only goes
 * to the other; changed on both sides, the side changed last wins. Without snapshot for a field (first sync of
 * a pair, or a field synchronized since), lists are joined and a value wins over an empty one; otherwise the
 * side changed last wins. A value that cannot be applied on the other side is kept in the snapshot as the
 * other side's value, so that it is not sent again and again.
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
    if (base === undefined && Array.isArray(mine) && Array.isArray(theirs)) {
      // Nothing is dropped from either side: both get every value (one not applicable is not sent).
      const joined = [...new Set([...mine, ...theirs])].sort();
      const pulled = joined.filter((value) => !isUnmapped(value, 'gh'));
      const pushed = joined.filter((value) => !isUnmapped(value, 'ordo'));
      if (!sameValue(pulled, mine)) result.pull[field] = pulled;
      if (!sameValue(pushed, theirs)) result.push[field] = pushed;
      result.snapshot[field] = joined.filter((value) => !isUnmapped(value, 'gh') && !isUnmapped(value, 'ordo'));
      continue;
    }
    const pull = base !== undefined ? sameValue(mine, base) || (!sameValue(theirs, base) && !localNewer) : isEmpty(mine) !== isEmpty(theirs) ? isEmpty(mine) : !localNewer;
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
