import { openFormPanel } from '../../../components/panels/panels';
import type { Routine } from '../api';
import { RoutineTickPanel } from '../components/RoutineTick';
import { windowText } from './routine-format';

/**
 * Opens « Faite le » of a time of the day of the current occurrence of a routine in the side panel (« Marquer comme
 * faite » of a reminder ringing, where no state button shows it).
 * @param {Pick<Routine, 'id' | 'label' | 'currentDate' | 'currentDueDate' | 'slots'>} routine Routine.
 * @param {number} slot Time of the day (index).
 * @returns {void}
 */
export function openRoutineTick(routine: Pick<Routine, 'id' | 'label' | 'currentDate' | 'currentDueDate' | 'slots'>, slot: number): void {
  const current = routine.slots.find((item) => item.index === slot);
  const when = routine.slots.length > 1 && current ? `, ${windowText(current) || `fois ${slot + 1}`}` : '';
  openFormPanel(
    `${routine.label}${when}`,
    (close) => (
      <RoutineTickPanel
        tick={{ id: routine.id, date: routine.currentDate, slot }}
        target={{ dueDate: routine.currentDueDate ?? routine.currentDate ?? '', fromTime: current?.fromTime ?? null, dueTime: current?.dueTime ?? null }}
        doneAt={current?.done ? (current.doneAt ?? null) : null}
        onDone={close}
      />
    ),
    { panelId: `routine-tick-${routine.id}-${slot}` },
  );
}
