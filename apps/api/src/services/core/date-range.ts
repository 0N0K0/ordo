import { END_AFTER_START, parseOptionalDay } from '@ordo/shared';
import { fieldError } from '../../graphql/errors';

/**
 * Checks the start and end days of an item, the days sent merged with those it has (an omitted day is unchanged):
 * the end does not come before the start (error under the field of the end).
 * @param {{ startDate?: string | null, endDate?: string | null }} changes Days sent (YYYY-MM-DD; null clears, undefined keeps).
 * @param {{ startDate: Date | null, endDate: Date | null }} [current] Days it has. Optional. Default = a new item.
 * @param {string} [field='endDate'] Field of the end in the input (« deadline » for the « Échéance » of a task). Optional. Default = « endDate ».
 * @returns {void}
 */
export function assertDateRange(changes: { startDate?: string | null; endDate?: string | null }, current?: { startDate: Date | null; endDate: Date | null }, field = 'endDate'): void {
  const startDate = changes.startDate === undefined ? current?.startDate : parseOptionalDay(changes.startDate);
  const endDate = changes.endDate === undefined ? current?.endDate : parseOptionalDay(changes.endDate);
  if (startDate && endDate && endDate < startDate) throw fieldError(field, END_AFTER_START);
}
