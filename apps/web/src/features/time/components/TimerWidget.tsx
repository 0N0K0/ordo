import { Group, Popover, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { entrySeconds, formatClock } from '@ordo/shared';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimer, type TimeEntry } from '../api';
import { RunningTimer } from './TimerCard';
import classes from './TimerWidget.module.css';
import { useNow } from '../../../lib/use-now';
import { TimerControls } from './TimerControls';
import { entrySubject } from '../lib/entry-subject';

/**
 * Header controls of the running timer: project and clock (opening the details), pause / resume, stop.
 * @param {{ entry: TimeEntry }} props Component props.
 * @returns {JSX.Element} Controls.
 */
function RunningControls({ entry }: { entry: TimeEntry }) {
  const { context } = useTaskContext();
  const [opened, { toggle, close }] = useDisclosure(false);
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);

  return (
    <Group gap={4} wrap="nowrap" className={classes.running} data-paused={paused || undefined}>
      <Popover opened={opened} onChange={(value) => !value && close()} width={380} position="bottom-end" shadow="md" trapFocus>
        <Popover.Target>
          <UnstyledButton className={classes.summary} onClick={toggle} aria-label="Détails du chrono">
            <span className={classes.dot} aria-hidden />
            <Text size="sm" truncate maw={160} visibleFrom="sm">
              {entrySubject(entry, context)}
            </Text>
            <Text size="sm" ff="monospace" fw={600}>
              {formatClock(entrySeconds(entry, now))}
            </Text>
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown>{context && <RunningTimer key={entry.id} entry={entry} context={context} popover />}</Popover.Dropdown>
      </Popover>
      <TimerControls entry={entry} look="header" />
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
