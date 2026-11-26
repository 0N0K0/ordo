import { Group } from '@mantine/core';
import { ROUTINE_DONE_STATES } from '../lib/routine-columns';
import type { Routine } from '../api';
import { windowText } from '../lib/routine-format';
import { RoutineTickButton } from './RoutineTick';

interface RoutineDoneTogglesProps {
  routine: Routine;
  /** Date of its current occurrence, as shown ("lun. 10 nov."). */
  dateLabel?: string;
  disabled?: boolean;
}

/**
 * Done state buttons of the current occurrence of a routine: one, or one per time of the day (brushing teeth morning, noon and
 * evening; the optional ones dashed), each ticked apart through the « Faite le » form (`RoutineTickButton`), its time
 * changed from the clock beside it once done. Disabled before the routine starts; none for a routine that has
 * sub-routines (a group, never ticked: its progress is read from them).
 * @param {RoutineDoneTogglesProps} props Component props.
 * @returns {JSX.Element | null} Toggles.
 */
export function RoutineDoneToggles({ routine, dateLabel, disabled = false }: RoutineDoneTogglesProps) {
  if (routine.hasSubRoutines) return null;
  const started = routine.currentDate !== null;
  const dueDate = routine.currentDueDate ?? routine.currentDate ?? '';
  // Each ticks, unticks or changes the occurrence shown (its current one, by the day that identifies it, even when two
  // are due the same day), proposed at its time once past, else now.
  const common = { disabled: disabled || !started };
  if (routine.slots.length <= 1) {
    const slot = routine.slots[0];
    return (
      <RoutineTickButton
        {...common}
        tick={{ id: routine.id, date: routine.currentDate, slot: 0 }}
        label={routine.label}
        hint={!started ? 'Pas encore commencée' : dateLabel ? `${ROUTINE_DONE_STATES.toggleLabels.yes} (${dateLabel})` : undefined}
        done={routine.done}
        doneAt={slot?.doneAt ?? null}
        target={{
          dueDate,
          fromTime: slot?.fromTime ?? null,
          dueTime: slot?.dueTime ?? null,
        }}
      />
    );
  }
  return (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      {routine.slots.map((slot) => {
        const when = windowText(slot) || `fois ${slot.index + 1}`;
        return (
          <RoutineTickButton
            {...common}
            key={slot.index}
            tick={{ id: routine.id, date: routine.currentDate, slot: slot.index }}
            size="xs"
            label={`${routine.label}, ${when}`}
            hint={!started ? 'Pas encore commencée' : `${ROUTINE_DONE_STATES.toggleLabels.yes} (${when}${slot.optional ? ', facultatif' : ''})`}
            done={started && slot.done}
            doneAt={slot.doneAt ?? null}
            optional={slot.optional}
            target={{ dueDate, fromTime: slot.fromTime, dueTime: slot.dueTime }}
          />
        );
      })}
    </Group>
  );
}
