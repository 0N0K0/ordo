import { modals } from '@mantine/modals';
import { RoutineForm, type RoutineFormProps } from './RoutineForm';

let modalCount = 0;

/**
 * Opens the routine form in a modal.
 * @param {Omit<RoutineFormProps, 'onDone'>} [props] Routine edited, or parent or category of a new one. Optional.
 * @returns {void}
 */
export function openRoutineForm(props: Omit<RoutineFormProps, 'onDone'> = {}): void {
  const modalId = `routine-${++modalCount}`;
  modals.open({
    modalId,
    title: props.routine ? (props.copy ? 'Dupliquer la routine' : 'Modifier la routine') : props.parent ? `Nouvelle sous-routine de « ${props.parent.title} »` : 'Nouvelle routine',
    size: 'lg',
    children: <RoutineForm {...props} onDone={() => modals.close(modalId)} />,
  });
}
