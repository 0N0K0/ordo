import { unarchived } from '../../../lib/archive';
import { CountBadge } from '../../../components/feedback/CountBadge';
import { Badge } from '@mantine/core';
import { formatDuration, sumOf } from '@ordo/shared';
import { countOf } from '../../../lib/text';
import { localToday } from '../../../lib/dates';
import { useHeldEvents, useMyTodayTasks, useWeekTime } from '../../home/lib/home-data';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimer } from '../../time/api';
import { useTreasuryAccounts } from '../../treasury/api';
import * as fmt from '../../../lib/format';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';

// Each badge is its own component: a running timer refreshes its badge every second, not the whole sidebar.

/**
 * Number of my tasks of today, in the lateness colour when some are overdue.
 * @returns {JSX.Element | null} Badge.
 */
export function TasksNavBadge() {
  const { context } = useTaskContext();
  const { tasks, overdue } = useMyTodayTasks(context, localToday());
  if (!tasks) return null;
  return (
    <CountBadge
      count={tasks.length}
      size="sm"
      variant={overdue ? 'filled' : 'light'}
      color={overdue ? LATE_COLOR : 'blue'}
      label={`${countOf(tasks.length, 'tâche')} aujourd’hui${overdue ? `, dont ${overdue} en retard` : ''}`}
    />
  );
}

/**
 * Number of events of today, the cancelled ones not counted.
 * @returns {JSX.Element | null} Badge.
 */
export function AgendaNavBadge() {
  const today = localToday();
  const events = useHeldEvents(today, today);
  if (!events) return null;
  return <CountBadge count={events.length} size="sm" variant="light" label={`${countOf(events.length, 'évènement')} aujourd’hui`} />;
}

/**
 * Time tracked today, red while a timer runs.
 * @returns {JSX.Element | null} Badge.
 */
export function TimeNavBadge() {
  const time = useWeekTime(localToday());
  const { data: running } = useRunningTimer();
  if (!time || (!time.today && !running)) return null;
  return (
    <Badge size="sm" variant="light" color={running ? 'red' : 'blue'} aria-label={`${formatDuration(time.today)} aujourd’hui${running ? ', chrono en cours' : ''}`}>
      {formatDuration(time.today)}
    </Badge>
  );
}

/**
 * Balance of the open accounts today, red when negative.
 * @returns {JSX.Element | null} Badge.
 */
export function TreasuryNavBadge() {
  const { data: accounts } = useTreasuryAccounts();
  const open = unarchived(accounts ?? []);
  if (open.length === 0) return null;
  const balance = sumOf(open, (account) => account.balance);
  return (
    <Badge size="sm" variant="light" color={balance < 0 ? 'red' : 'blue'} aria-label={`Solde du jour : ${fmt.moneyCompact(balance)}`}>
      {fmt.moneyCompact(balance)}
    </Badge>
  );
}
