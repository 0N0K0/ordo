import { openFormPanel } from '../../../components/panels/panels';
import { RoutineForm, type RoutineFormProps } from '../components/RoutineForm';

/**
 * Opens the routine form in the side panel: the creation form, or the panel of an existing routine (saved field by
 * field, decision D22).
 * @param {Omit<RoutineFormProps, 'onDone'>} [props] Routine edited, or parent or category of a new one. Optional.
 * @returns {void}
 */
export function openRoutineForm(props: Omit<RoutineFormProps, 'onDone'> = {}): void {
  // As wide as the task panel, laid out the same.
  openFormPanel(
    props.routine ? 'Routine' : props.parent ? `Nouvelle sous-routine de « ${props.parent.label} »` : 'Nouvelle routine',
    (close) => <RoutineForm {...props} onDone={close} />,
    'lg',
  );
}
