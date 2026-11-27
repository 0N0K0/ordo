import { TreeViewIcon } from '@phosphor-icons/react';
import type { RowAction } from '../../../components/actions/ActionsMenu';
import { closePanel, openFormPanel } from '../../../components/panels/panels';
import type { Routine } from '../api';
import { RoutineForm, type RoutineFormProps } from '../components/RoutineForm';

/**
 * Id of the side panel of an existing routine: opened again, it replaces itself; closed by its id once the routine is
 * gone (deleted, transformed into a task).
 * @param {string} id Routine id.
 * @returns {string} Panel id.
 */
const routinePanelId = (id: string): string => `routine-${id}`;

/**
 * Opens the routine form in the side panel: the creation form, or the panel of an existing routine (saved field by
 * field; one panel per routine).
 * @param {Omit<RoutineFormProps, 'onDone'>} [props] Routine edited, or parent or category of a new one. Optional.
 * @returns {void}
 */
export function openRoutineForm(props: Omit<RoutineFormProps, 'onDone'> = {}): void {
  // As wide as the task panel, laid out the same.
  openFormPanel(
    props.routine ? 'Routine' : props.parent ? `Nouvelle sous-routine de « ${props.parent.label} »` : 'Nouvelle routine',
    (close) => <RoutineForm {...props} onDone={close} />,
    { size: 'lg', ...(props.routine && { panelId: routinePanelId(props.routine.id) }) },
  );
}

/**
 * Closes the panel open on routines that are gone (deleted, transformed into a task), wherever the action came from
 * (their row, their panel, the selection); nothing when none is open.
 * @param {readonly string[]} ids Routine ids.
 * @returns {void}
 */
export function closeRoutinePanels(ids: readonly string[]): void {
  for (const id of ids) closePanel(routinePanelId(id));
}

/**
 * « Ajouter une sous-routine » of a routine's menus (its row, a list of a day, its panel): the creation form of a
 * sub-routine of it.
 * @param {Routine} routine Parent routine.
 * @returns {RowAction} Menu entry.
 */
export const addSubRoutineEntry = (routine: Routine): RowAction => ({ label: 'Ajouter une sous-routine', icon: <TreeViewIcon aria-hidden />, onClick: () => openRoutineForm({ parent: routine }) });
