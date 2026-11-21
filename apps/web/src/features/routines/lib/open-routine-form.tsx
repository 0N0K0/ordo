import { closePanel, openFormPanel } from '../../../components/panels/panels';
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
