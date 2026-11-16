import { CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { SelectionAction } from './SelectionBar';

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
    notifyError((error as Error).message);
    return false;
  }
}

/**
 * « Supprimer » of the rows checked: confirmed once (its risks told), then each row deleted; the selection cleared.
 * @param {readonly R[]} rows Rows checked.
 * @param {{ title: string, risks: string, remove: (row: R) => Promise<unknown>, done: string, clear: () => void, label?: string }} options Title and risks of the confirmation, deletion of a row, success message, clearing of the selection, label of the button (« Retirer »…).
 * @returns {SelectionAction} Action.
 */
export function deleteRowsAction<R>(
  rows: readonly R[],
  { title, risks, remove, done, clear, label = 'Supprimer' }: { title: string; risks: string; remove: (row: R) => Promise<unknown>; done: string; clear: () => void; label?: string },
): SelectionAction {
  return {
    label,
    icon: <TrashIcon aria-hidden />,
    destructive: { title, risks, confirmLabel: label },
    onClick: () => void forEachRow(rows, remove, done).then((all) => all && clear()),
  };
}

/**
 * « Dupliquer » of the rows checked: each row copied.
 * @param {readonly R[]} rows Rows checked.
 * @param {{ duplicate: (row: R) => Promise<unknown>, done: string, label?: string }} options Copy of a row, success message, label of the button.
 * @returns {SelectionAction} Action.
 */
export function duplicateRowsAction<R>(rows: readonly R[], { duplicate, done, label = 'Dupliquer' }: { duplicate: (row: R) => Promise<unknown>; done: string; label?: string }): SelectionAction {
  return { label, icon: <CopyIcon aria-hidden />, onClick: () => void forEachRow(rows, duplicate, done) };
}
