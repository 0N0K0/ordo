import { deleteItemsAction, rowLabel } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { countOf, plural } from '../../../lib/text';

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
      const usedBy = sheets.reduce((sum, sheet) => sum + (sheet.usedBy ?? 0), 0);
      const items = one ? `ses ${countOf(sheets[0].items.length, 'élément')}` : 'leurs éléments';
      const used = usedBy ? `, et retirés des ${usedBy} ${plural(usedBy, 'routine, évènement ou tâche', 'routines, évènements ou tâches')} qui ${one ? 'l’ont' : 'les ont'}` : '';
      return `${subject} et ${items} seront supprimés définitivement${used}. Les listes d’achats et les listes à cocher déjà faites ${one ? 'la' : 'les'} gardent.`;
    },
    remove,
    clear,
  });
}
