import { deleteItemsAction } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { useTreasuryMutations, type TreasuryEntry } from '../api';

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
        name: (entry) => entry.label,
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
        name: (entry) => entry.label,
        risks: (subject, one) => `${subject} et toutes ${one ? 'ses' : 'leurs'} répétitions seront supprimées${note}.`,
        remove,
        clear,
      }),
  };
}
