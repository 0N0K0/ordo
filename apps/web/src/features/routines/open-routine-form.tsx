import { openFormPanel } from '../../components/panels/panels';
import { RoutineForm, type RoutineFormProps } from './RoutineForm';

/**
 * Opens the routine form in the side panel.
 * @param {Omit<RoutineFormProps, 'onDone'>} [props] Routine edited, or parent or category of a new one. Optional.
 * @returns {void}
 */
export function openRoutineForm(props: Omit<RoutineFormProps, 'onDone'> = {}): void {
  // As wide as the task panel, laid out the same.
  openFormPanel(
    props.routine ? (props.copy ? 'Dupliquer la routine' : 'Modifier la routine') : props.parent ? `Nouvelle sous-routine de « ${props.parent.title} »` : 'Nouvelle routine',
    (close) => <RoutineForm {...props} onDone={close} />,
    'lg',
  );
}
