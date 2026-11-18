import { sumOf } from '../core/collections';
/** Totals a footer shows under a column: the rows with a value, the sum, average or median of the numbers. */
export const TABLE_AGGREGATES = ['count', 'sum', 'avg', 'median'] as const;
export type TableAggregate = (typeof TABLE_AGGREGATES)[number];

/**
 * Total of a column over some rows.
 * @param {TableAggregate} aggregate Total.
 * @param {readonly (number | string | null | undefined)[]} values Values of the rows (numbers for the sums).
 * @returns {number | null} Total; null when there is no number to sum.
 */
export function aggregateValues(aggregate: TableAggregate, values: readonly (number | string | null | undefined)[]): number | null {
  if (aggregate === 'count') return values.filter((value) => value !== null && value !== undefined && value !== '').length;
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (numbers.length === 0) return null;
  const sum = sumOf(numbers, (value) => value);
  if (aggregate === 'sum') return sum;
  if (aggregate === 'avg') return sum / numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
