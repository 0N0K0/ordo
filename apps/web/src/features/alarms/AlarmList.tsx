import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { ActionIcon, Anchor, Badge, Group, Paper, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { nextOccurrence } from '@ordo/shared';
import { CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { TaskContext } from '../tasks/use-task-context';
import { describeAlarm } from './alarm-labels';
import { useAlarmMutations, type Alarm } from './api';
import type { AlarmFormOpener } from './use-alarm-form';
import * as fmt from '../../lib/format';
import { taskPath } from '../tasks/task-links';

/**
 * Alarm fields to send back unchanged, with some changes.
 * @param {Alarm} alarm Alarm.
 * @param {Partial<Alarm>} changes Changes.
 * @returns {object} Alarm input.
 */
function toAlarmInput(alarm: Alarm, changes: Partial<Alarm>) {
  const { title, note, type, startDate, time, frequency, interval, weekdays, endDate, minutes, projectId, taskId, enabled } = { ...alarm, ...changes };
  return { title, note, type, startDate, time, frequency, interval, weekdays, endDate, minutes, projectId, taskId, enabled };
}

interface AlarmListProps {
  alarms: Alarm[];
  context: TaskContext;
  openForm: AlarmFormOpener;
  /** Shows the task or project of each alarm, with a link to it. Default = true. */
  showTarget?: boolean;
}

/**
 * Alarms, one card each: title, schedule, next ring, task or project, note; on / off, edit, copy, delete.
 * @param {AlarmListProps} props Component props.
 * @param {Alarm[]} props.alarms Alarms.
 * @param {TaskContext} props.context Task context.
 * @param {AlarmFormOpener} props.openForm Opens the alarm form.
 * @param {boolean} [props.showTarget=true] Shows the task or project of each alarm. Optional. Default = true.
 * @returns {JSX.Element} List.
 */
export function AlarmList({ alarms, context, openForm, showTarget = true }: AlarmListProps) {
  const { update, remove } = useAlarmMutations();
  const now = new Date();

  /**
   * Asks for confirmation before deleting an alarm.
   * @param {Alarm} alarm Alarm.
   * @returns {void}
   */
  const confirmDelete = (alarm: Alarm) => {
    confirmDestructive({
      title: 'Supprimer l’alarme',
      risks: (
        <>
          <Text size="sm">L’alarme « {alarm.title} » sera supprimée définitivement et ne sonnera plus. Cette action est irréversible.</Text>
        </>
      ),
      onConfirm: () => {
        remove.mutate(alarm.id, { onSuccess: () => notifySuccess('Alarme supprimée.'), onError: (error) => notifyError(error.message) });
      },
    });
  };

  return (
    <Stack gap="sm">
      {alarms.map((alarm) => {
        const next = alarm.type === 'TRACKING_DURATION' ? null : nextOccurrence(alarm, now);
        const task = showTarget && alarm.taskId ? context.taskById.get(alarm.taskId) : undefined;
        const project = showTarget && alarm.projectId ? context.projectById.get(alarm.projectId) : undefined;
        return (
          <Paper key={alarm.id} withBorder radius="md" p="md" style={{ opacity: alarm.enabled ? 1 : 0.6 }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600}>{alarm.title}</Text>
                  {alarm.enabled && alarm.type !== 'TRACKING_DURATION' && !next && (
                    <Badge size="sm" color="gray" variant="light">
                      Terminée
                    </Badge>
                  )}
                </Group>
                <Text size="sm">{describeAlarm(alarm)}</Text>
                {alarm.enabled && next && (
                  <Text size="xs" c="dimmed">
                    Prochaine : {fmt.dateTimeShort(next)}
                  </Text>
                )}
                {(task ?? project) && (
                  <Anchor component={Link} to={task ? taskPath(task) : `/projects/${project!.id}`} size="xs">
                    {task ? context.taskLabel(task) : project!.title}
                  </Anchor>
                )}
                {alarm.note && (
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                    {alarm.note}
                  </Text>
                )}
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Switch
                  aria-label={alarm.enabled ? `Désactiver ${alarm.title}` : `Activer ${alarm.title}`}
                  checked={alarm.enabled}
                  onChange={(event) => update.mutate({ id: alarm.id, input: toAlarmInput(alarm, { enabled: event.currentTarget.checked }) }, { onError: (error) => notifyError(error.message) })}
                />
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${alarm.title}`} onClick={() => openForm(alarm)}>
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Dupliquer">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Dupliquer ${alarm.title}`} onClick={() => openForm(alarm, { copy: true })}>
                    <CopyIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Supprimer">
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${alarm.title}`} onClick={() => confirmDelete(alarm)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
