import { LabeledField } from '../../../components/inputs/LabeledField';
import { Button, Group, Text } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import type { Task } from '../../tasks/api';
import { useRunningTimer } from '../api';
import { useStartTimer } from '../hooks/use-start-timer';

/**
 * Time tracked on a task (its share of each time entry), and a button starting the timer on it.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Tracked time.
 */
export function TaskTime({ task }: { task: Task }) {
  const running = useRunningTimer();
  const { startTimer, isPending } = useStartTimer();
  const onThisTask = running.data?.taskIds.includes(task.id) ?? false;
  return (
    <LabeledField label="Temps passé">
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
            variant="default"
            leftSection={<PlayIcon aria-hidden />}
            loading={isPending}
            disabled={task.archived}
            title={running.data ? 'Arrête le chrono en cours et en démarre un sur cette tâche' : undefined}
            onClick={() => startTimer({ projectId: task.projectId, taskIds: [task.id] })}
          >
            Démarrer le chrono
          </Button>
        )}
      </Group>
    </LabeledField>
  );
}
