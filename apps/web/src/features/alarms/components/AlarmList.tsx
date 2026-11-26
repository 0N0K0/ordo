import { InlineActions } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { StateSwitch } from '../../../components/inputs/StateSwitch';
import { Anchor, Badge, Group, Stack, Text } from '@mantine/core';
import { ListCard } from '../../../components/items/ListCard';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { duplicateRowsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { cachedItem } from '../../../lib/mutation';
import { copyName } from '../../../lib/text';
import { Link } from 'react-router';
import { ON_ERROR } from '../../../lib/notify';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { alarmTarget, describeAlarm, nextRing } from '../lib/alarm-labels';
import { alarmsQueryKey, useAlarmMutations, type Alarm } from '../api';
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
 * Alarms, one card each: title, schedule, next ring, task or project, note; on / off, edit, duplicate (saved at once,
 * then its form opens), delete.
 * @param {AlarmListProps} props Component props.
 * @param {Alarm[]} props.alarms Alarms.
 * @param {TaskContext} props.context Task context.
 * @param {AlarmFormOpener} props.openForm Opens the alarm form.
 * @param {boolean} [props.showTarget=true] Shows the task or project of each alarm. Optional. Default = true.
 * @returns {JSX.Element} List.
 */
export function AlarmList({ alarms, context, openForm, showTarget = true }: AlarmListProps) {
  const { create, update, remove } = useAlarmMutations();
  const queryClient = useQueryClient();
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
          <ListCard key={alarm.id} muted={!alarm.enabled}>
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
                <StateSwitch
                  label={alarm.enabled ? `Désactiver « ${alarm.label} »` : `Activer « ${alarm.label} »`}
                  checked={alarm.enabled}
                  onChange={(enabled) => update.mutate({ id: alarm.id, input: toAlarmInput(alarm, { enabled }) }, ON_ERROR)}
                />
                <InlineActions
                  name={alarm.label}
                  items={[
                    { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(alarm) },
                    rowMenuEntry(
                      duplicateRowsAction([alarm], {
                        duplicate: async (source) => (await create.mutateAsync(toAlarmInput(source, { label: copyName(source.label) }))).id,
                        done: 'Alarme dupliquée.',
                        open: (id) => {
                          const copy = cachedItem(queryClient, alarmsQueryKey, id, (list: Alarm[]) => list);
                          if (copy) openForm(copy);
                        },
                      }),
                    ),
                    { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(alarm) },
                  ]}
                />
              </Group>
            </Group>
          </ListCard>
        );
      })}
    </Stack>
  );
}
