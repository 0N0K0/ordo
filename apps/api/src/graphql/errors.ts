import { UserError } from '@ordo/shared';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';

type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'BAD_USER_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'CONFIRMATION_REQUIRED';

/**
 * Error thrown when a requested record does not exist: « X introuvable. », attached to a form field when one is given.
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @param {string} [field] Form field the error is attached to (BAD_USER_INPUT). Optional. Default = NOT_FOUND error.
 * @returns {GraphQLError} NOT_FOUND error, or BAD_USER_INPUT error of the field.
 */
export function notFound(what: string, field?: string): GraphQLError {
  // eslint-disable-next-line no-restricted-syntax -- notFound itself.
  return field ? fieldError(field, `${what} introuvable.`) : clientError('NOT_FOUND', `${what} introuvable.`);
}

/**
 * Whether an error is a unique constraint violation (a name, a number… already taken).
 * @param {unknown} error Caught error.
 * @returns {boolean} A P2002 error.
 */
export function isUniqueConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Rethrows a caught error, a unique constraint violation turned into an error of the field taken.
 * @param {unknown} error Caught error.
 * @param {string} message Message (« Un statut porte déjà ce libellé. »).
 * @param {string} [field] Field taken. Optional. Default = « label ».
 * @returns {never}
 */
export function rethrowUnique(error: unknown, message: string, field = 'label'): never {
  if (isUniqueConflict(error)) throw clientError('CONFLICT', message, { fields: { [field]: message } });
  throw error;
}

/**
 * Record a query found, or NOT_FOUND when there is none (the error of a form field when one is given).
 * @param {PromiseLike<T | null>} query Query (a `findUnique`, a `findFirst`…).
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @param {string} [field] Form field the error is attached to (BAD_USER_INPUT). Optional. Default = NOT_FOUND error.
 * @returns {Promise<T>} Record.
 */
export async function orNotFound<T>(query: PromiseLike<T | null>, what: string, field?: string): Promise<T> {
  const record = await query;
  if (record === null || record === undefined) throw notFound(what, field);
  return record;
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
 * BAD_USER_INPUT error attached to a form field.
 * @param {string} field Field name (a path like « lines.0.categoryId » for nested fields).
 * @param {string} message Human-readable reason.
 * @param {string} [fieldMessage] Shorter message shown under the field. Optional. Default = `message`.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
export function fieldError(field: string, message: string, fieldMessage: string = message): GraphQLError {
  return clientError('BAD_USER_INPUT', message, { fields: { [field]: fieldMessage } });
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
 * Parses one field with its schema, its message under the field when refused (`parseInput` of a one-field object).
 * @param {string} field Field name (where the message goes).
 * @param {T} schema Zod schema of the field.
 * @param {unknown} value Raw value.
 * @returns {z.output<T>} Parsed value.
 */
export function parseField<T extends z.ZodType>(field: string, schema: T, value: unknown): z.output<T> {
  return (parseInput(z.object({ [field]: schema }), { [field]: value }) as Record<string, z.output<T>>)[field];
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

/**
 * Result of a mutation that answers true once its work is done.
 * @param {Promise<unknown>} work Work.
 * @returns {Promise<true>} True.
 */
export async function done(work: Promise<unknown>): Promise<true> {
  await work;
  return true;
}

/**
 * Message of a caught error, whatever was thrown.
 * @param {unknown} error Caught error.
 * @returns {string} Its message, or the thrown value as text.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Refusal of a shared computation (`UserError`, its message written for the user) as the client error it is
 * (`BAD_USER_INPUT`); any other error as it is. The one place the API maps them: GraphQL answers and file routes.
 * @param {unknown} error Error caught.
 * @returns {unknown} Client error, or the error.
 */
export function sharedRefusal(error: unknown): unknown {
  const original = error instanceof GraphQLError && error.originalError ? error.originalError : error;
  return original instanceof UserError ? clientError('BAD_USER_INPUT', original.message) : error;
}

/**
 * Message of a caught error that the user may read: that of an error of a service (a GraphQLError, written for them),
 * else the fallback, the error itself logged (a bug, a crash: its raw text is not for the user).
 * @param {unknown} error Caught error.
 * @param {string} fallback Message shown for any other error.
 * @param {string} context What failed, for the log.
 * @returns {string} Message.
 */
export function userErrorMessage(error: unknown, fallback: string, context: string): string {
  if (error instanceof GraphQLError) return error.message;
  console.error(context, error);
  return fallback;
}
