import { hasOccurrenceAfter, ruleEndedBefore, storedRecurrence } from '@ordo/shared';
import { deleteItemsAction, rowLabel, runAction } from '../../../components/data-table/selection/selection-actions';
import { askScope } from '../../../components/recurrence/ask-scope';
import { withSkipped } from '../../../components/recurrence/exceptions';
import { useEntryCellSave } from '../lib/entry-values';
import * as fmt from '../../../lib/format';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { useTreasuryMutations, type ForecastEntry, type TreasuryEntry } from '../api';

/**
 * « Supprimer » of the entries of the treasury, the same texts on a row and on a selection: movements (the documents
 * they settle due again), forecasts (with all their repetitions).
 * @returns {{ movements: (rows: TreasuryEntry[], clear?: () => void) => SelectionAction, forecasts: (rows: TreasuryEntry[], clear?: () => void, note?: string) => SelectionAction }} Actions.
 */
export function useDeleteEntries() {
  const { deleteEntry } = useTreasuryMutations();
  /**
   * Deletes an entry.
   * @param {TreasuryEntry} entry Entry.
   * @returns {Promise<unknown>} Done.
   */
  const remove = (entry: TreasuryEntry) => deleteEntry.mutateAsync(entry.id);
  return {
    movements: (rows: TreasuryEntry[], clear?: () => void): SelectionAction =>
      deleteItemsAction(rows, {
        noun: 'mouvement',
        the: 'le mouvement',
        label: rowLabel,
        risks: (subject, one, entries) =>
          [
            `${subject} ${one ? 'sera supprimé' : 'seront supprimés'} définitivement.`,
            entries.some((entry) => entry.allocations.length) ? `Les documents qu’${one ? 'il règle' : 'ils règlent'} redeviendront dus.` : '',
            entries.some((entry) => entry.linkedEntries.length) ? `${one ? 'Ses' : 'Leurs'} liens avec d’autres mouvements seront retirés.` : '',
          ]
            .filter(Boolean)
            .join(' '),
        remove,
        clear,
      }),
    forecasts: (rows: TreasuryEntry[], clear?: () => void, note = ''): SelectionAction =>
      deleteItemsAction(rows, {
        noun: 'prévision',
        feminine: true,
        the: 'la prévision',
        label: rowLabel,
        risks: (subject, one) => `${subject} et toutes ${one ? 'ses' : 'leurs'} répétitions seront supprimées${note}.`,
        remove,
        clear,
      }),
  };
}

/**
 * « Supprimer » from an occurrence of a forecast: a repeated one asks which occurrences (`askScope`): this one (a
 * « rien » exception of its rule), it and the following ones (its rule ends before it, the previous ones untouched; not
 * offered on its last one), or all of them; all, or from its first one, delete the forecast itself (its usual
 * confirmation). A forecast that does not repeat is deleted as one.
 * @returns {(entry: ForecastEntry, day: string) => Promise<void>} Deletion from the occurrence of a day.
 */
export function useDeleteForecastOccurrence(): (entry: ForecastEntry, day: string) => Promise<void> {
  const { forecasts } = useDeleteEntries();
  const save = useEntryCellSave();
  return async (entry, day) => {
    const rule = storedRecurrence(entry.recurrence);
    const remove = () => runAction(forecasts([entry as TreasuryEntry]));
    // Not repeated, or archived (read only: deleted as one).
    if (!rule || entry.archived) return remove();
    const scope = await askScope({ action: 'delete', title: 'Supprimer une prévision répétée', allowFollowing: hasOccurrenceAfter(rule, entry.date, day) });
    if (!scope) return;
    if (scope === 'THIS') return save(entry, { recurrence: withSkipped(rule, day) }, `Occurrence du ${fmt.dayLong(day)} supprimée.`);
    const ended = scope === 'FOLLOWING' ? ruleEndedBefore(rule, entry.date, day) : null;
    if (!ended) return remove();
    save(entry, { recurrence: ended }, `« ${entry.label} » s’arrête avant le ${fmt.dayLong(day)}.`);
  };
}
