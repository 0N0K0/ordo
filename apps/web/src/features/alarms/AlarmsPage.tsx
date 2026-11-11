import { Alert, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { AlarmIcon, BellRingingIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTaskContext } from '../tasks/use-task-context';
import { AlarmList } from './AlarmList';
import { useAlarms } from './api';
import { useAlarmForm } from './use-alarm-form';
import { PageTitle } from '../../components/PageTitle';

/**
 * Alarms page: one-off and recurring reminders, alarms when no timer runs, and alarms during the timer.
 * They ring while Ordo is open in a tab.
 * @returns {JSX.Element} Page.
 */
export function AlarmsPage() {
  const { data: alarms, isPending } = useAlarms();
  const { context } = useTaskContext();
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'denied',
  );

  const openForm = useAlarmForm(context);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <PageTitle>Alarmes</PageTitle>
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
        <AlarmList alarms={alarms} context={context} openForm={openForm} />
      )}
    </Stack>
  );
}
