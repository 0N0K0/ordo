import { openFormPanel } from '../../components/panels/panels';
import type { TaskContext } from '../tasks/use-task-context';
import { TimerStartForm } from './TimerCard';

/**
 * Opens the form starting a timer, in the side panel, closed once the timer runs.
 * @param {TaskContext} context Task context.
 * @param {string} [defaultProjectId] Project preselected. Optional.
 * @returns {void}
 */
export function openTimerForm(context: TaskContext, defaultProjectId?: string): void {
  openFormPanel('Nouveau chrono', (close) => <TimerStartForm context={context} defaultProjectId={defaultProjectId} popover onStarted={close} />, { panelId: 'new-timer' });
}
