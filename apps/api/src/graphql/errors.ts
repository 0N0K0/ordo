import { GraphQLError } from 'graphql';
import type { z } from 'zod';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'BAD_USER_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE';

/**
 * Error thrown when a requested record does not exist.
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @returns {GraphQLError} NOT_FOUND error.
 */
export function notFound(what: string): GraphQLError {
  return clientError('NOT_FOUND', `${what} introuvable.`);
}

/**
 * Creates a GraphQL error exposed to the client (not masked by Yoga).
 * @param {ErrorCode} code Machine-readable code.
 * @param {string} message Human-readable message.
 * @param {Record<string, unknown>} [extensions] Extra extensions. Optional.
 * @returns {GraphQLError} Error to throw.
 */
export function clientError(code: ErrorCode, message: string, extensions?: Record<string, unknown>): GraphQLError {
  return new GraphQLError(message, { extensions: { code, ...extensions } });
}

/**
 * Error thrown when a field requires an authenticated session.
 * @returns {GraphQLError} UNAUTHENTICATED error.
 */
export function unauthenticated(): GraphQLError {
  return clientError('UNAUTHENTICATED', 'Connexion requise.');
}

/**
 * Error thrown when a rate limit is reached.
 * @param {number} retryAfter Seconds before a new attempt is allowed.
 * @returns {GraphQLError} TOO_MANY_REQUESTS error.
 */
export function tooManyRequests(retryAfter: number): GraphQLError {
  const minutes = Math.ceil(retryAfter / 60);
  return clientError('TOO_MANY_REQUESTS', `Trop de tentatives. Réessayez dans ${minutes} min.`, { retryAfter });
}

/**
 * Parses input with a zod schema, throwing BAD_USER_INPUT with per-field messages.
 * @param {T} schema Zod schema.
 * @param {unknown} input Raw input.
 * @returns {z.output<T>} Parsed value.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    fields[path] ??= issue.message;
  }
  throw clientError('BAD_USER_INPUT', 'Certains champs sont invalides.', { fields });
}
