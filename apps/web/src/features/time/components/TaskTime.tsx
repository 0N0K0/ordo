import { LabeledField } from '../../../components/inputs/LabeledField';
import { Group, Text } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import type { Task } from '../../tasks/api';
import { runningOn, useRunningTimers } from '../api';
import { useStartTimer } from '../hooks/use-start-timer';
import { TimerControls } from './TimerControls';
import { TimerRunningBadge } from './TimerStop';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Time tracked on a task (its share of each time entry), and a button starting the timer on it.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Tracked time.
 */
export function TaskTime({ task }: { task: Task }) {
  const running = useRunningTimers();
  const { startTimer, isPending } = useStartTimer();
  const mine = runningOn(running.data, (entry) => entry.taskIds.includes(task.id));
  return (
    <LabeledField label="Temps passé">
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Text size="sm" c={task.trackedSeconds ? undefined : 'dimmed'}>
          {task.trackedSeconds ? formatDuration(task.trackedSeconds) : 'Aucun'}
        </Text>
        {mine ? (
          <Group gap="xs" wrap="nowrap">
            <TimerRunningBadge />
            <TimerControls entry={mine} size="sm" look="header" />
          </Group>
        ) : (
          <ActionButton
            priority="secondary"
            size="compact-sm"
            icon={<PlayIcon aria-hidden />}
            loading={isPending}
            disabled={task.archived}
            onClick={() => startTimer({ projectId: task.projectId, taskIds: [task.id] })}
          >
            Démarrer le chrono
          </ActionButton>
        )}
      </Group>
    </LabeledField>
  );
}
