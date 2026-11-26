import { describe, expect, it } from 'vitest';
import { GITHUB_SEND_REFUSALS, githubSendRefusal, githubTaskState, goneIssueCloseReason, goneOnGithub, stopsGithubSync } from '../../src/tasks/github';

describe('a failed call to GitHub that stops the whole sync', () => {
  it('GitHub out of reach (network, time out)', () => {
    expect(stopsGithubSync({ network: true })).toBe(true);
  });

  it('token refused, rate limit', () => {
    expect(stopsGithubSync({ status: 401 })).toBe(true);
    expect(stopsGithubSync({ status: 403, rateLimited: true })).toBe(true);
    expect(stopsGithubSync({ status: 429 })).toBe(true);
  });

  it('a 403 that is not the rate limit, a right missing on one resource: one task', () => {
    expect(stopsGithubSync({ status: 403 })).toBe(false);
    expect(stopsGithubSync({ status: 200, graphqlTypes: ['FORBIDDEN'] })).toBe(false);
  });

  it('missing scopes or rate limit told by GraphQL errors, among others', () => {
    expect(stopsGithubSync({ status: 200, graphqlTypes: ['NOT_FOUND', 'INSUFFICIENT_SCOPES'] })).toBe(true);
    expect(stopsGithubSync({ status: 200, graphqlTypes: ['RATE_LIMITED'] })).toBe(true);
  });

  it('any other failure concerns one task', () => {
    expect(stopsGithubSync({})).toBe(false);
    expect(stopsGithubSync({ status: 200, graphqlTypes: ['NOT_FOUND'] })).toBe(false);
    expect(stopsGithubSync({ status: 200, graphqlTypes: [] })).toBe(false);
    expect(stopsGithubSync({ status: 404 })).toBe(false);
    expect(stopsGithubSync({ status: 500 })).toBe(false);
  });
});

describe('a failed call to GitHub saying what it names is gone', () => {
  it('a NOT_FOUND error, among others', () => {
    expect(goneOnGithub({ status: 200, graphqlTypes: ['NOT_FOUND'] })).toBe(true);
    expect(goneOnGithub({ status: 200, graphqlTypes: ['FORBIDDEN', 'NOT_FOUND'] })).toBe(true);
  });

  it('anything else', () => {
    expect(goneOnGithub({})).toBe(false);
    expect(goneOnGithub({ status: 404 })).toBe(false);
    expect(goneOnGithub({ status: 200, graphqlTypes: ['FORBIDDEN'] })).toBe(false);
    expect(goneOnGithub({ network: true })).toBe(false);
  });
});

describe('goneIssueCloseReason: the issue of a task deleted or turned into a routine', () => {
  const closedAt = new Date('2026-11-20T10:00:00Z');

  it('open: closed as not planned', () => {
    expect(goneIssueCloseReason({ closedAt: null, closeReason: null, snapshot: { closed: false } })).toBe('NOT_PLANNED');
    expect(goneIssueCloseReason({ closedAt: null, closeReason: null, snapshot: null })).toBe('NOT_PLANNED');
  });

  it('already closed on GitHub (a done issue stays done): left as it is', () => {
    expect(goneIssueCloseReason({ closedAt, closeReason: 'COMPLETED', snapshot: { closed: 'COMPLETED' } })).toBeNull();
    expect(goneIssueCloseReason({ closedAt: null, closeReason: null, snapshot: { closed: true } })).toBeNull();
  });

  it('the task closed, not yet sent: closed as it was', () => {
    expect(goneIssueCloseReason({ closedAt, closeReason: 'COMPLETED', snapshot: { closed: false } })).toBe('COMPLETED');
    expect(goneIssueCloseReason({ closedAt, closeReason: null, snapshot: null })).toBe('COMPLETED');
    expect(goneIssueCloseReason({ closedAt, closeReason: 'NOT_PLANNED', snapshot: null })).toBe('NOT_PLANNED');
  });
});

describe('GitHub state of a task', () => {
  it('none outside a linked tree', () => {
    expect(githubTaskState({ githubItemId: 'i1', githubContentType: 'ISSUE' }, false)).toBeNull();
  });

  it('on the board, removed from it, or not on GitHub', () => {
    expect(githubTaskState({ githubItemId: 'i1', githubContentType: 'ISSUE' }, true)).toBe('SYNCED');
    expect(githubTaskState({ githubItemId: 'i1', githubContentType: 'DRAFT_ISSUE' }, true)).toBe('SYNCED');
    expect(githubTaskState({ githubItemId: null, githubContentType: 'REMOVED' }, true)).toBe('REMOVED');
    expect(githubTaskState({ githubItemId: null, githubContentType: null }, true)).toBe('NOT_SENT');
    // Left the board with its issue (a transfer), back in the tree: added again at the next sync.
    expect(githubTaskState({ githubItemId: null, githubContentType: 'ISSUE' }, true)).toBe('NOT_SENT');
  });
});

describe('« Envoyer sur GitHub »', () => {
  it('offered for an active task not on GitHub, removed from the board included', () => {
    expect(githubSendRefusal({ archived: false, state: 'NOT_SENT' }, true)).toBeNull();
    expect(githubSendRefusal({ archived: false, state: 'REMOVED' }, true)).toBeNull();
  });

  it('refused outside a linked tree, on GitHub already, archived, GitHub not connected (a link in manual sync accepted)', () => {
    expect(githubSendRefusal({ archived: false, state: null }, true)).toBe(GITHUB_SEND_REFUSALS.unlinked);
    expect(githubSendRefusal({ archived: false, state: 'SYNCED' }, true)).toBe(GITHUB_SEND_REFUSALS.synced);
    expect(githubSendRefusal({ archived: true, state: 'REMOVED' }, true)).toBe(GITHUB_SEND_REFUSALS.archived);
    expect(githubSendRefusal({ archived: false, state: 'NOT_SENT' }, false)).toBe(GITHUB_SEND_REFUSALS.disconnected);
  });
});
