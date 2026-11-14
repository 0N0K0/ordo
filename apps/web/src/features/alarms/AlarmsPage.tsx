import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { AlarmIcon, BellRingingIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTaskContext } from '../tasks/use-task-context';
import { AlarmList } from './AlarmList';
import { useAlarms } from './api';
import { useAlarmForm } from './use-alarm-form';
import classes from './AlarmsPage.module.css';

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
    <Stack gap="lg" className={classes.root}>
      <PageHeader title="Alarmes" actions={<ActionButton
          icon={<PlusIcon aria-hidden />}
          onClick={() => openForm()}
          disabled={!context}
        >Nouvelle alarme</ActionButton>} />

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
              variant="default"
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
        <ListSkeleton items={3} lines={2} />
      ) : !alarms?.length ? (
        <EmptyState icon={<AlarmIcon aria-hidden />} message="Aucune alarme." />
      ) : (
        <AlarmList alarms={alarms} context={context} openForm={openForm} />
      )}
    </Stack>
  );
}
