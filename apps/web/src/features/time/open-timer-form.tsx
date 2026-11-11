import { modals } from '@mantine/modals';
import type { TaskContext } from '../tasks/use-task-context';
import { TimerStartForm } from './TimerCard';

/**
 * Opens the form starting a timer, in a modal closed once the timer runs.
 * @param {TaskContext} context Task context.
 * @param {string} [defaultProjectId] Project preselected. Optional.
 * @returns {void}
 */
export function openTimerForm(context: TaskContext, defaultProjectId?: string): void {
  const modalId = 'new-timer';
  modals.open({
    modalId,
    title: 'Nouveau chrono',
    children: <TimerStartForm context={context} defaultProjectId={defaultProjectId} popover onStarted={() => modals.close(modalId)} />,
  });
}
