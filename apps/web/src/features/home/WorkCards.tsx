import { Badge, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import { addDays, formatDuration, nextOccurrence } from '@ordo/shared';
import { AlarmIcon, CalendarBlankIcon, CheckCircleIcon, CheckSquareOffsetIcon, ClockIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAlarms } from '../alarms/api';
import { useCalendarEvents } from '../calendar/api';
import type { Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { useTaskLink } from '../tasks/use-task-link';
import classes from './Home.module.css';
import { Figure, HomeCard, HomeEmpty } from './HomeCard';
import { dayLabel, daysBetween, localDayOf, type WeekTime } from './home-data';
import * as fmt from '../../lib/format';

const MAX_ROWS = 7;

interface TasksCardProps {
  context: TaskContext | null;
  /** My tasks of today, null while loading. */
  tasks: Task[] | null;
  today: string;
}

/**
 * My tasks of today, overdue first; a task opens in the side panel.
 * @param {TasksCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function TasksCard({ context, tasks, today }: TasksCardProps) {
  const link = useTaskLink();
  return (
    <HomeCard title="Mes tâches du jour" icon={<CheckSquareOffsetIcon aria-hidden />} to="/tasks" loading={!tasks || !context}>
      {tasks && context && tasks.length === 0 && <HomeEmpty icon={<CheckCircleIcon aria-hidden />}>Rien à faire aujourd’hui.</HomeEmpty>}
      {tasks && context && tasks.length > 0 && (
        <Stack gap={0}>
          {tasks.slice(0, MAX_ROWS).map((task) => {
            const status = task.statusId ? context.statusById.get(task.statusId) : undefined;
            const late = task.deadline !== null && task.deadline < today;
            return (
              <Link key={task.id} to={link.to(task.id)} className={classes.row}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Stack gap={0} miw={0}>
                    <Text size="sm" truncate>
                      {task.title}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {context.projectLabel(task.projectId)}
                      {task.number === null ? '' : ` · #${task.number}`}
                    </Text>
                  </Stack>
                  {late && task.deadline ? (
                    <Badge color="red" variant="light" style={{ flexShrink: 0 }}>
                      {daysBetween(task.deadline, today)} j de retard
                    </Badge>
                  ) : (
                    status && (
                      <Badge color={status.color} variant="light" style={{ flexShrink: 0 }}>
                        {status.name}
                      </Badge>
                    )
                  )}
                </Group>
              </Link>
            );
          })}
          {tasks.length > MAX_ROWS && (
            <Text size="xs" c="dimmed" pt={4}>
              + {tasks.length - MAX_ROWS} autre{tasks.length - MAX_ROWS > 1 ? 's' : ''}
            </Text>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}

interface AgendaItem {
  key: string;
  day: string;
  /** Hour, or null for the whole day. */
  time: string | null;
  title: string;
  alarm: boolean;
}

/**
 * Events and alarms of the coming seven days, by day (past events of today are left out).
 * @param {{ today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function AgendaCard({ today }: { today: string }) {
  const events = useCalendarEvents({ from: today, to: addDays(today, 6) });
  const alarms = useAlarms();
  const items = useMemo(() => {
    if (!events.data || !alarms.data) return null;
    const now = new Date();
    const until = addDays(today, 7);
    const list: AgendaItem[] = [];
    for (const event of events.data) {
      if (!event.allDay && event.end && Date.parse(String(event.end)) < now.getTime()) continue;
      const start = event.allDay ? null : new Date(String(event.start));
      list.push({ key: event.key, day: start ? localDayOf(start.toISOString()) : event.startDate, time: start ? fmt.time(start) : null, title: event.title, alarm: false });
    }
    for (const alarm of alarms.data) {
      if (!alarm.enabled || alarm.type === 'TRACKING_DURATION') continue;
      const next = nextOccurrence(alarm, now);
      if (!next) continue;
      const day = localDayOf(next.toISOString());
      if (day < until) list.push({ key: `alarm-${alarm.id}`, day, time: fmt.time(next), title: alarm.title, alarm: true });
    }
    return list.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? ''));
  }, [events.data, alarms.data, today]);

  const days = useMemo(() => {
    const groups = new Map<string, AgendaItem[]>();
    for (const item of (items ?? []).slice(0, MAX_ROWS + 1)) groups.set(item.day, [...(groups.get(item.day) ?? []), item]);
    return [...groups.entries()];
  }, [items]);

  return (
    <HomeCard title="Agenda" icon={<CalendarBlankIcon aria-hidden />} to="/calendar" linkLabel="Ouvrir l’agenda" loading={!items}>
      {items && items.length === 0 && <HomeEmpty icon={<CalendarBlankIcon aria-hidden />}>Rien de prévu cette semaine.</HomeEmpty>}
      {days.map(([day, list]) => (
        <Stack key={day} gap={2}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            {dayLabel(day, today)}
          </Text>
          {list.map((item) => (
            <Group key={item.key} gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed" w={48} style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {item.time ?? 'Journée'}
              </Text>
              {item.alarm && <AlarmIcon aria-label="Alarme" style={{ flexShrink: 0 }} />}
              <Text size="sm" truncate>
                {item.title}
              </Text>
            </Group>
          ))}
        </Stack>
      ))}
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
    <HomeCard title="Temps passé" icon={<ClockIcon aria-hidden />} to="/time" loading={!time || !context}>
      {time && context && (
        <Stack gap="sm">
          <SimpleGrid cols={2}>
            <Figure label="Aujourd’hui" value={formatDuration(time.today)} />
            <Figure label="Cette semaine" value={formatDuration(time.week)} />
          </SimpleGrid>
          {time.byProject.length === 0 ? (
            <HomeEmpty icon={<ClockIcon aria-hidden />}>Aucun temps saisi cette semaine.</HomeEmpty>
          ) : (
            time.byProject.slice(0, 4).map((item) => (
              <Link key={item.projectId} to={`/projects/${item.projectId}?tab=time`} className={classes.row}>
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
  const parent = project?.parentId ? context.projectById.get(project.parentId)?.title : null;
  return (
    <Text size="sm" truncate>
      {project?.title ?? 'Projet inconnu'}
      {parent && (
        <Text span size="xs" c="dimmed">
          {' '}
          · {parent}
        </Text>
      )}
    </Text>
  );
}
