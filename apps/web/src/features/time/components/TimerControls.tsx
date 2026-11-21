import { IconAction } from '../../../components/actions/IconAction';
import { Group, type ActionIconProps } from '@mantine/core';
import { PauseIcon, PlayIcon } from '@phosphor-icons/react';
import { ON_ERROR } from '../../../lib/notify';
import { useTimeMutations, type TimeEntry } from '../api';
import { StopTimerButton } from './TimerStop';

interface TimerControlsProps {
  /** Running timer. */
  entry: TimeEntry;
  /** Size of the buttons. Optional. */
  size?: ActionIconProps['size'];
  /** Look of the pause: `header` (subtle, in the app header) or `card` (light); the stop is the same everywhere. Optional. Default = card. */
  look?: 'header' | 'card';
}

/**
 * Commands of a running timer, the same everywhere: pause / resume, then stop (the time saved).
 * @param {TimerControlsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function TimerControls({ entry, size, look = 'card' }: TimerControlsProps) {
  const { setPaused } = useTimeMutations();
  const paused = entry.pausedAt !== null;
  const header = look === 'header';
  return (
    <Group gap={header ? 4 : 'xs'} wrap="nowrap">
      <IconAction
        label={paused ? 'Reprendre' : 'Pause'}
        size={size}
        variant={header ? 'subtle' : 'light'}
        aria-label={paused ? 'Reprendre le chrono' : 'Mettre le chrono en pause'}
        loading={setPaused.isPending}
        onClick={() => setPaused.mutate({ id: entry.id, paused: !paused }, ON_ERROR)}
      >
        {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
      </IconAction>
      <StopTimerButton entry={entry} size={size} />
    </Group>
  );
}
