import { ActionIcon, Tooltip, type ActionIconProps } from '@mantine/core';
import { PlayIcon, StopIcon } from '@phosphor-icons/react';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import type { TimeEntry, TimerStartValues } from '../api';
import { useStartTimer } from '../hooks/use-start-timer';
import { useStopTimer } from '../hooks/use-stop-timer';

interface TimerToggleProps {
  /** Name of the item timed, for the screen readers. */
  name: string;
  /** Timer running on this item (null: none). */
  mine: TimeEntry | null | undefined;
  /** A timer runs on something else (it stops when this one starts). */
  othersRunning: boolean;
  /** Timer started on this item. */
  input: TimerStartValues;
  /** No start (archived item). Optional. */
  disabled?: boolean;
  /** Size of the button. Optional. */
  size?: ActionIconProps['size'];
}

/**
 * Button starting the timer on an item (« Démarrer le chrono »), or stopping the one running on it (and reporting the
 * time saved).
 * @param {TimerToggleProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function TimerToggle({ name, mine, othersRunning, input, disabled = false, size }: TimerToggleProps) {
  const { startTimer, isPending: starting } = useStartTimer();
  const { stopTimer, isPending: stopping } = useStopTimer();
  if (mine) {
    return (
      <Tooltip label="Arrêter le chrono">
        <ActionIcon
          variant="light"
          color="red"
          size={size}
          loading={stopping}
          aria-label={`Arrêter le chrono de ${name}`}
          onClick={(event) => {
            stopClick(event);
            stopTimer(mine);
          }}
        >
          <StopIcon weight="fill" aria-hidden />
        </ActionIcon>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={othersRunning ? 'Démarrer le chrono (celui en cours s’arrête)' : 'Démarrer le chrono'}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={size}
        loading={starting}
        disabled={disabled}
        aria-label={`Démarrer le chrono de ${name}`}
        onClick={(event) => {
          stopClick(event);
          startTimer(input);
        }}
      >
        <PlayIcon weight="fill" aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
