import { CopyIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { notifyError, notifySuccess, notifyWithUndo, onMutationError } from '../../lib/notify';
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
  const onError = onMutationError;
  return {
    label: on ? labels[1] : labels[0],
    icon: on ? icons[1] : icons[0],
    loading,
    onClick: () =>
      void apply(!on).then(() => {
        notifyWithUndo(done(!on), undo?.(!on) ?? (() => void apply(on).catch(onError)));
        clear?.();
      }, onError),
  };
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
