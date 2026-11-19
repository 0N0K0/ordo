import { RateLimiterMemory, RateLimiterPrisma, RateLimiterRes, type RateLimiterAbstract } from 'rate-limiter-flexible';
import { prisma } from '../db';
import { tooManyRequests } from '../graphql/errors';

const MINUTE = 60;

/**
 * Limit counted in the database (table `RateLimit`): a restart does not reset it, and every process of the app shares
 * it. Counted in memory when the database fails, so a limit always applies.
 * @param {string} keyPrefix Name of the limit, prefix of its keys.
 * @param {number} points Attempts allowed.
 * @param {number} duration Window, in seconds.
 * @returns {RateLimiterAbstract} Limiter.
 */
function limiter(keyPrefix: string, points: number, duration: number): RateLimiterAbstract {
  const options = { keyPrefix, points, duration };
  return new RateLimiterPrisma({ ...options, storeClient: prisma, tableName: 'rateLimit', insuranceLimiter: new RateLimiterMemory(options) });
}

/** Failed logins, per IP. */
export const loginLimiter = limiter('login', 5, 15 * MINUTE);

/**
 * Failed logins on one identifier, wherever they come from. Far above what one address may try: a stranger cannot
 * lock the account by failing a few times, and an attack spread over many addresses is still stopped.
 */
export const loginIdentifierLimiter = limiter('login-id', 100, 15 * MINUTE);

/** Password reset requests, per IP. */
export const resetRequestLimiter = limiter('reset', 3, 60 * MINUTE);

/** Current-password checks on account changes, per user. */
export const passwordCheckLimiter = limiter('pwcheck', 5, 15 * MINUTE);

/**
 * Consumes one point for each key, throwing a GraphQL error once a limit is reached.
 * @param {RateLimiterAbstract} limit Limiter to consume.
 * @param {string[]} keys Keys to consume (e.g. IP and identifier).
 * @returns {Promise<void>}
 */
export async function consume(limit: RateLimiterAbstract, ...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => limit.consume(key)));
  } catch (error) {
    if (error instanceof RateLimiterRes) throw tooManyRequests(Math.ceil(error.msBeforeNext / 1000));
    throw error;
  }
}

/**
 * Resets the counters of the given keys (after a successful attempt).
 * @param {RateLimiterAbstract} limit Limiter to reset.
 * @param {string[]} keys Keys to reset.
 * @returns {Promise<void>}
 */
export async function reset(limit: RateLimiterAbstract, ...keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => limit.delete(key)));
}
