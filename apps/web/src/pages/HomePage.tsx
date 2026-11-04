import { Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { addDays, formatDuration } from '@ordo/shared';
import { FolderPlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { useAccountingDocuments } from '../features/accounting/documents-api';
import { useMe } from '../features/auth/api';
import { ChronoCard } from '../features/home/ChronoCard';
import { BillingCard, QuotesCard, TreasuryCard } from '../features/home/FinanceCards';
import { StatTile } from '../features/home/HomeCard';
import { billingSummary, money, useMyTodayTasks, useWeekTime } from '../features/home/home-data';
import { MailCard } from '../features/home/MailCard';
import { AgendaCard, MilestonesCard, TasksCard, TimeCard } from '../features/home/WorkCards';
import { useMailAccounts, useUnreadMailCount } from '../features/mail/api';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useTreasuryProjection } from '../features/treasury/api';
import { useEntityActions } from '../features/workspace/use-entity-actions';
import { localToday } from '../lib/dates';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * Text with a capital first letter.
 * @param {string} text Text.
 * @returns {string} Text.
 */
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Home page: everything at a glance. Quick creation of a client or a project, key figures (tasks, time,
 * mails, invoicing, treasury) linking to their pages, then condensed cards: tasks of the day, agenda, timer
 * and alarms, invoicing, quotes, treasury, unread mails, milestones and time.
 * @returns {JSX.Element} Home page.
 */
export function HomePage() {
  const { data: user } = useMe();
  const today = localToday();
  const { context } = useTaskContext();
  const myTasks = useMyTodayTasks(context, today);
  const time = useWeekTime(today);
  const documents = useAccountingDocuments();
  const summary = useMemo(() => (documents.data ? billingSummary(documents.data, today) : null), [documents.data, today]);
  const projection = useTreasuryProjection({ today, from: today, until: addDays(today, 90) });
  const in30 = addDays(today, 30);
  const at30 = projection.data ? [...projection.data.series].reverse().find((point) => point.date <= in30) : undefined;
  const accounts = useMailAccounts();
  const hasMail = (accounts.data?.length ?? 0) > 0;
  const unread = useUnreadMailCount(hasMail);
  const actions = useEntityActions();

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Stack gap={0}>
          <Title order={1} size="h2">
            Bonjour {user?.username}
          </Title>
          <Text c="dimmed">{capitalized(dateFormat.format(new Date(`${today}T00:00:00Z`)))}</Text>
        </Stack>
        <Group gap="sm">
          <Button variant="default" leftSection={<UserPlusIcon aria-hidden />} onClick={() => actions.openClientForm()}>
            Nouveau client
          </Button>
          <Button leftSection={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm()}>
            Nouveau projet
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, xl: 6 }} spacing="md">
        <StatTile
          label="Tâches du jour"
          value={myTasks.tasks?.length ?? 0}
          hint={myTasks.overdue > 0 ? `${myTasks.overdue} en retard` : 'Aucune en retard'}
          hintColor={myTasks.overdue > 0 ? 'red' : 'dimmed'}
          to="/tasks"
          loading={!myTasks.tasks}
        />
        <StatTile label="Temps cette semaine" value={formatDuration(time?.week ?? 0)} hint={`Aujourd’hui : ${formatDuration(time?.today ?? 0)}`} to="/time" loading={!time} />
        <StatTile
          label="Mails non lus"
          value={hasMail ? (unread.data ?? '—') : '—'}
          hint={hasMail ? 'Boîte de réception' : 'Aucune boîte configurée'}
          to="/mail"
          loading={accounts.isPending || (hasMail && unread.isPending)}
        />
        <StatTile
          label="À encaisser"
          value={money(summary?.receivable ?? 0)}
          hint={summary && summary.overdue > 0 ? `${money(summary.overdue)} en retard` : 'Rien en retard'}
          hintColor={summary && summary.overdue > 0 ? 'red' : 'dimmed'}
          to="/accounting?tab=overdue"
          loading={!summary}
        />
        <StatTile label="Devis en attente" value={summary?.pendingQuotes.length ?? 0} hint={`${money(summary?.pendingQuotesNet ?? 0)} HT`} to="/accounting" loading={!summary} />
        <StatTile
          label="Trésorerie"
          value={money(projection.data?.balance ?? 0)}
          hint={at30 ? `Dans 30 jours : ${money(at30.balance)}` : undefined}
          hintColor={at30 && at30.balance < 0 ? 'red' : 'dimmed'}
          to="/treasury"
          loading={!projection.data}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
        <TasksCard context={context} tasks={myTasks.tasks} today={today} />
        <AgendaCard today={today} />
        <ChronoCard context={context} />
        <BillingCard summary={summary} today={today} />
        <QuotesCard summary={summary} today={today} />
        <TreasuryCard projection={projection.data} today={today} />
        <MailCard today={today} />
        <MilestonesCard context={context} today={today} />
        <TimeCard context={context} time={time} />
      </SimpleGrid>
    </Stack>
  );
}
