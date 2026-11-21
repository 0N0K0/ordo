import { calendarPath, PAGES, projectPath } from '../../../app/pages';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { localDay } from '../../../lib/dates';
import { Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import { ItemBadge } from '../../../components/items/ItemBadge';
import { addDays, formatDuration } from '@ordo/shared';
import { nextRings } from '../../alarms/lib/alarm-labels';
import { AlarmIcon, CalendarBlankIcon, CheckCircleIcon, CheckSquareOffsetIcon, ClockIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAlarms } from '../../alarms/api';
import type { Task } from '../../tasks/api';
import { filterUses, isArchivedTaskRow, taskTableRows, type TaskTableRow } from '../../tasks/lib/task-columns';
import { useTaskColumns } from '../../tasks/hooks/use-task-columns';
import { useDefaultTableView, useViewRows } from '../../../components/data-table/views/use-default-view';
import { viewPath } from '../../../components/data-table/views/use-saved-views';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTaskLink } from '../../tasks/hooks/use-task-link';
import classes from './Home.module.css';
import tile from '../../../components/page/StatTile.module.css';
import { CardFigure, HomeCard } from './HomeCard';
import { HomeList, HomeRow } from './HomeList';
import { dayLabel, useHeldEvents, viewList, viewNote, type ViewItem, type WeekTime } from '../lib/home-data';
import * as fmt from '../../../lib/format';
import { LateBadge } from '../../../components/feedback/LateBadge';
import { taskNumber } from '../../tasks/hooks/use-task-context';
import { isTaskOverdue } from '../../tasks/lib/task-overdue';

interface TasksCardProps {
  context: TaskContext | null;
  /** My tasks of today, null while loading: shown when the tasks page has no view yet. */
  todayTasks: Task[] | null;
  today: string;
}

/**
 * Tasks of the default view of the tasks page (its filter, search, sorts and groups), archived ones left out; without
 * any view yet, my tasks of today, overdue first. A task opens in the side panel.
 * @param {TasksCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function TasksCard({ context, todayTasks, today }: TasksCardProps) {
  const link = useTaskLink();
  const { view, isPending } = useDefaultTableView('tasks');
  const columns = useTaskColumns(context, today, { doable: filterUses(view?.config.filter, 'doableNow') });
  const rows = useMemo(() => taskTableRows(context?.tasks ?? []), [context]);
  const shown = useViewRows({ view, columns, rows, archived: isArchivedTaskRow });
  const list = useMemo(() => {
    if (view) return viewList(shown, (row) => row.key);
    return { items: (todayTasks ?? []).map((task): ViewItem<TaskTableRow> => ({ key: task.id, group: '', row: { kind: 'task', key: task.id, task } })), group: undefined };
  }, [view, shown, todayTasks]);
  const loading = isPending || !context || (!view && !todayTasks);
  return (
    <HomeCard
      title={view ? 'Tâches' : 'Mes tâches du jour'}
      icon={<CheckSquareOffsetIcon aria-hidden />}
      to={view ? viewPath(PAGES.tasks.path, 'tasks', view.id) : PAGES.tasks.path}
      loading={loading}
      note={!isPending && viewNote(view, 'Tâches', 'mes tâches du jour')}
    >
      {!loading && context && list.items.length === 0 && <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message={view ? 'Aucune tâche dans cette vue.' : 'Rien à faire aujourd’hui.'} />}
      {!loading && context && list.items.length > 0 && (
        <HomeList
          items={list.items}
          group={list.group}
          render={({ key, row }) => {
            if (row.kind !== 'task') return null;
            const task = row.task;
            const status = task.statusId ? context.statusById.get(task.statusId) : undefined;
            const late = isTaskOverdue(task, today);
            return (
              <HomeRow
                key={key}
                to={link.to(task.id)}
                label={task.label}
                subtitle={[context.projectLabel(task.projectId), taskNumber(task)].filter(Boolean).join(' · ')}
                value={late && task.effectiveDeadline ? <LateBadge due={task.effectiveDeadline} today={today} /> : <ItemBadge item={status} />}
              />
            );
          }}
        />
      )}
    </HomeCard>
  );
}

interface AgendaItem {
  key: string;
  day: string;
  /** Hour, or null for the whole day. */
  time: string | null;
  label: string;
  alarm: boolean;
}

/**
 * Events and alarms of the seven days from today (today and the next six), in order, by day: an event started before
 * today and still running shows today, for the whole day; the events already over today are left out.
 * @param {{ today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function AgendaCard({ today }: { today: string }) {
  const events = useHeldEvents(today, addDays(today, 6));
  const alarms = useAlarms();
  const items = useMemo(() => {
    if (!events || !alarms.data) return null;
    const now = new Date();
    const until = addDays(today, 7);
    const list: AgendaItem[] = [];
    for (const event of events) {
      if (!event.allDay && event.end && Date.parse(event.end) < now.getTime()) continue;
      const start = event.allDay ? null : new Date(event.start);
      const day = start ? localDay(start) : event.startDate;
      // One started before today, still running, shows today, for the whole day.
      if (day < today) list.push({ key: event.key, day: today, time: null, label: event.label, alarm: false });
      else list.push({ key: event.key, day, time: start ? fmt.time(start) : null, label: event.label, alarm: false });
    }
    for (const { alarm, at: next } of nextRings(alarms.data, now)) {
      const day = localDay(next);
      if (day < until) list.push({ key: `alarm-${alarm.id}`, day, time: fmt.time(next), label: alarm.label, alarm: true });
    }
    return list.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? ''));
  }, [events, alarms.data, today]);

  return (
    <HomeCard title="Agenda" icon={<CalendarBlankIcon aria-hidden />} to={PAGES.calendar.path} linkLabel="Ouvrir l’agenda" loading={!items}>
      {items && items.length === 0 && <EmptyState compact icon={<CalendarBlankIcon aria-hidden />} message="Rien de prévu cette semaine." />}
      {items && items.length > 0 && (
        <HomeList
          items={items}
          group={{ key: (item) => item.day, title: (day) => dayLabel(day, today) }}
          render={(item) => (
            <HomeRow
              key={item.key}
              to={item.alarm ? PAGES.alarms.path : calendarPath(item.day)}
              label={
                <Group component="span" gap="xs" wrap="nowrap">
                  <Text span size="sm" c="dimmed" w={48} style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {item.time ?? 'Journée'}
                  </Text>
                  {item.alarm && <AlarmIcon aria-label="Alarme" style={{ flexShrink: 0 }} />}
                  <Text span size="sm" truncate>
                    {item.label}
                  </Text>
                </Group>
              }
            />
          )}
        />
      )}
    </HomeCard>
  );
}

interface TimeCardProps {
  context: TaskContext | null;
  time: WeekTime | null;
}

/**
 * Time tracked today and this week, and the projects it went to.
 * @param {TimeCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function TimeCard({ context, time }: TimeCardProps) {
  const max = time?.byProject[0]?.seconds ?? 0;
  return (
    <HomeCard title="Temps passé" icon={<ClockIcon aria-hidden />} to={PAGES.time.path} loading={!time || !context}>
      {time && context && (
        <Stack gap="sm">
          <SimpleGrid cols={2}>
            <CardFigure label="Aujourd’hui" value={formatDuration(time.today)} />
            <CardFigure label="Cette semaine" value={formatDuration(time.week)} />
          </SimpleGrid>
          {time.byProject.length === 0 ? (
            <EmptyState compact icon={<ClockIcon aria-hidden />} message="Aucun temps saisi cette semaine." />
          ) : (
            time.byProject.slice(0, 4).map((item) => (
              <Link key={item.projectId} to={projectPath(item.projectId, 'time')} className={`${tile.tile} ${classes.row}`}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <ProjectName context={context} projectId={item.projectId} />
                  <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                    {formatDuration(item.seconds)}
                  </Text>
                </Group>
                <Progress value={max ? (item.seconds / max) * 100 : 0} size="sm" mt={4} aria-hidden />
              </Link>
            ))
          )}
        </Stack>
      )}
    </HomeCard>
  );
}

/**
 * Title of a project, with its parent (or its client) in grey to tell apart projects of the same name.
 * @param {{ context: TaskContext, projectId: string }} props Component props.
 * @returns {JSX.Element} Name.
 */
function ProjectName({ context, projectId }: { context: TaskContext; projectId: string }) {
  const project = context.projectById.get(projectId);
  const parent = project?.parentId ? context.projectById.get(project.parentId)?.label : null;
  return (
    <Text size="sm" truncate>
      {project?.label ?? 'Projet inconnu'}
      {parent && (
        <Text span size="xs" c="dimmed">
          {' '}
          · {parent}
        </Text>
      )}
    </Text>
  );
}
