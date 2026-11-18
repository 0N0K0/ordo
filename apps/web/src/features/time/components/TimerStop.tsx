import { IconAction } from '../../../components/actions/IconAction';
import { Badge, type ActionIconProps } from '@mantine/core';
import { StopIcon } from '@phosphor-icons/react';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import type { TimeEntry } from '../api';
import { useStopTimer } from '../hooks/use-stop-timer';

/** State of a running timer, the same everywhere (decision S). */
export const TIMER_RUNNING = 'Chrono en cours';

/**
 * Button stopping a running timer (the time saved), the same everywhere: « Arrêter le chrono », light red (decision S).
 * @param {{ entry: TimeEntry, name?: string, size?: ActionIconProps['size'] }} props Running timer, the item timed (for the screen readers; optional) and the size of the button (optional).
 * @returns {JSX.Element} Button.
 */
export function StopTimerButton({ entry, name, size }: { entry: TimeEntry; name?: string; size?: ActionIconProps['size'] }) {
  const { stopTimer, isPending } = useStopTimer();
  return (
    <IconAction
      label="Arrêter le chrono"
      variant="light"
      color="red"
      size={size}
      loading={isPending}
      aria-label={name ? `Arrêter le chrono de ${name}` : 'Arrêter le chrono'}
      onClick={(event) => {
        stopClick(event);
        stopTimer(entry);
      }}
    >
      <StopIcon weight="fill" aria-hidden />
    </IconAction>
  );
}

/**
 * Badge of a running timer: « Chrono en cours ».
 * @returns {JSX.Element} Badge.
 */
export function TimerRunningBadge() {
  return (
    <Badge size="sm" color="red" variant="light">
      {TIMER_RUNNING}
    </Badge>
  );
}
