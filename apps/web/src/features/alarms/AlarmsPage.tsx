import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { nextOccurrence } from '@ordo/shared';
import {
  AlarmIcon,
  BellRingingIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { describeAlarm } from './alarm-labels';
import { useAlarmMutations, useAlarms, type Alarm } from './api';
import { useAlarmForm } from './use-alarm-form';

const nextFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Alarm fields to send back unchanged, with some changes.
 * @param {Alarm} alarm Alarm.
 * @param {Partial<Alarm>} changes Changes.
 * @returns {object} Alarm input.
 */
function toInput(alarm: Alarm, changes: Partial<Alarm>) {
  const {
    title,
    note,
    type,
    startDate,
    time,
    frequency,
    interval,
    weekdays,
    endDate,
    minutes,
    projectId,
    taskId,
    enabled,
  } = {
    ...alarm,
    ...changes,
  };
  return {
    title,
    note,
    type,
    startDate,
    time,
    frequency,
    interval,
    weekdays,
    endDate,
    minutes,
    projectId,
    taskId,
    enabled,
  };
}

/**
 * Alarms page: one-off and recurring reminders, alarms when no timer runs, and alarms during the timer.
 * They ring while Ordo is open in a tab.
 * @returns {JSX.Element} Page.
 */
export function AlarmsPage() {
  const { data: alarms, isPending } = useAlarms();
  const { context } = useTaskContext();
  const { update, remove } = useAlarmMutations();
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'denied',
  );

  const openForm = useAlarmForm(context);

  /**
   * Asks for confirmation before deleting an alarm.
   * @param {Alarm} alarm Alarm.
   * @returns {void}
   */
  const confirmDelete = (alarm: Alarm) => {
    const modalId = `delete-alarm-${alarm.id}`;
    modals.open({
      modalId,
      title: 'Supprimer l’alarme',
      children: (
        <Stack gap="md">
          <Text size="sm">
            L’alarme « {alarm.title} » sera supprimée définitivement et ne
            sonnera plus. Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(alarm.id, {
                onSuccess: () => notifySuccess('Alarme supprimée.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  const now = new Date();

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={1} size="h2">
            Alarmes
          </Title>
        </Stack>
        <Button
          leftSection={<PlusIcon aria-hidden />}
          onClick={() => openForm()}
          disabled={!context}
        >
          Nouvelle alarme
        </Button>
      </Group>

      {permission === 'default' && (
        <Alert
          color="blue"
          icon={<BellRingingIcon aria-hidden />}
          title="Notifications du navigateur"
        >
          <Stack gap="xs" align="flex-start">
            <Text size="sm">
              Autorisez-les pour voir les alarmes même quand l’onglet d’Ordo
              n’est pas au premier plan.
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                void Notification.requestPermission().then(setPermission)
              }
            >
              Autoriser les notifications
            </Button>
          </Stack>
        </Alert>
      )}

      {isPending || !context ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={72} />
          ))}
        </Stack>
      ) : !alarms?.length ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <AlarmIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune alarme.
            </Text>
            <Button
              variant="light"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() => openForm()}
            >
              Nouvelle alarme
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="sm">
          {alarms.map((alarm) => {
            const next =
              alarm.type === 'TRACKING_DURATION'
                ? null
                : nextOccurrence(alarm, now);
            const task = alarm.taskId
              ? context.taskById.get(alarm.taskId)
              : undefined;
            const project = alarm.projectId
              ? context.projectById.get(alarm.projectId)
              : undefined;
            return (
              <Paper
                key={alarm.id}
                withBorder
                radius="md"
                p="md"
                style={{ opacity: alarm.enabled ? 1 : 0.6 }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={4} style={{ minWidth: 0 }}>
                    <Group gap="xs">
                      <Text fw={600}>{alarm.title}</Text>
                      {alarm.enabled &&
                        alarm.type !== 'TRACKING_DURATION' &&
                        !next && (
                          <Badge size="sm" color="gray" variant="light">
                            Terminée
                          </Badge>
                        )}
                    </Group>
                    <Text size="sm">{describeAlarm(alarm)}</Text>
                    {alarm.enabled && next && (
                      <Text size="xs" c="dimmed">
                        Prochaine : {nextFormat.format(next)}
                      </Text>
                    )}
                    {(task ?? project) && (
                      <Anchor
                        component={Link}
                        to={
                          task
                            ? `/projects/${task.projectId}?tab=tasks&task=${task.number}`
                            : `/projects/${project!.id}`
                        }
                        size="xs"
                      >
                        {task
                          ? `#${task.number} ${task.title}`
                          : project!.title}
                      </Anchor>
                    )}
                    {alarm.note && (
                      <Text
                        size="sm"
                        c="dimmed"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {alarm.note}
                      </Text>
                    )}
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    <Switch
                      aria-label={
                        alarm.enabled
                          ? `Désactiver ${alarm.title}`
                          : `Activer ${alarm.title}`
                      }
                      checked={alarm.enabled}
                      onChange={(event) =>
                        update.mutate(
                          {
                            id: alarm.id,
                            input: toInput(alarm, {
                              enabled: event.currentTarget.checked,
                            }),
                          },
                          { onError: (error) => notifyError(error.message) },
                        )
                      }
                    />
                    <Tooltip label="Modifier">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Modifier ${alarm.title}`}
                        onClick={() => openForm(alarm)}
                      >
                        <PencilSimpleIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Supprimer">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Supprimer ${alarm.title}`}
                        onClick={() => confirmDelete(alarm)}
                      >
                        <TrashIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
