import { Button, Group, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { AlarmIcon, PlusIcon } from '@phosphor-icons/react';
import type { Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { AlarmList } from './AlarmList';
import { useAlarms } from './api';
import { useAlarmForm } from './use-alarm-form';

/**
 * Alerts of a task, in its panel: its alarms (on / off, edit, copy, delete) and a button for a new one, created
 * with the task, its project and its title.
 * @param {{ task: Task, context: TaskContext }} props Task and task context.
 * @param {Task} props.task Task.
 * @param {TaskContext} props.context Task context.
 * @returns {JSX.Element} Section.
 */
export function TaskAlarms({ task, context }: { task: Task; context: TaskContext }) {
  const { data, isPending } = useAlarms();
  const openForm = useAlarmForm(context);
  const alarms = (data ?? []).filter((alarm) => alarm.taskId === task.id);
  const create = () => openForm(undefined, { defaults: { title: task.title.slice(0, 120), projectId: task.projectId, taskId: task.id } });

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Alertes
        </Text>
        {alarms.length > 0 && (
          <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={create}>
            Ajouter
          </Button>
        )}
      </Group>
      {isPending ? (
        <Skeleton height={72} />
      ) : alarms.length ? (
        <AlarmList alarms={alarms} context={context} openForm={openForm} showTarget={false} />
      ) : (
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size="md" radius="xl" variant="light" color="gray">
            <AlarmIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            Aucune alerte pour cette tâche.
          </Text>
          <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={create}>
            Ajouter une alerte
          </Button>
        </Group>
      )}
    </Stack>
  );
}
