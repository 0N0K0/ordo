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
/** A synchronized value. */
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
 * Whether the Ordo side changed after the GitHub side, the dates compared as instants (GitHub gives them without
 * milliseconds: compared as texts, a change made in the same second would look older).
 * @param {Date} local Last change on the Ordo side.
 * @param {string | null} remote Last change on the GitHub side (ISO), or null when unknown.
 * @returns {boolean} Ordo changed later (true when the GitHub date is unknown).
 */
export function changedAfter(local: Date, remote: string | null): boolean {
  if (!remote) return true;
  const time = new Date(remote).getTime();
  return Number.isNaN(time) || local.getTime() > time;
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
 * Synchronized iteration of an item: the iteration itself when a sprint is paired with it, or no counterpart
 * ("gh:<id>") when none is (its sprint deleted in Ordo): a GitHub user putting an item in it is not undone, and the task
 * keeps its sprints.
 * @param {string | null} iterationId Iteration of the item.
 * @param {{ has: (id: string) => boolean }} paired Iterations paired with a sprint.
 * @returns {string | null} Synchronized value.
 */
export function itemIterationValue(iterationId: string | null, paired: { has: (id: string) => boolean }): string | null {
  return iterationId ? (paired.has(iterationId) ? iterationId : `gh:${iterationId}`) : null;
}

/**
 * Iteration of the last snapshot of a pair read as today: gone from the board, it is no reference (undefined: dropped,
 * the sprint of the task wins); still on the board without sprint, it is the value the item shows for it ("gh:<id>",
 * `itemIterationValue`), so that the item of a sprint deleted in Ordo loses it.
 * @param {SyncValue | undefined} value Iteration in the snapshot.
 * @param {{ has: (id: string) => boolean }} onBoard Iterations of the field.
 * @param {{ has: (id: string) => boolean }} paired Iterations paired with a sprint.
 * @returns {SyncValue | undefined} Value to compare with, or undefined to drop it.
 */
export function snapshotIterationValue(value: SyncValue | undefined, onBoard: { has: (id: string) => boolean }, paired: { has: (id: string) => boolean }): SyncValue | undefined {
  if (typeof value !== 'string') return value;
  const id = value.startsWith('gh:') ? value.slice(3) : value;
  if (!onBoard.has(id)) return undefined;
  return itemIterationValue(id, paired);
}

/** Board fields a link synchronizes, by Ordo field (null: not synchronized), and where its type comes from. */
export interface GithubLinkFields {
  statusFieldId: string | null;
  priorityFieldId: string | null;
  iterationFieldId: string | null;
  startFieldId: string | null;
  endFieldId: string | null;
  deadlineFieldId: string | null;
  effortFieldId: string | null;
  typeSource: string | null;
  typeFieldId: string | null;
}

/**
 * Snapshot of a task whose issue is added to the board again (it had left it with its task, the task is back): the
 * values the item itself carries (its archive; the board fields, an issue field of the organization aside) are those
 * of the new item, so that a value of the task that differs is sent (the new item has none of its own: what it shows,
 * a default set by the board, does not win); the values of the issue (title, body, state, labels, parent, issue
 * fields…) keep the last snapshot, the issue being the same. Marked `readded` (`wasReadded`): stored when the issue is
 * linked again, the pair is merged so until a whole merge has written a new snapshot (without the mark).
 * @param {SyncFields | null} snapshot Last snapshot of the task, if any.
 * @param {GithubLinkFields} link Fields the link synchronizes.
 * @param {ReadonlySet<string>} issueFieldIds Board fields that are issue fields of the organization (held by the issue).
 * @param {SyncFields} [onItem] Values of the new item, once read. Optional. Default = not read yet: empty, not archived.
 * @returns {ReaddedSnapshot} Snapshot to merge the new item with (a copy), marked.
 */
export function readdedItemSnapshot(snapshot: SyncFields | null, link: GithubLinkFields, issueFieldIds: ReadonlySet<string>, onItem: SyncFields = {}): ReaddedSnapshot {
  const onBoard = (fieldId: string | null) => Boolean(fieldId) && !issueFieldIds.has(fieldId!);
  const held: [SyncField, boolean][] = [
    ['status', onBoard(link.statusFieldId)],
    ['priority', onBoard(link.priorityFieldId)],
    ['type', link.typeSource === 'FIELD' && onBoard(link.typeFieldId)],
    ['iteration', onBoard(link.iterationFieldId)],
    ['start', onBoard(link.startFieldId)],
    ['end', onBoard(link.endFieldId)],
    ['deadline', onBoard(link.deadlineFieldId)],
    ['effort', onBoard(link.effortFieldId)],
  ];
  return { ...snapshot, archived: onItem.archived ?? false, ...Object.fromEntries(held.filter(([, carried]) => carried).map(([field]) => [field, onItem[field] ?? null])), readded: true };
}

/** Snapshot of a pair whose issue was added to the board again, not merged in full since (`readdedItemSnapshot`). */
export type ReaddedSnapshot = SyncFields & { readded?: boolean };

/**
 * Whether a stored snapshot is the one of an issue added to the board again, its pair not merged in full since.
 * @param {unknown} snapshot Stored snapshot.
 * @returns {boolean} Marked `readded`.
 */
export function wasReadded(snapshot: unknown): boolean {
  return typeof snapshot === 'object' && snapshot !== null && (snapshot as ReaddedSnapshot).readded === true;
}

/**
 * Date of the last change of an item that the merge compares with the task: the item's or its content's, whichever is
 * later; for an issue just added to the board again, the issue's own (the new item's date is that of the addition,
 * no change made on GitHub).
 * @param {{ updatedAt: string, contentUpdatedAt: string }} item Dates of the item (latest of the item and its content) and of its content.
 * @param {boolean} readded The issue was just added to the board again.
 * @returns {string} Date (ISO).
 */
export function remoteChangeDate(item: { updatedAt: string; contentUpdatedAt: string }, readded: boolean): string {
  return readded ? item.contentUpdatedAt : item.updatedAt;
}

/**
 * Owner, repository and number of an issue from its address (https://github.com/<owner>/<repository>/issues/<n>, any host).
 * @param {string | null} url Address of the issue.
 * @returns {{ owner: string, name: string, number: number } | null} Parts, or null for another address.
 */
export function issueAddress(url: string | null): { owner: string; name: string; number: number } | null {
  const match = url ? /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(url) : null;
  return match ? { owner: match[1], name: match[2], number: Number(match[3]) } : null;
}

/**
 * Whether an Ordo comment is to be published on its issue: never sent, and written in Ordo (a comment pulled from
 * GitHub whose issue was forgotten keeps its author and stays in Ordo only, never published again under the account
 * connected).
 * @param {{ githubCommentId: string | null, githubAuthor: string | null }} comment Comment.
 * @returns {boolean} To publish.
 */
export function commentToPublish(comment: { githubCommentId: string | null; githubAuthor: string | null }): boolean {
  return !comment.githubCommentId && !comment.githubAuthor;
}

/**
 * Comment added to a task back in the tree of a board whose issue is linked to another task meanwhile: the task is no
 * longer linked to GitHub (not archived).
 * @param {string} day Day of the sync (YYYY-MM-DD, Paris).
 * @returns {string} Comment body, « Déliée de GitHub le JJ/MM/AAAA : son issue est déjà liée à une autre tâche. ».
 */
export function alreadyLinkedComment(day: string): string {
  return `Déliée de GitHub le ${printedDay(day)} : son issue est déjà liée à une autre tâche.`;
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

/** Changes of the merge of a task and its item: values to write on the task (`pull`), on the item (`push`), next snapshot. */
type MergeResult = MergedValues<SyncField>;

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
  return mergeValues(SYNC_FIELDS, local, remote, snapshot, localNewer);
}

/** Changes of a three-way merge of some fields (`mergeValues`). */
export interface MergedValues<K extends string> {
  /** Values to write on the Ordo side. */
  pull: Partial<Record<K, SyncValue>>;
  /** Values to write on the GitHub side. */
  push: Partial<Record<K, SyncValue>>;
  /** Values of both sides once synchronized: the next snapshot. */
  snapshot: Partial<Record<K, SyncValue>>;
}

/**
 * Three-way merge of the given fields, as `mergeFields` does for the fields of a task (the same rules for any pair of
 * records synchronized with GitHub, a sprint and its iteration among them).
 * @param {readonly K[]} fields Fields compared (absent from one side: not synchronized).
 * @param {Partial<Record<K, SyncValue>>} local Values of the Ordo side.
 * @param {Partial<Record<K, SyncValue>>} remote Values of the GitHub side.
 * @param {Partial<Record<K, SyncValue>> | null} snapshot Values at the last sync.
 * @param {boolean} localNewer The Ordo side changed after the GitHub side.
 * @param {{ unmapped?: boolean }} [options] Options. Optional.
 * @param {boolean} [options.unmapped] Values prefixed `ordo:` / `gh:` have no counterpart (`isUnmapped`); false for
 * plain texts (a title may start so). Optional. Default = true.
 * @returns {MergedValues<K>} Changes on each side and new snapshot.
 */
export function mergeValues<K extends string>(
  fields: readonly K[],
  local: Partial<Record<K, SyncValue>>,
  remote: Partial<Record<K, SyncValue>>,
  snapshot: Partial<Record<K, SyncValue>> | null,
  localNewer: boolean,
  { unmapped = true }: { unmapped?: boolean } = {},
): MergedValues<K> {
  const noCounterpart = (value: SyncValue | undefined, side: 'ordo' | 'gh') => unmapped && isUnmapped(value, side);
  const result: MergedValues<K> = { pull: {}, push: {}, snapshot: {} };
  for (const field of fields) {
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
      const pulled = joined.filter((value) => !noCounterpart(value, 'gh'));
      const pushed = joined.filter((value) => !noCounterpart(value, 'ordo'));
      if (!sameValue(pulled, mine)) result.pull[field] = pulled;
      if (!sameValue(pushed, theirs)) result.push[field] = pushed;
      result.snapshot[field] = joined.filter((value) => !noCounterpart(value, 'gh') && !noCounterpart(value, 'ordo'));
      continue;
    }
    const pull = base !== undefined ? sameValue(mine, base) || (!sameValue(theirs, base) && !localNewer) : isEmpty(mine) !== isEmpty(theirs) ? isEmpty(mine) : !localNewer;
    if (pull) {
      if (noCounterpart(theirs, 'gh')) {
        result.snapshot[field] = mine;
      } else {
        result.pull[field] = theirs;
        result.snapshot[field] = theirs;
      }
    } else if (noCounterpart(mine, 'ordo')) {
      result.snapshot[field] = theirs;
    } else {
      result.push[field] = mine;
      result.snapshot[field] = mine;
    }
  }
  return result;
}
