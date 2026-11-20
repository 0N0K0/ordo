import { openFormPanel } from '../../../components/panels/panels';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { AlarmForm, type AlarmDefaults } from '../components/AlarmForm';
import type { Alarm } from '../api';

/** Opens the alarm form: a new alarm (optionally pre-filled), or an alarm to edit. */
export type AlarmFormOpener = (alarm?: Alarm, options?: { defaults?: AlarmDefaults }) => void;

/**
 * Opens the alarm form in the side panel, for a new alarm (optionally pre-filled, e.g. with its task) or to edit one.
 * @param {TaskContext | null} context Task context.
 * @returns {AlarmFormOpener} Opener.
 */
export function useAlarmForm(context: TaskContext | null): AlarmFormOpener {
  return (alarm, { defaults } = {}) => {
    if (!context) return;
    openFormPanel(alarm ? 'Modifier l’alarme' : 'Nouvelle alarme', (close) => (
      <AlarmForm context={context} alarm={alarm} defaults={defaults} onDone={close} />
    ));
  };
}
