import { Badge } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { localToday } from '../../../lib/dates';
import { useCalendarEvents } from '../../calendar/api';
import { useMyTodayTasks, useWeekTime } from '../../home/home-data';
import { useTaskContext } from '../../tasks/use-task-context';
import { useRunningTimer } from '../../time/api';
import { useTreasuryAccounts } from '../../treasury/api';
import * as fmt from '../../../lib/format';

// Each badge is its own component: a running timer refreshes its badge every second, not the whole sidebar.

/**
 * Number of my tasks of today, red when some are overdue.
 * @returns {JSX.Element | null} Badge.
 */
export function TasksNavBadge() {
  const { context } = useTaskContext();
  const { tasks, overdue } = useMyTodayTasks(context, localToday());
  if (!tasks?.length) return null;
  return (
    <Badge size="sm" variant={overdue ? 'filled' : 'light'} color={overdue ? 'red' : 'blue'} aria-label={`${tasks.length} tâches aujourd’hui${overdue ? `, dont ${overdue} en retard` : ''}`}>
      {tasks.length}
    </Badge>
  );
}

/**
 * Number of events of today.
 * @returns {JSX.Element | null} Badge.
 */
export function AgendaNavBadge() {
  const today = localToday();
  const { data: events } = useCalendarEvents({ from: today, to: today });
  if (!events?.length) return null;
  return (
    <Badge size="sm" variant="light" aria-label={`${events.length} évènements aujourd’hui`}>
      {events.length}
    </Badge>
  );
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
    <Badge size="sm" variant="light" tt="none" color={running ? 'red' : 'blue'} aria-label={`${formatDuration(time.today)} aujourd’hui${running ? ', chrono en cours' : ''}`}>
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
  const open = accounts?.filter((account) => !account.archived) ?? [];
  if (open.length === 0) return null;
  const balance = open.reduce((sum, account) => sum + account.balance, 0);
  return (
    <Badge size="sm" variant="light" tt="none" color={balance < 0 ? 'red' : 'blue'} aria-label={`Solde du jour : ${fmt.moneyCompact(balance)}`}>
      {fmt.moneyCompact(balance)}
    </Badge>
  );
}
