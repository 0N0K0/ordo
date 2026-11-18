import { ActionIcon, Group, Tooltip, type ActionIconProps } from '@mantine/core';
import { PauseIcon, PlayIcon, StopIcon } from '@phosphor-icons/react';
import { ON_ERROR } from '../../../lib/notify';
import { useTimeMutations, type TimeEntry } from '../api';
import { useStopTimer } from '../hooks/use-stop-timer';

interface TimerControlsProps {
  /** Running timer. */
  entry: TimeEntry;
  /** Size of the buttons. Optional. */
  size?: ActionIconProps['size'];
  /** Look: `header` (subtle, in the app header) or `card` (pause light, stop filled). Optional. Default = card. */
  look?: 'header' | 'card';
}

/**
 * Commands of the running timer, the same everywhere: pause / resume, then stop (the time saved).
 * @param {TimerControlsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function TimerControls({ entry, size, look = 'card' }: TimerControlsProps) {
  const { setPaused } = useTimeMutations();
  const { stopTimer, isPending: stopping } = useStopTimer();
  const paused = entry.pausedAt !== null;
  const header = look === 'header';
  return (
    <Group gap={header ? 4 : 'xs'} wrap="nowrap">
      <Tooltip label={paused ? 'Reprendre' : 'Pause'}>
        <ActionIcon
          size={size}
          variant={header ? 'subtle' : 'light'}
          aria-label={paused ? 'Reprendre le chrono' : 'Mettre le chrono en pause'}
          loading={setPaused.isPending}
          onClick={() => setPaused.mutate(!paused, ON_ERROR)}
        >
          {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Arrêter et enregistrer">
        <ActionIcon size={size} variant={header ? 'subtle' : 'filled'} aria-label="Arrêter le chrono et enregistrer" loading={stopping} onClick={() => stopTimer(entry)}>
          <StopIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
