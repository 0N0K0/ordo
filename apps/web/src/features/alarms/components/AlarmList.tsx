import { InlineActions } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Anchor, Badge, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { ON_ERROR } from '../../../lib/notify';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { alarmTarget, describeAlarm, nextRing } from '../lib/alarm-labels';
import { useAlarmMutations, type Alarm } from '../api';
import type { AlarmFormOpener } from '../hooks/use-alarm-form';
import * as fmt from '../../../lib/format';

/**
 * Alarm fields to send back unchanged, with some changes.
 * @param {Alarm} alarm Alarm.
 * @param {Partial<Alarm>} changes Changes.
 * @returns {object} Alarm input.
 */
function toAlarmInput(alarm: Alarm, changes: Partial<Alarm>) {
  const { label, note, type, startDate, time, frequency, interval, weekdays, endDate, recurrence, minutes, projectId, taskId, enabled } = { ...alarm, ...changes };
  return { label, note, type, startDate, time, frequency, interval, weekdays, endDate, recurrence: recurrence ?? null, minutes, projectId, taskId, enabled };
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
      risks: `L’alarme « ${alarm.label} » sera supprimée définitivement et ne sonnera plus.`,
      run: () => remove.mutateAsync(alarm.id),
      done: 'Alarme supprimée.',
    });
  };

  return (
    <Stack gap="sm">
      {alarms.map((alarm) => {
        const next = nextRing(alarm, now);
        const target = showTarget
          ? alarmTarget(
              alarm,
              (id) => context.taskById.get(id),
              (id) => context.projectById.get(id),
            )
          : null;
        return (
          <Paper key={alarm.id} withBorder radius="md" p="md" style={{ opacity: alarm.enabled ? undefined : 'var(--onoko-muted-opacity)' }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600}>{alarm.label}</Text>
                  {alarm.enabled && alarm.type !== 'TRACKING_DURATION' && !next && (
                    <Badge size="sm" color="gray" variant="light">
                      Terminée
                    </Badge>
                  )}
                </Group>
                <Text size="sm">{describeAlarm(alarm)}</Text>
                {next && (
                  <Text size="xs" c="dimmed">
                    Prochaine : {fmt.dateTimeShort(next)}
                  </Text>
                )}
                {target && (
                  <Anchor component={Link} to={target.to} size="xs">
                    {target.label}
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
                  aria-label={alarm.enabled ? `Désactiver ${alarm.label}` : `Activer ${alarm.label}`}
                  checked={alarm.enabled}
                  onChange={(event) => update.mutate({ id: alarm.id, input: toAlarmInput(alarm, { enabled: event.currentTarget.checked }) }, ON_ERROR)}
                />
                <InlineActions
                  name={alarm.label}
                  items={[
                    { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(alarm) },
                    { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => openForm(alarm, { copy: true }) },
                    { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(alarm) },
                  ]}
                />
              </Group>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
