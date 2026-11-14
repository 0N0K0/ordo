import { closePanel, openPanel } from '../../components/panels/panels';
import { RoutineForm, type RoutineFormProps } from './RoutineForm';

let modalCount = 0;

/**
 * Opens the routine form in the side panel.
 * @param {Omit<RoutineFormProps, 'onDone'>} [props] Routine edited, or parent or category of a new one. Optional.
 * @returns {void}
 */
export function openRoutineForm(props: Omit<RoutineFormProps, 'onDone'> = {}): void {
  const modalId = `routine-${++modalCount}`;
  openPanel({
    panelId: modalId,
    title: props.routine ? (props.copy ? 'Dupliquer la routine' : 'Modifier la routine') : props.parent ? `Nouvelle sous-routine de « ${props.parent.title} »` : 'Nouvelle routine',
    children: <RoutineForm {...props} onDone={() => closePanel(modalId)} />,
  });
}
