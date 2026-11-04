import { modals } from '@mantine/modals';
import type { TaskContext } from '../tasks/use-task-context';
import { AlarmForm } from './AlarmForm';
import type { Alarm } from './api';

let modalCount = 0;

/**
 * Opens the alarm form in a modal, for a new alarm or to edit one.
 * @param {TaskContext | null} context Task context.
 * @returns {(alarm?: Alarm) => void} Opener.
 */
export function useAlarmForm(context: TaskContext | null) {
  return (alarm?: Alarm) => {
    if (!context) return;
    const modalId = `alarm-${++modalCount}`;
    modals.open({
      modalId,
      title: alarm ? 'Modifier l’alarme' : 'Nouvelle alarme',
      size: 'lg',
      children: <AlarmForm context={context} alarm={alarm} onDone={() => modals.close(modalId)} />,
    });
  };
}
