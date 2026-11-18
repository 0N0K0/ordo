import { sumOf } from '@ordo/shared';
import { deleteItemsAction, rowLabel } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { countWith } from '../../../lib/text';

/** What the texts of a deletion say of a sheet. */
interface DeletedSheet {
  label: string;
  items: readonly unknown[];
  usedBy?: number | null;
}

/**
 * « Supprimer » of sheets, the same texts on a row, a selection and the page of a sheet.
 * @param {readonly S[]} rows Sheets.
 * @param {(sheet: S) => Promise<unknown>} remove Deletes a sheet.
 * @param {() => void} [clear] Clears the selection once done. Optional.
 * @returns {SelectionAction} Action.
 */
export function deleteSheetsAction<S extends DeletedSheet>(rows: readonly S[], remove: (sheet: S) => Promise<unknown>, clear?: () => void): SelectionAction {
  return deleteItemsAction(rows, {
    noun: 'fiche',
    feminine: true,
    the: 'la fiche',
    name: rowLabel,
    risks: (subject, one, sheets) => {
      const usedBy = sumOf(sheets, (sheet) => sheet.usedBy ?? 0);
      // « ses 0 éléments » left out: a sheet without items is deleted alone (« sera supprimée »).
      const alone = one && sheets[0].items.length === 0;
      const items = alone ? '' : one ? ` et ${countWith(sheets[0].items.length, 'élément', ['son', 'ses'])}` : ' et leurs éléments';
      const users = usedBy === 1 ? 'de la routine, de l’évènement ou de la tâche qui' : `des ${usedBy} routines, évènements ou tâches qui`;
      const used = usedBy ? `, et ${alone ? 'retirée' : 'retirés'} ${users} ${one ? 'l’' : 'les '}${usedBy === 1 ? 'a' : 'ont'}` : '';
      return `${subject}${items} ${alone ? 'sera supprimée' : 'seront supprimés'} définitivement${used}. Les listes d’achats et les listes à cocher déjà faites ${one ? 'la' : 'les'} gardent.`;
    },
    remove,
    clear,
  });
}
