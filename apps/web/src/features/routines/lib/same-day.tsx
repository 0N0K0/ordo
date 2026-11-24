import { ArrowsMergeIcon, RowsIcon } from '@phosphor-icons/react';
import { askChoice } from '../../../components/dialogs/ask-choice';
import { GraphQLRequestError } from '../../../lib/graphql-client';
import { dayInWords } from '../../../lib/format';
import { ActionDeclined } from '../../../lib/notify';
import type { RoutineSameDayChoice } from '../../../graphql/graphql';

/**
 * Asks what becomes of an occurrence of a routine moved onto a day that has its own: both kept apart, or merged.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {Promise<RoutineSameDayChoice | null>} Answer, or null when cancelled.
 */
export function askSameDay(day: string): Promise<RoutineSameDayChoice | null> {
  return askChoice<RoutineSameDayChoice>(
    'Deux occurrences le même jour',
    `Le ${dayInWords(day)} a déjà son occurrence. Garder les deux occurrences ce jour-là, chacune avec ses coches et ses commentaires, ou les fusionner en une seule, avec les coches et les commentaires des deux ?`,
    [
      { value: 'KEEP_BOTH', label: 'Garder les deux', icon: <RowsIcon aria-hidden /> },
      { value: 'MERGE', label: 'Fusionner', icon: <ArrowsMergeIcon aria-hidden /> },
    ],
  );
}

/**
 * Runs a move of an occurrence of a routine that the API refuses (CONFIRMATION_REQUIRED, extension `lost.merge`) while
 * it goes onto a day that has its own and nothing says what becomes of both: first without an answer; when refused,
 * asks (`askSameDay`), then runs it again with the answer. Cancelled: `ActionDeclined` (silent in the error toasts; the
 * caller puts back what it showed). Other refusals are passed on.
 * @param {(sameDay?: RoutineSameDayChoice) => Promise<T>} run The move, with or without the answer.
 * @returns {Promise<T>} Its result.
 */
export async function withSameDayChoice<T>(run: (sameDay?: RoutineSameDayChoice) => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const day = error instanceof GraphQLRequestError && error.code === 'CONFIRMATION_REQUIRED' ? (error.extensions.lost as { merge?: string } | undefined)?.merge : undefined;
    if (!day) throw error;
    const choice = await askSameDay(day);
    if (!choice) throw new ActionDeclined();
    return run(choice);
  }
}
