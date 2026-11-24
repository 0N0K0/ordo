import { describe, expect, it } from 'vitest';
import {
  alreadyLinkedComment,
  changedAfter,
  itemIterationValue,
  snapshotIterationValue,
  mergeValues,
  commentToPublish,
  issueAddress,
  itemParentValue,
  mergeFields,
  readdedItemSnapshot,
  remoteChangeDate,
  removedFromBoardComment,
  taskParentValue,
  upgradedSnapshot,
  wasReadded,
  type GithubLinkFields,
  type SyncFields,
} from '../../src/tasks/github-merge';

/**
 * Merge of the parent alone.
 * @param {string | null} local Parent of the task.
 * @param {string | null} remote Parent of the issue.
 * @param {SyncFields | null} snapshot Last snapshot.
 * @param {boolean} [localNewer] The task changed after the item. Optional. Default = false.
 * @returns {ReturnType<typeof mergeFields>} Result.
 */
const mergeParent = (local: string | null, remote: string | null, snapshot: SyncFields | null, localNewer = false) => mergeFields({ parent: local }, { parent: remote }, snapshot, localNewer);

describe('synchronized parent values', () => {
  it('a parent task is its issue, archived or not; without issue it has no counterpart', () => {
    expect(taskParentValue(null, null)).toBeNull();
    expect(taskParentValue('P', 'issue-p')).toBe('issue-p');
    expect(taskParentValue('P', null)).toBe('ordo:P');
  });

  it('a parent issue linked to a task (archived or not) is itself; outside the board it has no counterpart', () => {
    expect(itemParentValue(null, false)).toBeNull();
    expect(itemParentValue('issue-p', true)).toBe('issue-p');
    expect(itemParentValue('issue-x', false)).toBe('gh:issue-x');
  });
});

describe('merge of the parent: both sides end with the same parent', () => {
  it('the same parent on both sides: nothing written', () => {
    expect(mergeParent('p', 'p', { parent: 'p' })).toEqual({ pull: {}, push: {}, snapshot: { parent: 'p' } });
  });

  it('changed in Ordo only: sent to GitHub, whichever side changed last', () => {
    expect(mergeParent('q', 'p', { parent: 'p' }, false)).toEqual({ pull: {}, push: { parent: 'q' }, snapshot: { parent: 'q' } });
  });

  it('changed on GitHub only: taken in Ordo, whichever side changed last', () => {
    expect(mergeParent('p', 'q', { parent: 'p' }, true)).toEqual({ pull: { parent: 'q' }, push: {}, snapshot: { parent: 'q' } });
  });

  it('detached in Ordo: the sub-issue is removed on GitHub', () => {
    expect(mergeParent(null, 'p', { parent: 'p' }, false)).toEqual({ pull: {}, push: { parent: null }, snapshot: { parent: null } });
  });

  it('detached on GitHub: the task loses its parent in Ordo', () => {
    expect(mergeParent('p', null, { parent: 'p' }, true)).toEqual({ pull: { parent: null }, push: {}, snapshot: { parent: null } });
  });

  it('changed on both sides: the side changed last wins', () => {
    expect(mergeParent('q', 'r', { parent: 'p' }, true).push).toEqual({ parent: 'q' });
    expect(mergeParent('q', 'r', { parent: 'p' }, false).pull).toEqual({ parent: 'r' });
  });

  it('without snapshot: a parent wins over none, otherwise the side changed last wins', () => {
    expect(mergeParent('p', null, null, false).push).toEqual({ parent: 'p' });
    expect(mergeParent(null, 'p', null, true).pull).toEqual({ parent: 'p' });
    expect(mergeParent('p', 'q', null, true).push).toEqual({ parent: 'p' });
    expect(mergeParent('p', 'q', null, false).pull).toEqual({ parent: 'q' });
    // A snapshot of a former sync without parent counts as none.
    expect(mergeParent('p', 'q', { title: 'T' }, false).pull).toEqual({ parent: 'q' });
  });

  it('an archived parent is merged like any other: moved away from it on one side, moved on the other', () => {
    const archived = taskParentValue('P', 'issue-p');
    // Moved on GitHub from the archived parent to an active one: taken in Ordo.
    expect(mergeParent(archived, itemParentValue('issue-q', true), { parent: 'issue-p' }, true).pull).toEqual({ parent: 'issue-q' });
    // Moved in Ordo away from the archived parent: sent to GitHub.
    expect(mergeParent('issue-q', itemParentValue('issue-p', true), { parent: 'issue-p' }, false).push).toEqual({ parent: 'issue-q' });
    // Detached from the archived parent on GitHub: detached in Ordo.
    expect(mergeParent(archived, null, { parent: 'issue-p' }, true).pull).toEqual({ parent: null });
    // Placed under an archived parent on GitHub: taken in Ordo (the sync accepts an archived parent).
    expect(mergeParent('issue-q', itemParentValue('issue-p', true), { parent: 'issue-q' }, true)).toEqual({ pull: { parent: 'issue-p' }, push: {}, snapshot: { parent: 'issue-p' } });
    // Taken, the next sync finds the same parent on both sides.
    expect(mergeParent('issue-p', 'issue-p', { parent: 'issue-p' }, true)).toEqual({ pull: {}, push: {}, snapshot: { parent: 'issue-p' } });
    // Only a parent Ordo refuses for another reason (another project tree, under itself) is not written: the task
    // keeps its own, sent back to GitHub at the next sync.
    expect(mergeParent('issue-q', 'issue-p', { parent: 'issue-p' }, true).push).toEqual({ parent: 'issue-q' });
  });

  it('a parent without counterpart is not sent, and not sent again', () => {
    expect(mergeParent(taskParentValue('P', null), null, { parent: null })).toEqual({ pull: {}, push: {}, snapshot: { parent: null } });
    expect(mergeParent(null, itemParentValue('issue-x', false), null)).toEqual({ pull: {}, push: {}, snapshot: { parent: null } });
  });

  it('a parent refused by Ordo against an Ordo parent without issue: nothing to send back', () => {
    const local = taskParentValue('Q', null);
    // Pulled (and refused by Ordo, another project tree for instance: it keeps its own parent).
    expect(mergeParent(local, 'issue-p', { parent: null }, false).pull).toEqual({ parent: 'issue-p' });
    // Next sync: the parent of the task has no counterpart, nothing is sent and the sides stay different.
    expect(mergeParent(local, 'issue-p', { parent: 'issue-p' }, true)).toEqual({ pull: {}, push: {}, snapshot: { parent: 'issue-p' } });
  });
});

describe('links with an archived task: merged like any other value', () => {
  /**
   * Merge of the « bloquée par » links alone.
   * @param {string[]} local Issues blocking the task in Ordo.
   * @param {string[]} remote Issues blocking the issue on GitHub.
   * @param {SyncFields | null} snapshot Last snapshot.
   * @param {boolean} [localNewer] The task changed after the item. Optional. Default = false.
   * @returns {ReturnType<typeof mergeFields>} Result.
   */
  const mergeBlocks = (local: string[], remote: string[], snapshot: SyncFields | null, localNewer = false) => mergeFields({ blockedBy: local }, { blockedBy: remote }, snapshot, localNewer);

  it('the same link on both sides, the blocker archived or not: nothing written', () => {
    expect(mergeBlocks(['issue-archived'], ['issue-archived'], { blockedBy: ['issue-archived'] })).toEqual({ pull: {}, push: {}, snapshot: { blockedBy: ['issue-archived'] } });
  });

  it('removed on GitHub while the blocker is archived: removed in Ordo, even when the task changed last', () => {
    expect(mergeBlocks(['issue-archived'], [], { blockedBy: ['issue-archived'] }, true)).toEqual({ pull: { blockedBy: [] }, push: {}, snapshot: { blockedBy: [] } });
  });

  it('added on GitHub with an archived task: added in Ordo', () => {
    expect(mergeBlocks([], ['issue-archived'], { blockedBy: [] }, true).pull).toEqual({ blockedBy: ['issue-archived'] });
  });

  it('removed in Ordo (an undo, a rule): removed on GitHub', () => {
    expect(mergeBlocks([], ['issue-archived'], { blockedBy: ['issue-archived'] }).push).toEqual({ blockedBy: [] });
  });

  it('first sync of a pair: links joined, nothing dropped', () => {
    expect(mergeFields({ relatesTo: ['issue-a'] }, { relatesTo: ['issue-archived'] }, null, false)).toEqual({
      pull: { relatesTo: ['issue-a', 'issue-archived'] },
      push: { relatesTo: ['issue-a', 'issue-archived'] },
      snapshot: { relatesTo: ['issue-a', 'issue-archived'] },
    });
  });
});

describe('item removed from the board', () => {
  it('the comment of the task gives the day, printed DD/MM/YYYY', () => {
    expect(removedFromBoardComment('2026-11-24')).toBe('Retirée du tableau GitHub le 24/11/2026 : tâche archivée.');
  });
});

describe('archive of a task and of its board item', () => {
  /**
   * Merge of the archived state alone.
   * @param {boolean} local Task archived in Ordo.
   * @param {boolean} remote Item archived on the board.
   * @param {SyncFields | null} snapshot Last snapshot.
   * @param {boolean} [localNewer] The task changed after the item. Optional. Default = false.
   * @returns {ReturnType<typeof mergeFields>} Result.
   */
  const mergeArchived = (local: boolean, remote: boolean, snapshot: SyncFields | null, localNewer = false) => mergeFields({ archived: local }, { archived: remote }, snapshot, localNewer);

  it('archived in Ordo: the item is archived, whichever side changed last', () => {
    expect(mergeArchived(true, false, { archived: false }, false)).toEqual({ pull: {}, push: { archived: true }, snapshot: { archived: true } });
  });

  it('restored in Ordo: the item is taken out of the archive', () => {
    expect(mergeArchived(false, true, { archived: true }, false).push).toEqual({ archived: false });
  });

  it('archived on the board: the task is archived in Ordo', () => {
    expect(mergeArchived(false, true, { archived: false }, true)).toEqual({ pull: { archived: true }, push: {}, snapshot: { archived: true } });
  });

  it('taken out of the archive on the board: the task is restored', () => {
    expect(mergeArchived(true, false, { archived: true }, true).pull).toEqual({ archived: false });
  });

  it('the same state on both sides: nothing written', () => {
    expect(mergeArchived(true, true, { archived: false })).toEqual({ pull: {}, push: {}, snapshot: { archived: true } });
    expect(mergeArchived(false, false, { archived: true })).toEqual({ pull: {}, push: {}, snapshot: { archived: false } });
  });

  it('changed on both sides: the side changed last wins', () => {
    expect(mergeArchived(true, false, { archived: true }, true).pull).toEqual({ archived: false });
    expect(mergeArchived(false, true, { archived: false }, true).pull).toEqual({ archived: true });
  });
});

describe('snapshot of a former sync', () => {
  it('none stays none (first sync of a pair)', () => {
    expect(upgradedSnapshot(null)).toBeNull();
  });

  it('without archived state: the item was not archived, so the side that archived since wins', () => {
    const snapshot = upgradedSnapshot({ title: 'T' });
    expect(snapshot).toEqual({ title: 'T', archived: false });
    // A task archived while its archive was not synchronized: its item is archived.
    expect(mergeFields({ archived: true }, { archived: false }, snapshot, false).push).toEqual({ archived: true });
    // An active task whose item is archived on the board since: archived in Ordo.
    expect(mergeFields({ archived: false }, { archived: true }, snapshot, true).pull).toEqual({ archived: true });
  });

  it('an archived state already there is kept', () => {
    expect(upgradedSnapshot({ archived: true })).toEqual({ archived: true });
  });

  it('closed without its reason: closed as done; other states kept', () => {
    expect(upgradedSnapshot({ closed: true, archived: false })).toEqual({ closed: 'COMPLETED', archived: false });
    expect(upgradedSnapshot({ closed: 'NOT_PLANNED', archived: false })).toEqual({ closed: 'NOT_PLANNED', archived: false });
    expect(upgradedSnapshot({ closed: false, archived: false })).toEqual({ closed: false, archived: false });
  });

  it('the stored snapshot is not changed', () => {
    const stored: SyncFields = { closed: true };
    upgradedSnapshot(stored);
    expect(stored).toEqual({ closed: true });
  });
});

describe('snapshot of an issue added to the board again', () => {
  const none: GithubLinkFields = { statusFieldId: null, priorityFieldId: null, iterationFieldId: null, startFieldId: null, endFieldId: null, deadlineFieldId: null, effortFieldId: null, typeSource: null, typeFieldId: null };
  const all: GithubLinkFields = { statusFieldId: 's', priorityFieldId: 'p', iterationFieldId: 'i', startFieldId: 'a', endFieldId: 'b', deadlineFieldId: 'd', effortFieldId: 'e', typeSource: 'FIELD', typeFieldId: 't' };
  const last: SyncFields = { title: 'T', body: 'B', closed: 'COMPLETED', archived: true, labels: ['x'], parent: 'issue-p', status: 'opt', priority: 'p1', type: 't1', iteration: 'it', start: '2026-11-01', end: '2026-11-02', deadline: '2026-11-03', effort: 3 };

  it('the new item is not archived; the values of the issue keep the last snapshot', () => {
    expect(readdedItemSnapshot(last, none, new Set())).toEqual({ ...last, archived: false, readded: true });
  });

  it('the board fields synchronized start empty on the new item', () => {
    expect(readdedItemSnapshot(last, all, new Set())).toEqual({ title: 'T', body: 'B', closed: 'COMPLETED', archived: false, labels: ['x'], parent: 'issue-p', status: null, priority: null, type: null, iteration: null, start: null, end: null, deadline: null, effort: null, readded: true });
  });

  it('an issue field of the organization is held by the issue: kept', () => {
    const snapshot = readdedItemSnapshot(last, all, new Set(['s', 'd']));
    expect(snapshot.status).toBe('opt');
    expect(snapshot.deadline).toBe('2026-11-03');
    expect(snapshot.priority).toBeNull();
  });

  it('a type from the issue types of the organization is held by the issue: kept', () => {
    expect(readdedItemSnapshot(last, { ...all, typeSource: 'ISSUE_TYPE', typeFieldId: null }, new Set()).type).toBe('t1');
  });

  it('without last snapshot: only what the new item has (first sync for the rest)', () => {
    expect(readdedItemSnapshot(null, { ...none, statusFieldId: 's' }, new Set())).toEqual({ archived: false, status: null, readded: true });
  });

  it('merged with it, the values of the task are sent and those GitHub changed meanwhile are pulled', () => {
    const snapshot = readdedItemSnapshot({ title: 'T', archived: false, status: 'opt' }, { ...none, statusFieldId: 's' }, new Set());
    const result = mergeFields({ title: 'T', archived: true, status: 'opt' }, { title: 'T2', archived: false, status: null }, snapshot, false);
    expect(result.push).toEqual({ archived: true, status: 'opt' });
    expect(result.pull).toEqual({ title: 'T2' });
  });

  it('once the new item is read: what it carries is the reference, so a default of the board does not win', () => {
    const remote: SyncFields = { title: 'T2', archived: false, status: 'todo', priority: null };
    const snapshot = readdedItemSnapshot({ title: 'T', archived: true, status: 'opt' }, { ...none, statusFieldId: 's', priorityFieldId: 'p' }, new Set(), remote);
    expect(snapshot).toEqual({ title: 'T', archived: false, status: 'todo', priority: null, readded: true });
    // The task is newer or not: its values go, the issue change made meanwhile is pulled.
    const result = mergeFields({ title: 'T', archived: false, status: 'doing', priority: null }, remote, snapshot, false);
    expect(result.push).toEqual({ status: 'doing' });
    expect(result.pull).toEqual({ title: 'T2' });
    // A task without value clears the default.
    expect(mergeFields({ status: null }, { status: 'todo' }, snapshot, false).push).toEqual({ status: null });
  });

  it('the stored snapshot is not changed', () => {
    const stored: SyncFields = { archived: true, status: 'opt' };
    readdedItemSnapshot(stored, all, new Set());
    expect(stored).toEqual({ archived: true, status: 'opt' });
  });
});

describe('pair whose issue was added to the board again', () => {
  const link: GithubLinkFields = { statusFieldId: 's', priorityFieldId: null, iterationFieldId: null, startFieldId: null, endFieldId: null, deadlineFieldId: null, effortFieldId: null, typeSource: null, typeFieldId: null };

  it('its stored snapshot is marked until a whole merge writes a new one', () => {
    const stored = readdedItemSnapshot({ title: 'T', status: 'opt' }, link, new Set());
    expect(wasReadded(stored)).toBe(true);
    // The merge writes only the synchronized fields: the mark goes.
    const result = mergeFields({ title: 'T', archived: false, status: 'doing' }, { title: 'T', archived: false, status: 'todo' }, readdedItemSnapshot(stored, link, new Set(), { archived: false, status: 'todo' }), false);
    expect(result.push).toEqual({ status: 'doing' });
    expect(wasReadded(result.snapshot)).toBe(false);
  });

  it('any other snapshot is not marked', () => {
    expect(wasReadded(null)).toBe(false);
    expect(wasReadded({ title: 'T' })).toBe(false);
    expect(wasReadded({ readded: false })).toBe(false);
    expect(wasReadded('readded')).toBe(false);
  });

  it('compared with the last change of the issue, not with the addition of its item', () => {
    const item = { updatedAt: '2026-11-24T10:00:00Z', contentUpdatedAt: '2026-11-20T08:00:00Z' };
    expect(remoteChangeDate(item, true)).toBe('2026-11-20T08:00:00Z');
    expect(remoteChangeDate(item, false)).toBe('2026-11-24T10:00:00Z');
  });
});

describe('address of an issue', () => {
  it('owner, repository and number', () => {
    expect(issueAddress('https://github.com/acme/app/issues/12')).toEqual({ owner: 'acme', name: 'app', number: 12 });
    expect(issueAddress('https://github.com/acme/app/issues/12/')).toEqual({ owner: 'acme', name: 'app', number: 12 });
  });

  it('none for another address', () => {
    expect(issueAddress(null)).toBeNull();
    expect(issueAddress('')).toBeNull();
    expect(issueAddress('https://github.com/acme/app/pull/12')).toBeNull();
    expect(issueAddress('https://github.com/acme/app')).toBeNull();
  });
});

describe('comments published on an issue', () => {
  it('a comment written in Ordo, never sent', () => {
    expect(commentToPublish({ githubCommentId: null, githubAuthor: null })).toBe(true);
  });

  it('not a comment already sent, nor one of someone else whose issue was forgotten', () => {
    expect(commentToPublish({ githubCommentId: 'c1', githubAuthor: null })).toBe(false);
    expect(commentToPublish({ githubCommentId: null, githubAuthor: 'octo' })).toBe(false);
  });
});

describe('issue already linked to another task', () => {
  it('the comment of the task gives the day, printed DD/MM/YYYY', () => {
    expect(alreadyLinkedComment('2026-11-24')).toBe('Déliée de GitHub le 24/11/2026 : son issue est déjà liée à une autre tâche.');
  });
});

describe('values without counterpart in a generic merge', () => {
  it('prefixed values are not applied by default, and are plain values when told so', () => {
    expect(mergeValues(['status'], { status: 'ordo:x' }, { status: 'a' }, { status: 'a' }, true).push).toEqual({});
    expect(mergeValues(['status'], { status: 'ordo:x' }, { status: 'a' }, { status: 'a' }, true, { unmapped: false }).push).toEqual({ status: 'ordo:x' });
  });
});

describe('which side changed last', () => {
  it('dates compared as instants: GitHub dates come without milliseconds', () => {
    expect(changedAfter(new Date('2026-11-24T10:00:00.500Z'), '2026-11-24T10:00:00Z')).toBe(true);
    expect(changedAfter(new Date('2026-11-24T10:00:00.000Z'), '2026-11-24T10:00:00Z')).toBe(false);
    expect(changedAfter(new Date('2026-11-24T09:59:59.900Z'), '2026-11-24T10:00:00Z')).toBe(false);
    expect(changedAfter(new Date('2026-11-24T10:00:00.000Z'), null)).toBe(true);
  });
});

describe('iteration of an item', () => {
  const paired = new Set(['i1']);
  const onBoard = new Set(['i1', 'i2']);

  it('paired with a sprint: itself; without sprint (deleted in Ordo): no counterpart', () => {
    expect(itemIterationValue(null, paired)).toBeNull();
    expect(itemIterationValue('i1', paired)).toBe('i1');
    expect(itemIterationValue('i2', paired)).toBe('gh:i2');
  });

  it('the snapshot: gone from the board, dropped; on the board without sprint, as the item shows it', () => {
    expect(snapshotIterationValue('i1', onBoard, paired)).toBe('i1');
    expect(snapshotIterationValue('i2', onBoard, paired)).toBe('gh:i2');
    expect(snapshotIterationValue('gh:i2', onBoard, paired)).toBe('gh:i2');
    expect(snapshotIterationValue('gone', onBoard, paired)).toBeUndefined();
    expect(snapshotIterationValue('ordo:s1', onBoard, paired)).toBeUndefined();
    expect(snapshotIterationValue(null, onBoard, paired)).toBeNull();
  });

  it('sprint deleted in Ordo: the item loses the iteration; put there on GitHub since: kept', () => {
    const base = snapshotIterationValue('i2', onBoard, paired) as string;
    expect(mergeFields({ iteration: null }, { iteration: itemIterationValue('i2', paired) }, { iteration: base }, false).push).toEqual({ iteration: null });
    const kept = mergeFields({ iteration: 'i1' }, { iteration: itemIterationValue('i2', paired) }, { iteration: 'i1' }, true);
    expect(kept.push).toEqual({});
    expect(kept.pull).toEqual({});
    expect(kept.snapshot).toEqual({ iteration: 'i1' });
  });
});
