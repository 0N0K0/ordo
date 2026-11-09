import { modals } from '@mantine/modals';
import type { TaskContext } from '../tasks/use-task-context';
import { AlarmForm } from './AlarmForm';
import type { Alarm } from './api';

let modalCount = 0;

/**
 * Opens the alarm form in a modal, for a new alarm, to edit one, or to copy one into a new one.
 * @param {TaskContext | null} context Task context.
 * @returns {(alarm?: Alarm, options?: { copy?: boolean }) => void} Opener.
 */
export function useAlarmForm(context: TaskContext | null) {
  return (alarm?: Alarm, { copy = false }: { copy?: boolean } = {}) => {
    if (!context) return;
    const modalId = `alarm-${++modalCount}`;
    modals.open({
      modalId,
      title: copy ? 'Dupliquer l’alarme' : alarm ? 'Modifier l’alarme' : 'Nouvelle alarme',
      size: 'lg',
      children: <AlarmForm context={context} alarm={alarm} copy={copy} onDone={() => modals.close(modalId)} />,
    });
  };
}
