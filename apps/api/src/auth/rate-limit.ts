import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { tooManyRequests } from '../graphql/errors';

const MINUTE = 60;

/** Failed logins, per IP and per identifier. */
export const loginLimiter = new RateLimiterMemory({ keyPrefix: 'login', points: 5, duration: 15 * MINUTE });

/** Password reset requests, per IP. */
export const resetRequestLimiter = new RateLimiterMemory({ keyPrefix: 'reset', points: 3, duration: 60 * MINUTE });

/** Current-password checks on account changes, per user. */
export const passwordCheckLimiter = new RateLimiterMemory({ keyPrefix: 'pwcheck', points: 5, duration: 15 * MINUTE });

/**
 * Consumes one point for each key, throwing a GraphQL error once a limit is reached.
 * @param {RateLimiterMemory} limiter Limiter to consume.
 * @param {string[]} keys Keys to consume (e.g. IP and identifier).
 * @returns {Promise<void>}
 */
export async function consume(limiter: RateLimiterMemory, ...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => limiter.consume(key)));
  } catch (error) {
    if (error instanceof RateLimiterRes) throw tooManyRequests(Math.ceil(error.msBeforeNext / 1000));
    throw error;
  }
}

/**
 * Resets the counters of the given keys (after a successful attempt).
 * @param {RateLimiterMemory} limiter Limiter to reset.
 * @param {string[]} keys Keys to reset.
 * @returns {Promise<void>}
 */
export async function reset(limiter: RateLimiterMemory, ...keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => limiter.delete(key)));
}
