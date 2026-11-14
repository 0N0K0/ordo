import { closePanel, openPanel } from '../../components/panels/panels';
import type { TaskContext } from '../tasks/use-task-context';
import { TimerStartForm } from './TimerCard';

/**
 * Opens the form starting a timer, in the side panel, closed once the timer runs.
 * @param {TaskContext} context Task context.
 * @param {string} [defaultProjectId] Project preselected. Optional.
 * @returns {void}
 */
export function openTimerForm(context: TaskContext, defaultProjectId?: string): void {
  const modalId = 'new-timer';
  openPanel({
    panelId: modalId,
    title: 'Nouveau chrono',
    children: <TimerStartForm context={context} defaultProjectId={defaultProjectId} popover onStarted={() => closePanel(modalId)} />,
  });
}
