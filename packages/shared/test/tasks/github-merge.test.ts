import { describe, expect, it } from 'vitest';
import { itemParentValue, mergeFields, taskParentValue, type SyncFields } from '../../src/tasks/github-merge';

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
    // Placed under an archived parent on GitHub: taken (Ordo refuses an archived parent, keeps its own and sends it back).
    expect(mergeParent('issue-q', itemParentValue('issue-p', true), { parent: 'issue-q' }, true)).toEqual({ pull: { parent: 'issue-p' }, push: {}, snapshot: { parent: 'issue-p' } });
    // Refused in Ordo, the next sync sends the parent of the task back to GitHub.
    expect(mergeParent('issue-q', 'issue-p', { parent: 'issue-p' }, true).push).toEqual({ parent: 'issue-q' });
  });

  it('a parent without counterpart is not sent, and not sent again', () => {
    expect(mergeParent(taskParentValue('P', null), null, { parent: null })).toEqual({ pull: {}, push: {}, snapshot: { parent: null } });
    expect(mergeParent(null, itemParentValue('issue-x', false), null)).toEqual({ pull: {}, push: {}, snapshot: { parent: null } });
  });

  it('an archived parent on GitHub against an Ordo parent without issue: refused in Ordo, nothing to send back', () => {
    const local = taskParentValue('Q', null);
    // Pulled (and refused by Ordo, which keeps its own parent).
    expect(mergeParent(local, 'issue-p', { parent: null }, false).pull).toEqual({ parent: 'issue-p' });
    // Next sync: the parent of the task has no counterpart, nothing is sent and the sides stay different.
    expect(mergeParent(local, 'issue-p', { parent: 'issue-p' }, true)).toEqual({ pull: {}, push: {}, snapshot: { parent: 'issue-p' } });
  });
});
