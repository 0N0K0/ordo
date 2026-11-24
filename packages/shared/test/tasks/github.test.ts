import { describe, expect, it } from 'vitest';
import { goneOnGithub, stopsGithubSync } from '../../src/tasks/github';

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
