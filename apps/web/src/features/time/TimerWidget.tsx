import { ActionIcon, Group, Popover, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { entrySeconds, formatClock } from '@ordo/shared';
import { PauseIcon, PlayIcon, StopIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useRunningTimer, useTimeMutations, type TimeEntry } from './api';
import { RunningTimer } from './TimerCard';
import classes from './TimerWidget.module.css';
import { useNow } from './use-now';
import { useStopTimer } from './use-stop-timer';

/**
 * Header controls of the running timer: project and clock (opening the details), pause / resume, stop.
 * @param {{ entry: TimeEntry }} props Component props.
 * @returns {JSX.Element} Controls.
 */
function RunningControls({ entry }: { entry: TimeEntry }) {
  const { context } = useTaskContext();
  const { setPaused } = useTimeMutations();
  const { stopTimer, isPending } = useStopTimer();
  const [opened, { toggle, close }] = useDisclosure(false);
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);
  const project = entry.projectId ? context?.projectById.get(entry.projectId) : undefined;

  return (
    <Group gap={4} wrap="nowrap" className={classes.running} data-paused={paused || undefined}>
      <Popover opened={opened} onChange={(value) => !value && close()} width={380} position="bottom-end" shadow="md" trapFocus>
        <Popover.Target>
          <UnstyledButton className={classes.summary} onClick={toggle} aria-label="Détails du chrono">
            <span className={classes.dot} aria-hidden />
            <Text size="sm" truncate maw={160} visibleFrom="sm">
              {project?.title ?? entry.routineTitle ?? 'Chrono'}
            </Text>
            <Text size="sm" ff="monospace" fw={600}>
              {formatClock(entrySeconds(entry, now))}
            </Text>
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown>{context && <RunningTimer key={entry.id} entry={entry} context={context} popover />}</Popover.Dropdown>
      </Popover>
      <Tooltip label={paused ? 'Reprendre' : 'Pause'}>
        <ActionIcon
          variant="subtle"
          aria-label={paused ? 'Reprendre le chrono' : 'Mettre le chrono en pause'}
          loading={setPaused.isPending}
          onClick={() => setPaused.mutate(!paused, { onError: (error) => notifyError(error.message) })}
        >
          {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Arrêter et enregistrer">
        <ActionIcon variant="subtle" aria-label="Arrêter le chrono" loading={isPending} onClick={() => stopTimer(entry)}>
          <StopIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * Running timer in the app header, on every page (a timer is started from the « Ajouter » menu).
 * @returns {JSX.Element | null} Controls, while a timer runs.
 */
export function TimerWidget() {
  const running = useRunningTimer();
  return running.data ? <RunningControls entry={running.data} /> : null;
}
