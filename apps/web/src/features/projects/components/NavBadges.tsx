import { unarchived } from '../../../lib/archive';
import { Badge, type MantineColor } from '@mantine/core';
import { formatDuration, sumOf, isTaskOverdue } from '@ordo/shared';
import { countOf, plural } from '../../../lib/text';
import { useToday } from '../../../lib/use-now';
import { useHeldEvents, useHomeTasks, useMyTodayTasks, useWeekTime } from '../../home/lib/home-data';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimers } from '../../time/api';
import { useTreasuryAccounts } from '../../treasury/api';
import { useRoutineDay } from '../../routines/hooks/use-routine-day';
import { useNextRing } from '../../alarms/hooks/use-ring-sources';
import * as fmt from '../../../lib/format';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';

// Each badge is its own component: a running timer refreshes its badge every second, not the whole sidebar.

interface NavBadgeProps {
  /** What it shows (« 5 », « 3/7 », « 2 h 30 », « 12 min »); nothing: no badge. */
  value: string | null;
  /** What it says, for the screen readers (« 5 tâches faisables maintenant »). */
  label: string;
  /** Optional. Default = the primary color. */
  color?: MantineColor;
  /** Optional. Default = « light ». */
  variant?: 'filled' | 'light';
}

/**
 * Badge of an entry of the navigation: small, after its name, with its label for the screen readers; none without
 * value.
 * @param {NavBadgeProps} props Component props.
 * @returns {JSX.Element | null} Badge.
 */
export function NavBadge({ value, label, color, variant = 'light' }: NavBadgeProps) {
  if (!value) return null;
  return (
    <Badge size="sm" variant={variant} color={color} aria-label={label}>
      {value}
    </Badge>
  );
}

/**
 * Number of tasks that can be done now, as the « Maintenant » section of the home card « Tâches » (`useHomeTasks`:
 * the default view of the tasks page, else my tasks of today); filled in the lateness colour when some are overdue.
 * @returns {JSX.Element | null} Badge.
 */
export function TasksNavBadge() {
  const today = useToday();
  const { context } = useTaskContext();
  const { tasks } = useMyTodayTasks(context, today);
  const { items, nowCount, loading } = useHomeTasks(context, tasks, today);
  if (loading) return null;
  const overdue = items.filter((item) => item.section === 'now' && isTaskOverdue(item.task, today)).length;
  return (
    <NavBadge
      value={nowCount ? String(nowCount) : null}
      variant={overdue ? 'filled' : 'light'}
      color={overdue ? LATE_COLOR : undefined}
      label={`${countOf(nowCount, 'tâche')} ${plural(nowCount, 'faisable')} maintenant${overdue ? `, dont ${overdue} en retard` : ''}`}
    />
  );
}

/**
 * Routines of today, done out of planned (« 3/7 »), each time of the day counted, as the « Historique » tab of the
 * routines page (`useRoutineDay`).
 * @returns {JSX.Element | null} Badge.
 */
export function RoutinesNavBadge() {
  const { items, doneCount, loading } = useRoutineDay(useToday());
  if (loading) return null;
  return (
    <NavBadge
      value={items.length ? `${doneCount}/${items.length}` : null}
      color={doneCount === items.length ? 'green' : undefined}
      label={`${countOf(doneCount, 'routine faite', 'routines faites')} sur ${countOf(items.length, 'prévue')} aujourd’hui`}
    />
  );
}

/**
 * Number of events of today, all-day ones included, the cancelled ones not counted (`useHeldEvents`).
 * @returns {JSX.Element | null} Badge.
 */
export function AgendaNavBadge() {
  const today = useToday();
  const events = useHeldEvents(today, today);
  if (!events) return null;
  return <NavBadge value={events.length ? String(events.length) : null} label={`${countOf(events.length, 'évènement')} aujourd’hui`} />;
}

/**
 * Time tracked today, running timers counted up to now (`useWeekTime`), red while a timer runs (one or more).
 * @returns {JSX.Element | null} Badge.
 */
export function TimeNavBadge() {
  const time = useWeekTime(useToday());
  const running = Boolean(useRunningTimers().data?.length);
  if (!time) return null;
  const done = formatDuration(time.today);
  return <NavBadge value={Math.round(time.today / 60) ? done : null} color={running ? 'red' : undefined} label={`${done} aujourd’hui${running ? ', chrono en cours' : ''}`} />;
}

/**
 * How long until the next ring (« 12 min », « 2 h », « 3 j »), refreshed every minute: the same planners as the alarm
 * center (`useNextRing`).
 * @returns {JSX.Element | null} Badge.
 */
export function AlarmsNavBadge() {
  const { at, now } = useNextRing();
  if (!at) return null;
  const left = fmt.countdown((at.getTime() - now) / 1000);
  return <NavBadge value={left} label={`Prochaine sonnerie dans ${left}`} />;
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
  return <NavBadge value={fmt.moneyCompact(balance)} color={balance < 0 ? 'red' : undefined} label={`Solde du jour : ${fmt.moneyCompact(balance)}`} />;
}
