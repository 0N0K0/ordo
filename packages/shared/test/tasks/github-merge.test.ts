import { describe, expect, it } from 'vitest';
import { itemParentValue, mergeFields, removedFromBoardComment, taskParentValue, upgradedSnapshot, type SyncFields } from '../../src/tasks/github-merge';

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
