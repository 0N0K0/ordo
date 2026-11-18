import { Prisma } from '../../generated/prisma/client';

/**
 * Decimal column value of a number (a quantity, an amount…); none stays none.
 * @param {number | null} value Number.
 * @returns {Prisma.Decimal | null} Decimal.
 */
export function toDecimal(value: number): Prisma.Decimal;
export function toDecimal(value: number | null): Prisma.Decimal | null;
export function toDecimal(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

/**
 * Number of a decimal column value; none stays none (`fromDecimal(value) ?? 0` where none counts as 0).
 * @param {{ toNumber(): number } | null} value Decimal.
 * @returns {number | null} Number.
 */
export function fromDecimal(value: { toNumber(): number }): number;
export function fromDecimal(value: { toNumber(): number } | null): number | null;
export function fromDecimal(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}
