import { PAGES } from '../../../app/pages';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Stack, Text } from '@mantine/core';
import { AlarmIcon, PlusIcon, BellIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { AlarmList } from '../components/AlarmList';
import { useAlarms } from '../api';
import { useAlarmForm } from '../hooks/use-alarm-form';
import classes from './AlarmsPage.module.css';

/**
 * Alarms page: one-off and recurring reminders, alarms when no timer runs, and alarms during the timer.
 * They ring while Ordo is open in a tab.
 * @returns {JSX.Element} Page.
 */
export function AlarmsPage() {
  const { data: alarms, isPending } = useAlarms();
  const { context } = useTaskContext();
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  const openForm = useAlarmForm(context);

  return (
    <Stack gap="lg" className={classes.root}>
      <PageHeader
        title={PAGES.alarms.title}
        actions={
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context}>
            Nouvelle alarme
          </ActionButton>
        }
      />

      {permission === 'default' && (
        <NoticeAlert kind="info" title="Notifications du navigateur">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">Autorisez-les pour voir les alarmes même quand l’onglet d’Ordo n’est pas au premier plan.</Text>
            <ActionButton priority="secondary" size="xs" icon={<BellIcon aria-hidden />} onClick={() => void Notification.requestPermission().then(setPermission)}>
              Autoriser les notifications
            </ActionButton>
          </Stack>
        </NoticeAlert>
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
