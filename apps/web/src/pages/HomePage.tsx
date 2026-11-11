import { Button, Group, SimpleGrid, Stack, Title } from '@mantine/core';
import { addDays, formatDuration } from '@ordo/shared';
import { useLocalStorage } from '@mantine/hooks';
import { ArrowCounterClockwiseIcon, FolderPlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';
import { useAccountingDocuments, useImportedDocuments } from '../features/accounting/documents-api';
import { useMe } from '../features/auth/api';
import { ChronoCard } from '../features/home/ChronoCard';
import { BillingCard, QuotesCard, TreasuryCard } from '../features/home/FinanceCards';
import { StatTile } from '../features/home/HomeCard';
import { billingSummary, money, useMyTodayTasks, useWeekTime } from '../features/home/home-data';
import { MailCard } from '../features/home/MailCard';
import { SortableGrid } from '../features/home/SortableGrid';
import { AgendaCard, MilestonesCard, TasksCard, TimeCard } from '../features/home/WorkCards';
import { useMailAccounts, useUnreadMailCount } from '../features/mail/api';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useTreasuryProjection } from '../features/treasury/api';
import { useEntityActions } from '../features/workspace/use-entity-actions';
import { useActiveWorkspace } from '../features/workspaces/api';
import { localToday } from '../lib/dates';


type CardId = 'tasks' | 'agenda' | 'chrono' | 'billing' | 'quotes' | 'treasury' | 'mail' | 'milestones' | 'time';
const DEFAULT_ORDER: CardId[] = ['tasks', 'agenda', 'chrono', 'billing', 'quotes', 'treasury', 'mail', 'milestones', 'time'];

/** Cards a personal workspace does not have (no invoicing). */
const PRO_CARDS = new Set<CardId>(['billing', 'quotes']);

/**
 * Home page: everything at a glance. Quick creation of a client or a project, key figures (tasks, time,
 * mails, invoicing, treasury) linking to their pages, then condensed cards: tasks of the day, agenda, timer
 * and alarms, invoicing, quotes, treasury, unread mails, milestones and time, reordered by drag and drop
 * (order kept in the browser). A personal workspace has no client, invoicing nor quotes.
 * @returns {JSX.Element} Home page.
 */
export function HomePage() {
  const { data: user } = useMe();
  const today = localToday();
  const { context } = useTaskContext();
  const myTasks = useMyTodayTasks(context, today);
  const time = useWeekTime(today);
  const documents = useAccountingDocuments();
  const imported = useImportedDocuments();
  const summary = useMemo(() => (documents.data && imported.data ? billingSummary(documents.data, today, imported.data) : null), [documents.data, imported.data, today]);
  const projection = useTreasuryProjection({ today, from: today, until: addDays(today, 90) });
  const in30 = addDays(today, 30);
  const at30 = projection.data ? [...projection.data.series].reverse().find((point) => point.date <= in30) : undefined;
  const accounts = useMailAccounts();
  const hasMail = (accounts.data?.length ?? 0) > 0;
  const unread = useUnreadMailCount(hasMail);
  const actions = useEntityActions();
  const { perso } = useActiveWorkspace();
  const [storedOrder, setStoredOrder] = useLocalStorage<CardId[]>({ key: 'ordo.home.cards', defaultValue: DEFAULT_ORDER });
  // Cards added since the order was saved go last; removed ones are dropped.
  const order = [...storedOrder.filter((id) => DEFAULT_ORDER.includes(id)), ...DEFAULT_ORDER.filter((id) => !storedOrder.includes(id))];
  const customized = order.join() !== DEFAULT_ORDER.join();
  const shown = perso ? order.filter((id) => !PRO_CARDS.has(id)) : order;
  const cards: Record<CardId, ReactNode> = {
    tasks: <TasksCard context={context} tasks={myTasks.tasks} today={today} />,
    agenda: <AgendaCard today={today} />,
    chrono: <ChronoCard context={context} />,
    billing: <BillingCard summary={summary} today={today} />,
    quotes: <QuotesCard summary={summary} today={today} />,
    treasury: <TreasuryCard projection={projection.data} today={today} />,
    mail: <MailCard today={today} />,
    milestones: <MilestonesCard context={context} today={today} />,
    time: <TimeCard context={context} time={time} />,
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Title order={1} size="h2">
          Bonjour {user?.username}
        </Title>
        <Group gap="sm">
          {!perso && (
            <Button variant="default" leftSection={<UserPlusIcon aria-hidden />} onClick={() => actions.openClientForm()}>
              Nouveau client
            </Button>
          )}
          <Button leftSection={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm()}>
            Nouveau projet
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, xl: perso ? 4 : 6 }} spacing="md">
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
        {!perso && (
          <>
            <StatTile
              label="À encaisser"
              value={money(summary?.receivable ?? 0)}
              hint={summary && summary.overdue > 0 ? `${money(summary.overdue)} en retard` : 'Rien en retard'}
              hintColor={summary && summary.overdue > 0 ? 'red' : 'dimmed'}
              to="/accounting?tab=overdue"
              loading={!summary}
            />
            <StatTile label="Devis en attente" value={summary?.pendingQuotes.length ?? 0} hint={`${money(summary?.pendingQuotesNet ?? 0)} HT`} to="/accounting" loading={!summary} />
          </>
        )}
        <StatTile
          label="Trésorerie"
          value={money(projection.data?.balance ?? 0)}
          hint={at30 ? `Dans 30 jours : ${money(at30.balance)}` : undefined}
          hintColor={at30 && at30.balance < 0 ? 'red' : 'dimmed'}
          to="/treasury"
          loading={!projection.data}
        />
      </SimpleGrid>

      <SortableGrid
        items={shown.map((id) => ({ id, node: cards[id] }))}
        // Hidden cards go after the others.
        onReorder={(ids) => setStoredOrder([...(ids as CardId[]), ...order.filter((id) => !ids.includes(id))])}
      />
      {customized && (
        <Group justify="center">
          <Button variant="subtle" color="gray" size="xs" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => setStoredOrder(DEFAULT_ORDER)}>
            Disposition par défaut
          </Button>
        </Group>
      )}
    </Stack>
  );
}
