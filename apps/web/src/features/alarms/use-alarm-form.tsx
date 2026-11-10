import { modals } from '@mantine/modals';
import type { TaskContext } from '../tasks/use-task-context';
import { AlarmForm, type AlarmDefaults } from './AlarmForm';
import type { Alarm } from './api';

let modalCount = 0;

/** Opens the alarm form: a new alarm (optionally pre-filled), an alarm to edit, or one to copy into a new one. */
export type AlarmFormOpener = (alarm?: Alarm, options?: { copy?: boolean; defaults?: AlarmDefaults }) => void;

/**
 * Opens the alarm form in a modal, for a new alarm (optionally pre-filled, e.g. with its task), to edit one, or
 * to copy one into a new one.
 * @param {TaskContext | null} context Task context.
 * @returns {AlarmFormOpener} Opener.
 */
export function useAlarmForm(context: TaskContext | null): AlarmFormOpener {
  return (alarm, { copy = false, defaults } = {}) => {
    if (!context) return;
    const modalId = `alarm-${++modalCount}`;
    modals.open({
      modalId,
      title: copy ? 'Dupliquer l’alarme' : alarm ? 'Modifier l’alarme' : 'Nouvelle alarme',
      size: 'lg',
      children: <AlarmForm context={context} alarm={alarm} copy={copy} defaults={defaults} onDone={() => modals.close(modalId)} />,
    });
  };
}
