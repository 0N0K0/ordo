import type { Prisma } from '../../generated/prisma/client';

/**
 * A value checked by its schema, as Prisma stores it in a JSON column: the one cast of the JSON writes.
 * @param {unknown} value Value (already parsed: plain objects, arrays, strings, numbers, booleans, null inside).
 * @returns {Prisma.InputJsonValue} Value to store.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  // eslint-disable-next-line no-restricted-syntax -- toJson itself.
  return value as Prisma.InputJsonValue;
}
