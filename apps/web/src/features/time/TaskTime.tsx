import { Button, Group, Stack, Text } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import type { Task } from '../tasks/api';
import { useRunningTimer, useTimeMutations } from './api';

/**
 * Time tracked on a task (its share of each time entry), and a button starting the timer on it.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Tracked time.
 */
export function TaskTime({ task }: { task: Task }) {
  const running = useRunningTimer();
  const { start } = useTimeMutations();
  const onThisTask = running.data?.taskIds.includes(task.id) ?? false;
  return (
    <Stack gap={2}>
      <Text size="sm" fw={500}>
        Temps passé
      </Text>
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Text size="sm" c={task.trackedSeconds ? undefined : 'dimmed'}>
          {task.trackedSeconds ? formatDuration(task.trackedSeconds) : 'Aucun'}
        </Text>
        {onThisTask ? (
          <Text size="xs" c="red">
            Chrono en cours
          </Text>
        ) : (
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<PlayIcon aria-hidden />}
            loading={start.isPending}
            disabled={task.archived}
            title={running.data ? 'Arrête le chrono en cours et en démarre un sur cette tâche' : undefined}
            onClick={() =>
              start.mutate({ projectId: task.projectId, taskIds: [task.id] }, { onError: (error) => notifyError(error.message) })
            }
          >
            Chrono
          </Button>
        )}
      </Group>
    </Stack>
  );
}
