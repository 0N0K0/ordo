import { exceptionText, SKIPPED_KIND, type ExceptionLine } from '../../../components/recurrence/exceptions';
import * as fmt from '../../../lib/format';
import type { EventException } from '../api';

/**
 * What an occurrence of a series deleted, cancelled or changed alone is, in the words of every exceptions summary:
 * « rien » (deleted), « annulée », « reportée au ven. 6 nov. », « déplacée au ven. 6 nov. », « autres horaires »,
 * « modifiée », joined by commas.
 * @param {EventException} exception Exception.
 * @returns {string} Text.
 */
export function eventExceptionKind(exception: EventException): string {
  if (exception.cancelled) return SKIPPED_KIND;
  if (exception.postponedTo) return `reportée au ${fmt.weekday(exception.postponedTo)}`;
  const kinds = [
    ...(exception.calledOff ? ['annulée'] : []),
    ...(exception.startDate !== exception.date ? [`déplacée au ${fmt.weekday(exception.startDate)}`] : []),
    ...(exception.otherHours ? ['autres horaires'] : []),
    ...(exception.changed ? ['modifiée'] : []),
  ];
  return kinds.length ? kinds.join(', ') : 'modifiée';
}

/**
 * Occurrences of a series deleted, cancelled or changed alone, as exception lines.
 * @param {readonly EventException[]} exceptions Exceptions.
 * @returns {ExceptionLine[]} Lines.
 */
export const eventExceptionLines = (exceptions: readonly EventException[]): ExceptionLine[] =>
  exceptions.map((exception) => ({ key: `event-${exception.date}`, day: exception.date, text: exceptionText(exception.date, eventExceptionKind(exception)) }));
