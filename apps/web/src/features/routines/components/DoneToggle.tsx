import { StateSwitch } from '../../../components/inputs/StateSwitch';
import { Group } from '@mantine/core';
import { CheckIcon } from '@phosphor-icons/react';
import { ON_ERROR } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';
import { windowText } from '../lib/routine-format';

interface DoneToggleProps {
  /** Accessible name ("Se brosser les dents faite", "… midi faite"). */
  label: string;
  /** Tooltip of the switch while to do. */
  hint: string;
  done: boolean;
  /** Not needed for the day to be done (shown dashed). */
  optional?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  onChange: (done: boolean) => void;
}

/**
 * Switch marking a routine (or one of its times of the day) as done: green with a check once done, its track dashed
 * when optional; distinct from the square checkboxes selecting rows.
 * @param {DoneToggleProps} props Component props.
 * @returns {JSX.Element} Switch.
 */
function DoneToggle({ label, hint, done, optional = false, disabled = false, size = 'sm', onChange }: DoneToggleProps) {
  return (
    <StateSwitch
      label={label}
      hint={done ? 'Marquer comme à faire' : hint}
      checked={done}
      color="green"
      icon={<CheckIcon weight="bold" aria-hidden />}
      dashed={optional}
      size={size}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

interface RoutineDoneTogglesProps {
  routine: Routine;
  /** Date of its current occurrence, as shown ("lun. 10 nov."). */
  dateLabel?: string;
  disabled?: boolean;
}

/**
 * Done switches of the current occurrence of a routine: one, or one per time of the day (brushing teeth morning, noon and
 * evening; the optional ones dashed), each ticked apart. Disabled before the routine starts.
 * @param {RoutineDoneTogglesProps} props Component props.
 * @returns {JSX.Element} Toggles.
 */
export function RoutineDoneToggles({ routine, dateLabel, disabled = false }: RoutineDoneTogglesProps) {
  const { setDone } = useRoutineMutations();
  const started = routine.currentDate !== null;
  const save = (slot: number, done: boolean) => setDone.mutate({ id: routine.id, done, slot }, ON_ERROR);
  if (routine.slots.length <= 1) {
    return (
      <DoneToggle
        label={`${routine.label} faite`}
        hint={!started ? 'Pas encore commencée' : dateLabel ? `Marquer comme faite (${dateLabel})` : 'Marquer comme faite'}
        done={routine.done}
        disabled={disabled || !started}
        onChange={(done) => save(0, done)}
      />
    );
  }
  return (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      {routine.slots.map((slot) => {
        const when = windowText(slot) || `fois ${slot.index + 1}`;
        return (
          <DoneToggle
            key={slot.index}
            size="xs"
            label={`${routine.label}, ${when}, faite`}
            hint={!started ? 'Pas encore commencée' : `${when}${slot.optional ? ' (facultatif)' : ''}`}
            done={started && slot.done}
            optional={slot.optional}
            disabled={disabled || !started}
            onChange={(done) => save(slot.index, done)}
          />
        );
      })}
    </Group>
  );
}
