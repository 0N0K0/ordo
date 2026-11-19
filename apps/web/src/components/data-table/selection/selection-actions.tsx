import { ArchiveIcon, ArrowCounterClockwiseIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { countOf, plural } from '../../../lib/text';
import { type ArchiveMutation, archivedMessage } from '../../../lib/archive';
import { notifySuccess, notifyWithUndo, onMutationError, notifyFailure } from '../../../lib/notify';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import type { RowMenuEntry } from '../../actions/ActionsMenu';
import type { SelectionAction } from './SelectionBar';
import { capitalize } from '../../../lib/format';
import { agreed } from '@ordo/shared';

/**
 * Runs an action on rows one after the other (their order kept), then tells how it went: the success, or the first
 * error (the rows before it done).
 * @param {readonly R[]} rows Rows.
 * @param {(row: R) => Promise<unknown>} run Action on a row.
 * @param {string} done Success message.
 * @returns {Promise<boolean>} Every row done.
 */
export async function forEachRow<R>(rows: readonly R[], run: (row: R) => Promise<unknown>, done: string): Promise<boolean> {
  try {
    for (const row of rows) await run(row);
    notifySuccess(done);
    return true;
  } catch (error) {
    notifyFailure(error);
    return false;
  }
}

/**
 * Rows checked that no other checked row holds (a sub-task under a checked task goes with it): those an action on a
 * tree runs on.
 * @param {readonly R[]} rows Rows checked.
 * @param {(row: R) => string} idOf Id of a row.
 * @param {(id: string) => string | null | undefined} parentOf Parent of a row (among all, checked or not).
 * @returns {R[]} Outermost rows.
 */
export function outermost<R>(rows: readonly R[], idOf: (row: R) => string, parentOf: (id: string) => string | null | undefined): R[] {
  const checked = new Set(rows.map(idOf));
  return rows.filter((row) => {
    for (let parent = parentOf(idOf(row)); parent; parent = parentOf(parent)) if (checked.has(parent)) return false;
    return true;
  });
}

/**
 * « Supprimer » of the rows checked: confirmed once (its risks told), then the rows deleted (in one request when the
 * list has one, else each in turn); the selection cleared.
 * @param {readonly R[]} rows Rows checked.
 * @param {{ title: string, risks: ReactNode, remove?: (row: R) => Promise<unknown>, removeAll?: (rows: readonly R[]) => Promise<unknown>, done: string, clear: () => void, label?: string, loading?: boolean }} options Title and risks of the confirmation, deletion of a row or of all, success message, clearing of the selection, label of the button (« Retirer »…), deletion running.
 * @returns {SelectionAction} Action.
 */
export function deleteRowsAction<R>(
  rows: readonly R[],
  {
    title,
    risks,
    remove,
    removeAll,
    done,
    clear,
    label = 'Supprimer',
    loading,
  }: {
    title: string;
    risks: ReactNode;
    remove?: (row: R) => Promise<unknown>;
    removeAll?: (rows: readonly R[]) => Promise<unknown>;
    done: string;
    clear: () => void;
    label?: string;
    loading?: boolean;
  },
): SelectionAction {
  const run = removeAll ? () => forEachRow([rows], removeAll, done) : () => forEachRow(rows, remove!, done);
  return {
    label,
    icon: <TrashIcon aria-hidden />,
    loading,
    destructive: { title, risks, confirmLabel: label },
    onClick: () => void run().then((all) => all && clear()),
  };
}

/**
 * Label of a row, as `deleteItemsAction` names it (inside the quotes).
 * @param {{ label: string }} row Row.
 * @returns {string} Its label.
 */
export const rowLabel = (row: { label: string }): string => row.label;

/**
 * « Supprimer » of rows of a kind, the same texts on one row (its menu: `rowMenuEntry(deleteItemsAction([row], …))`)
 * and on a selection: « Supprimer l’article » / « Supprimer les articles », « Article supprimé. » / « 3 articles
 * supprimés. ».
 * @param {readonly R[]} rows Rows.
 * @param {object} options Options.
 * @param {string} options.noun Noun of one row (« article »).
 * @param {string} [options.many] Noun of several, when not the noun with an « s ». Optional.
 * @param {boolean} [options.feminine] Named in the feminine (« supprimée »). Optional. Default = false.
 * @param {string} options.the The noun with its article, for the title of one (« l’article »).
 * @param {(row: R) => string} [options.label] Label of a row (inside the quotes); without it, one row is « Ce budget ». Optional.
 * @param {(subject: string, one: boolean, rows: readonly R[]) => ReactNode} options.risks Risks, given what is deleted (« « Riz » » or « 3 articles ») and whether it is one row.
 * @param {(row: R) => Promise<unknown>} [options.remove] Deletes a row. Optional (or removeAll).
 * @param {(rows: readonly R[]) => Promise<unknown>} [options.removeAll] Deletes every row at once. Optional (or remove).
 * @param {() => void} [options.clear] Clears the selection once done. Optional.
 * @param {boolean} [options.loading] Running. Optional.
 * @returns {SelectionAction} Action.
 */
export function deleteItemsAction<R>(
  rows: readonly R[],
  {
    noun,
    many,
    feminine = false,
    the,
    label: labelOf,
    risks,
    remove,
    removeAll,
    clear = () => {},
    loading,
  }: {
    noun: string;
    many?: string;
    feminine?: boolean;
    the: string;
    label?: (row: R) => string;
    risks: (subject: string, one: boolean, rows: readonly R[]) => ReactNode;
    remove?: (row: R) => Promise<unknown>;
    removeAll?: (rows: readonly R[]) => Promise<unknown>;
    clear?: () => void;
    loading?: boolean;
  },
): SelectionAction {
  const one = rows.length === 1;
  const removed = agreed('supprimé', feminine);
  const counted = countOf(rows.length, noun, many);
  return deleteRowsAction(rows, {
    title: one ? `Supprimer ${the}` : `Supprimer les ${many ?? `${noun}s`}`,
    risks: risks(one ? (labelOf ? `« ${labelOf(rows[0])} »` : `${feminine ? 'Cette' : 'Ce'} ${noun}`) : counted, one, rows),
    remove,
    removeAll,
    done: one ? `${capitalize(noun)} ${removed}.` : `${counted} ${plural(rows.length, removed)}.`,
    clear,
    loading,
  });
}

/**
 * Action switching a state of the rows checked (closed, done, archived…): to « on » unless all are, then back; the
 * success told with its undo.
 * @param {object} options Options.
 * @param {boolean} options.on Every row checked is in the state already.
 * @param {[string, string]} options.labels Labels of the button: to switch it on, to switch it off.
 * @param {[ReactNode, ReactNode]} options.icons Icons: to switch it on, to switch it off.
 * @param {(on: boolean) => Promise<unknown>} options.apply Puts the rows in the state, or out of it.
 * @param {(on: boolean) => string} options.done Success message of a switch.
 * @param {(on: boolean) => () => void} [options.undo] Undo of a switch, putting each row back as it was. Optional. Default = the opposite switch.
 * @param {() => void} [options.clear] Clears the selection once done (the rows leave the table). Optional.
 * @param {boolean} [options.loading] Running. Optional.
 * @returns {SelectionAction} Action.
 */
export function switchRowsAction({
  on,
  labels,
  icons,
  apply,
  done,
  undo,
  clear,
  loading,
}: {
  on: boolean;
  labels: [string, string];
  icons: [ReactNode, ReactNode];
  apply: (on: boolean) => Promise<unknown>;
  done: (on: boolean) => string;
  undo?: (on: boolean) => () => void;
  clear?: () => void;
  loading?: boolean;
}): SelectionAction {
  return {
    label: on ? labels[1] : labels[0],
    icon: on ? icons[1] : icons[0],
    loading,
    onClick: () =>
      void apply(!on).then(() => {
        notifyWithUndo(done(!on), undo?.(!on) ?? (() => void apply(on).catch(onMutationError)));
        clear?.();
      }, onMutationError),
  };
}

/**
 * « Archiver » / « Restaurer » of the rows checked: archives them unless all are, then restores them; the success told
 * with its undo.
 * @param {object} options Options.
 * @param {boolean} options.archived Every row checked is archived already.
 * @param {(archived: boolean) => Promise<unknown>} options.apply Archives or restores the rows.
 * @param {string} options.label What is changed, for the message (« 3 tâches »).
 * @param {number} options.count Number of rows, for the agreement of the message.
 * @param {boolean} [options.feminine] Rows named in the feminine (« archivées »). Optional.
 * @param {(archived: boolean) => () => void} [options.undo] Undo, putting each row back as it was. Optional. Default = the opposite switch.
 * @param {() => void} [options.clear] Clears the selection once done. Optional.
 * @param {boolean} [options.loading] Running. Optional.
 * @returns {SelectionAction} Action.
 */
export function archiveRowsAction({
  archived,
  apply,
  label,
  count,
  feminine = false,
  undo,
  clear,
  loading,
}: {
  archived: boolean;
  apply: (archived: boolean) => Promise<unknown>;
  label: string;
  count: number;
  feminine?: boolean;
  undo?: (archived: boolean) => () => void;
  clear?: () => void;
  loading?: boolean;
}): SelectionAction {
  return switchRowsAction({
    on: archived,
    labels: ['Archiver', 'Restaurer'],
    icons: [<ArchiveIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
    loading,
    apply,
    done: (on) => archivedMessage(label, on, { feminine, count }),
    undo,
    clear,
  });
}

/**
 * « Archiver » / « Restaurer » of the elements checked, with the archive mutation of their kind (`useSetArchived`):
 * archives them unless all are, then restores them; « 3 fiches archivées. » told with its undo.
 * @param {readonly T[]} rows Elements checked.
 * @param {ArchiveMutation} mutation Archive mutation of their kind.
 * @param {object} options Options.
 * @param {string} options.noun Noun of one element, for the message (« fiche »).
 * @param {boolean} [options.feminine] Named in the feminine (« archivées »). Optional. Default = false.
 * @param {string} [options.many] Noun of several, when not the noun with an « s » (« factures récurrentes »). Optional.
 * @param {() => void} [options.clear] Clears the selection once done. Optional.
 * @returns {SelectionAction} Action.
 */
export function archiveItemsAction<T extends { id: string; archived?: boolean | null }>(
  rows: readonly T[],
  mutation: ArchiveMutation,
  { noun, many, feminine, clear }: { noun: string; many?: string; feminine?: boolean; clear?: () => void },
): SelectionAction {
  return archiveRowsAction({
    archived: rows.every((row) => row.archived),
    apply: (archived) => mutation.mutateAsync({ ids: rows.map((row) => row.id), archived }),
    label: countOf(rows.length, noun, many),
    count: rows.length,
    feminine,
    clear,
  });
}

/**
 * « Dupliquer » of the rows checked: each row copied.
 * @param {readonly R[]} rows Rows checked.
 * @param {{ duplicate: (row: R) => Promise<unknown>, done: string, label?: string, loading?: boolean }} options Copy of a row, success message, label of the button, copy running.
 * @returns {SelectionAction} Action.
 */
export function duplicateRowsAction<R>(
  rows: readonly R[],
  { duplicate, done, label = 'Dupliquer', loading }: { duplicate: (row: R) => Promise<unknown>; done: string; label?: string; loading?: boolean },
): SelectionAction {
  return { label, icon: <CopyIcon aria-hidden />, loading, onClick: () => void forEachRow(rows, duplicate, done) };
}

/**
 * Entry of the menu of a row made of an action of the selection bar (run on that row alone): the same action, its
 * confirmation included, wherever it is offered.
 * @param {SelectionAction} action Action.
 * @returns {RowMenuEntry} Menu entry.
 */
export function rowMenuEntry({ label, icon, onClick, destructive, danger, disabled }: SelectionAction): RowMenuEntry {
  return {
    label,
    icon,
    disabled,
    danger: danger || !!destructive,
    onClick: destructive ? () => confirmDestructive({ ...destructive, onConfirm: onClick }) : onClick,
  };
}
