import { StateButton } from '../../../components/data-table/cells/StateButton';
import { Group } from '@mantine/core';
import { ROUTINE_DONE_STATES } from '../lib/routine-columns';
import { ON_ERROR } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';
import { windowText } from '../lib/routine-format';

interface DoneToggleProps {
  /** What it is, read after its state ("Se brosser les dents", "…, midi"). */
  label: string;
  /** Tooltip instead of what a click does (why it is disabled, its date, its time of the day). Optional. */
  hint?: string;
  done: boolean;
  /** Not needed for the day to be done (shown dashed). */
  optional?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  onChange: (done: boolean) => void;
}

/**
 * State button marking a routine (or one of its times of the day) as done: an empty square while to do, green with a
 * check once done, outlined dashed when optional.
 * @param {DoneToggleProps} props Component props.
 * @returns {JSX.Element} Button.
 */
function DoneToggle({ label, hint, done, optional = false, disabled = false, size = 'sm', onChange }: DoneToggleProps) {
  return <StateButton {...ROUTINE_DONE_STATES} value={done} label={label} hint={done ? undefined : hint} dashed={optional} size={size} readOnly={disabled} onChange={onChange} />;
}

interface RoutineDoneTogglesProps {
  routine: Routine;
  /** Date of its current occurrence, as shown ("lun. 10 nov."). */
  dateLabel?: string;
  disabled?: boolean;
}

/**
 * Done state buttons of the current occurrence of a routine: one, or one per time of the day (brushing teeth morning, noon and
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
        label={routine.label}
        hint={!started ? 'Pas encore commencée' : dateLabel ? `${ROUTINE_DONE_STATES.toggleLabels.yes} (${dateLabel})` : undefined}
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
            label={`${routine.label}, ${when}`}
            hint={!started ? 'Pas encore commencée' : `${ROUTINE_DONE_STATES.toggleLabels.yes} (${when}${slot.optional ? ', facultatif' : ''})`}
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
