import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { CheckCircleIcon, CircleDashedIcon, CircleIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import { useRoutineMutations, type Routine } from './api';
import { windowText } from './routine-format';
import classes from './Routines.module.css';

interface DoneToggleProps {
  /** Accessible name ("Se brosser les dents faite", "… midi faite"). */
  label: string;
  /** Tooltip of the toggle while to do. */
  hint: string;
  done: boolean;
  /** Not needed for the day to be done (shown dashed). */
  optional?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  onChange: (done: boolean) => void;
}

/**
 * Round toggle marking a routine (or one of its times of the day) as done: a circle (dashed when optional), then a
 * filled green check; distinct from the square checkboxes selecting rows.
 * @param {DoneToggleProps} props Component props.
 * @returns {JSX.Element} Toggle.
 */
function DoneToggle({ label, hint, done, optional = false, disabled = false, size = 'sm', onChange }: DoneToggleProps) {
  return (
    <Tooltip label={done ? 'Marquer comme à faire' : hint}>
      <ActionIcon
        variant={done ? 'light' : 'subtle'}
        color={done ? 'green' : 'gray'}
        radius="xl"
        size={size}
        className={classes.doneToggle}
        data-done={done || undefined}
        aria-label={label}
        aria-pressed={done}
        disabled={disabled}
        onClick={() => onChange(!done)}
      >
        {done ? <CheckCircleIcon weight="fill" aria-hidden /> : optional ? <CircleDashedIcon aria-hidden /> : <CircleIcon aria-hidden />}
      </ActionIcon>
    </Tooltip>
  );
}

interface RoutineDoneTogglesProps {
  routine: Routine;
  /** Date of its current occurrence, as shown ("lun. 10 nov."). */
  dateLabel?: string;
  disabled?: boolean;
}

/**
 * Done toggles of the current occurrence of a routine: one, or one per time of the day (brushing teeth morning, noon and
 * evening; the optional ones dashed), each ticked apart. Disabled before the routine starts.
 * @param {RoutineDoneTogglesProps} props Component props.
 * @returns {JSX.Element} Toggles.
 */
export function RoutineDoneToggles({ routine, dateLabel, disabled = false }: RoutineDoneTogglesProps) {
  const { setDone } = useRoutineMutations();
  const started = routine.currentDate !== null;
  const save = (slot: number, done: boolean) => setDone.mutate({ id: routine.id, done, slot }, { onError: (error) => notifyError(error.message) });
  if (routine.slots.length <= 1) {
    return (
      <DoneToggle
        label={`${routine.title} faite`}
        hint={!started ? 'Pas encore commencée' : dateLabel ? `Marquer comme faite (${dateLabel})` : 'Marquer comme faite'}
        done={routine.done}
        disabled={disabled || !started}
        onChange={(done) => save(0, done)}
      />
    );
  }
  return (
    <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
      {routine.slots.map((slot) => {
        const when = windowText(slot) || `fois ${slot.index + 1}`;
        return (
          <DoneToggle
            key={slot.index}
            size="xs"
            label={`${routine.title}, ${when}, faite`}
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
