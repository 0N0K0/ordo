import { PAGES } from '../../../app/pages';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Stack, Text } from '@mantine/core';
import { AlarmIcon, BellIcon, BellRingingIcon, PlusIcon, TimerIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { AlarmList } from '../components/AlarmList';
import { useAlarms } from '../api';
import { useAlarmForm } from '../hooks/use-alarm-form';
import classes from './AlarmsPage.module.css';
import { SubSection } from '../../../components/page/SubSection';
import { CountdownList } from '../../countdowns/components/CountdownList';
import { SavedCountdownsSettings } from '../../countdowns/components/SavedCountdownsSettings';
import { PageSettings } from '../../../app/layout/PageSettings';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { useIsBelowDesktop } from '../../../lib/use-is-phone';
import { SavedCountdownCards } from '../components/SavedCountdownCards';
import { UpcomingReminderList } from '../components/UpcomingReminderList';

/** Columns of the page, side by side on a large screen, tabs on a narrow one. */
const ALARM_COLUMNS = ['alarms', 'countdowns', 'reminders'] as const;
type AlarmColumn = (typeof ALARM_COLUMNS)[number];

/** Title and icon of each column (its tab on a narrow screen). */
const COLUMN_TITLES: Record<AlarmColumn, { label: string; icon: ReactNode }> = {
  alarms: { label: 'Alarmes', icon: <AlarmIcon aria-hidden /> },
  countdowns: { label: 'Minuteurs', icon: <TimerIcon aria-hidden /> },
  reminders: { label: 'Rappels à venir', icon: <BellRingingIcon aria-hidden /> },
};

/**
 * Alarms of the workspace, one card each: skeleton while loading, « Aucune alarme. » (with « Nouvelle alarme ») when
 * none.
 * @param {{ openForm: ReturnType<typeof useAlarmForm>, context: ReturnType<typeof useTaskContext>['context'] }} props Opener of the alarm form, task context.
 * @returns {JSX.Element} Column.
 */
function AlarmsColumn({ openForm, context }: { openForm: ReturnType<typeof useAlarmForm>; context: ReturnType<typeof useTaskContext>['context'] }) {
  const { data: alarms, isPending } = useAlarms();
  if (isPending || !context) return <ListSkeleton items={3} lines={2} />;
  if (!alarms?.length)
    return (
      <EmptyState
        icon={<AlarmIcon aria-hidden />}
        message="Aucune alarme."
        action={
          <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouvelle alarme
          </ActionButton>
        }
      />
    );
  return <AlarmList alarms={alarms} context={context} openForm={openForm} />;
}

/**
 * Alarms page, in three columns of cards (tabs on a narrow screen): « Alarmes » (one-off and recurring reminders,
 * alarms when no timer runs, alarms during the timer), « Minuteurs » (the timers of the user running, then the saved
 * timers of the workspace) and « Rappels à venir » (the reminders of the next occurrence of the events, tasks and
 * routines, for 30 days). They ring while Ordo is open in a tab. Its settings: the saved timers of the workspace.
 * @returns {JSX.Element} Page.
 */
export function AlarmsPage() {
  const { context } = useTaskContext();
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  const narrow = useIsBelowDesktop();
  const [tab, setTab] = usePageTab(ALARM_COLUMNS);

  const openForm = useAlarmForm(context);

  const columns: Record<AlarmColumn, ReactNode> = {
    alarms: <AlarmsColumn openForm={openForm} context={context} />,
    countdowns: (
      <Stack gap="md">
        <CountdownList withSaved={false} />
        <SavedCountdownCards />
      </Stack>
    ),
    reminders: <UpcomingReminderList />,
  };

  return (
    <Stack gap="lg" className={classes.root}>
      <PageHeader
        title={PAGES.alarms.label}
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

      {narrow ? (
        <PageTabs value={tab} onChange={(value) => setTab(value as AlarmColumn)} keepMounted={false}>
          <PageTabs.List>
            {ALARM_COLUMNS.map((column) => (
              <PageTabs.Tab key={column} value={column} leftSection={COLUMN_TITLES[column].icon}>
                {COLUMN_TITLES[column].label}
              </PageTabs.Tab>
            ))}
          </PageTabs.List>
          {ALARM_COLUMNS.map((column) => (
            <PageTabs.Panel key={column} value={column} className={classes.tab}>
              {columns[column]}
            </PageTabs.Panel>
          ))}
        </PageTabs>
      ) : (
        <div className={classes.columns}>
          {ALARM_COLUMNS.map((column) => (
            <SubSection key={column} title={COLUMN_TITLES[column].label} gap="sm">
              {columns[column]}
            </SubSection>
          ))}
        </div>
      )}
      <PageSettings title="Paramètres des alarmes">
        <SavedCountdownsSettings />
      </PageSettings>
    </Stack>
  );
}
