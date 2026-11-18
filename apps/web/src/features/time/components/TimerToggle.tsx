import { IconAction } from '../../../components/actions/IconAction';
import { type ActionIconProps } from '@mantine/core';
import { PlayIcon } from '@phosphor-icons/react';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import type { TimeEntry, TimerStartValues } from '../api';
import { useStartTimer } from '../hooks/use-start-timer';
import { StopTimerButton } from './TimerStop';

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
  if (mine) return <StopTimerButton entry={mine} name={name} size={size} />;
  return (
    <IconAction
      label={othersRunning ? 'Démarrer le chrono (celui en cours s’arrête)' : 'Démarrer le chrono'}
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
    </IconAction>
  );
}
