import { END_AFTER_START, parseOptionalDay } from '@ordo/shared';
import { fieldError } from '../../graphql/errors';

/**
 * Checks the start and end days of an item, the days sent merged with those it has (an omitted day is unchanged):
 * the end does not come before the start (« endDate » error).
 * @param {{ startDate?: string | null, endDate?: string | null }} changes Days sent (YYYY-MM-DD; null clears, undefined keeps).
 * @param {{ startDate: Date | null, endDate: Date | null }} [current] Days it has. Optional. Default = a new item.
 * @returns {void}
 */
export function assertDateRange(changes: { startDate?: string | null; endDate?: string | null }, current?: { startDate: Date | null; endDate: Date | null }): void {
  const startDate = changes.startDate === undefined ? current?.startDate : parseOptionalDay(changes.startDate);
  const endDate = changes.endDate === undefined ? current?.endDate : parseOptionalDay(changes.endDate);
  if (startDate && endDate && endDate < startDate) throw fieldError('endDate', END_AFTER_START);
}
