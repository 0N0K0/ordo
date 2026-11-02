import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { ActionIcon, Alert, Button, Group, MultiSelect, Paper, SegmentedControl, Stack, Switch, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { addDays } from '@ordo/shared';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, PlusIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError } from '../../lib/notify';
import { useUpdateTask } from '../tasks/api';
import { useTaskContext } from '../tasks/use-task-context';
import { useTaskLink } from '../tasks/use-task-link';
import { useCalendarCategories, useCalendarEventMutations, useCalendarEvents, useMaterializeTaskOccurrences, type EventOccurrence } from './api';
import { askScope } from './ask-scope';
import classes from './CalendarPage.module.css';
import { categoryOptions, categorySubtree } from './category-tree';
import { localParts, occurrenceInput } from './event-input';
import { useEventForm } from './use-event-form';

type View = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const VIEWS: { value: View; label: string }[] = [
  { value: 'dayGridMonth', label: 'Mois' },
  { value: 'timeGridWeek', label: 'Semaine' },
  { value: 'timeGridDay', label: 'Jour' },
];

interface Filters {
  tasks: boolean;
  projectIds: string[];
  categoryIds: string[];
  contributorIds: string[];
}

const DEFAULT_COLOR = 'var(--mantine-primary-color-filled)';
/** Rows of the collapsed all-day row (week and day views). */
const ALL_DAY_ROWS = 2;

/**
 * Local calendar date of a Date.
 * @param {Date} date Date.
 * @returns {string} YYYY-MM-DD.
 */
const dayOf = (date: Date) => localParts(date).date;

/**
 * Calendar: events and dated tasks by month, week or day, filtered by project, category and contributor.
 * Events and tasks move and stretch by drag and drop; selecting a period creates an event. In week and
 * day views, the all-day row is collapsed by default and expands across every day. The
 * occurrences of recurring tasks are created for the displayed period only.
 * @returns {JSX.Element} Page.
 */
export function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const { context } = useTaskContext();
  const { data: categories } = useCalendarCategories();
  const [view, setView] = useLocalStorage<View>({ key: 'ordo.calendar.view', defaultValue: 'timeGridWeek' });
  const [filters, setFilters] = useLocalStorage<Filters>({
    key: 'ordo.calendar.filters',
    defaultValue: { tasks: true, projectIds: [], categoryIds: [], contributorIds: [] },
  });
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  // Week and day: the all-day row (tasks…) is collapsed to a few rows, or expanded across every day.
  const [allDayExpanded, setAllDayExpanded] = useLocalStorage({ key: 'ordo.calendar.allDayExpanded', defaultValue: false });
  const [title, setTitle] = useState('');
  const events = useCalendarEvents(range);
  const materialize = useMaterializeTaskOccurrences();
  const { update } = useCalendarEventMutations();
  const updateTask = useUpdateTask();
  const openEvent = useEventForm(context);
  const navigate = useNavigate();
  const taskLink = useTaskLink();

  // Occurrences of recurring tasks exist once their period is displayed.
  const materializeMutate = materialize.mutate;
  useEffect(() => {
    // A failure is shown above the calendar.
    if (range) materializeMutate(range);
  }, [range, materializeMutate]);

  useEffect(() => {
    calendarRef.current?.getApi().changeView(view);
  }, [view]);

  const categoryById = useMemo(() => new Map((categories ?? []).map((category) => [category.id, category])), [categories]);
  // A category filter includes its sub-categories.
  const categoryFilter = useMemo(() => {
    const ids = new Set<string>();
    for (const id of filters.categoryIds) for (const sub of categorySubtree(categories ?? [], id)) ids.add(sub);
    return ids;
  }, [filters.categoryIds, categories]);

  const items = useMemo<EventInput[]>(() => {
    if (!context) return [];
    const inProjects = (projectId: string | null) => filters.projectIds.length === 0 || (projectId !== null && filters.projectIds.includes(projectId));
    const result: EventInput[] = [];
    for (const occurrence of events.data ?? []) {
      if (!inProjects(occurrence.projectId)) continue;
      if (categoryFilter.size && !occurrence.categoryIds.some((id) => categoryFilter.has(id))) continue;
      if (filters.contributorIds.length && !occurrence.contributorIds.some((id) => filters.contributorIds.includes(id))) continue;
      const category = occurrence.categoryIds.map((id) => categoryById.get(id)).find(Boolean);
      const color = category?.color ?? (occurrence.projectId ? context.projectById.get(occurrence.projectId)?.color : null) ?? DEFAULT_COLOR;
      result.push({
        id: occurrence.key,
        title: occurrence.title,
        allDay: occurrence.allDay,
        start: occurrence.allDay ? occurrence.startDate : String(occurrence.start),
        end: occurrence.allDay ? addDays(occurrence.endDate, 1) : String(occurrence.end),
        backgroundColor: color,
        borderColor: color,
        extendedProps: { kind: 'event', occurrence },
        classNames: occurrence.occurrenceDate ? [classes.recurring] : [],
      });
    }
    if (filters.tasks) {
      for (const task of context.tasks) {
        const start = task.startDate ?? task.endDate;
        if (!start || task.archived || !inProjects(task.projectId)) continue;
        if (filters.contributorIds.length && !task.assigneeIds.some((id) => filters.contributorIds.includes(id))) continue;
        if (categoryFilter.size) continue;
        const end = task.endDate && task.endDate >= start ? task.endDate : start;
        const color = context.projectById.get(task.projectId)?.color ?? 'var(--mantine-color-gray-6)';
        result.push({
          id: `task:${task.id}`,
          title: `#${task.number} ${task.title}`,
          allDay: true,
          start,
          end: addDays(end, 1),
          backgroundColor: 'transparent',
          borderColor: color,
          textColor: 'var(--mantine-color-text)',
          extendedProps: { kind: 'task', task },
          classNames: [classes.task, ...(task.closed ? [classes.closed] : [])],
        });
      }
    }
    return result;
  }, [context, events.data, filters, categoryFilter, categoryById]);

  /**
   * Saves an event or a task moved or stretched in the calendar (cancelled: back in place).
   * @param {EventDropArg | EventResizeDoneArg} info Change.
   * @returns {Promise<void>}
   */
  const handleChange = async (info: EventDropArg | EventResizeDoneArg) => {
    const { event, revert } = info;
    if (!event.start) return revert();
    const allDay = event.allDay;
    const startParts = localParts(event.start);
    // FullCalendar ends are exclusive; all-day dates here are inclusive.
    const endDate = event.end ?? new Date(event.start.getTime() + (allDay ? 86_400_000 : 3_600_000));
    const endParts = allDay ? { date: addDays(dayOf(endDate), -1), time: '' } : localParts(endDate);

    if (event.extendedProps.kind === 'task') {
      const task = event.extendedProps.task;
      const input = task.startDate
        ? { startDate: startParts.date, endDate: task.endDate ? endParts.date : null }
        : { endDate: endParts.date };
      updateTask.mutate({ id: task.id, input }, { onError: (error) => (notifyError(error.message), revert()) });
      return;
    }

    const occurrence = event.extendedProps.occurrence as EventOccurrence;
    let scope: 'THIS' | 'FOLLOWING' | 'ALL' = 'ALL';
    if (occurrence.occurrenceDate) {
      const chosen = await askScope({ action: 'update' });
      if (!chosen) return revert();
      scope = chosen;
    }
    update.mutate(
      {
        id: occurrence.eventId,
        scope,
        occurrenceDate: occurrence.occurrenceDate,
        input: {
          ...occurrenceInput(occurrence),
          allDay,
          startDate: startParts.date,
          startTime: allDay ? null : startParts.time,
          endDate: endParts.date < startParts.date ? startParts.date : endParts.date,
          endTime: allDay ? null : endParts.time,
        },
      },
      { onError: (error) => (notifyError(error.message), revert()) },
    );
  };

  const api = () => calendarRef.current?.getApi();

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <Title order={1} size="h2">
            Agenda
          </Title>
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button variant="default" size="sm" onClick={() => api()?.today()}>
            Aujourd’hui
          </Button>
          <Tooltip label="Précédent">
            <ActionIcon variant="default" size="lg" aria-label="Période précédente" onClick={() => api()?.prev()}>
              <CaretLeftIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Suivant">
            <ActionIcon variant="default" size="lg" aria-label="Période suivante" onClick={() => api()?.next()}>
              <CaretRightIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Text fw={600} miw={180} tt="capitalize" aria-live="polite">
            {title}
          </Text>
          <SegmentedControl data={VIEWS} value={view} onChange={(value) => setView(value as View)} aria-label="Vue" />
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openEvent()} disabled={!context}>
            Nouvel évènement
          </Button>
        </Group>
      </Group>

      <Group gap="sm" wrap="wrap" align="flex-end">
        <Switch label="Tâches" checked={filters.tasks} onChange={(event) => setFilters({ ...filters, tasks: event.currentTarget.checked })} />
        <MultiSelect
          size="xs"
          placeholder={filters.projectIds.length ? undefined : 'Tous les projets'}
          aria-label="Filtrer par projet"
          data={(context?.projects ?? []).filter((project) => !project.archived).map((project) => ({ value: project.id, label: context!.projectLabel(project.id) }))}
          value={filters.projectIds}
          onChange={(projectIds) => setFilters({ ...filters, projectIds })}
          searchable
          clearable
          w={240}
        />
        <MultiSelect
          size="xs"
          placeholder={filters.categoryIds.length ? undefined : 'Toutes les catégories'}
          aria-label="Filtrer par catégorie"
          data={categoryOptions(categories ?? [])}
          value={filters.categoryIds}
          onChange={(categoryIds) => setFilters({ ...filters, categoryIds })}
          searchable
          clearable
          w={240}
        />
        <MultiSelect
          size="xs"
          placeholder={filters.contributorIds.length ? undefined : 'Tous les contributeurs'}
          aria-label="Filtrer par contributeur"
          data={(context?.contributors ?? []).map((contributor) => ({ value: contributor.id, label: context!.contributorName(contributor) }))}
          value={filters.contributorIds}
          onChange={(contributorIds) => setFilters({ ...filters, contributorIds })}
          searchable
          clearable
          w={240}
        />
      </Group>

      {(events.error ?? materialize.error) && (
        <Alert color="red" icon={<ErrorIcon />} title="Agenda incomplet">
          {(events.error ?? materialize.error)?.message}
        </Alert>
      )}
      <Paper withBorder radius="md" p="xs" className={classes.calendar}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={frLocale}
          headerToolbar={false}
          // The month grows with its days (every task shown); week and day scroll in place.
          height={view === 'dayGridMonth' ? 'auto' : 'calc(100dvh - 250px)'}
          views={{ timeGrid: { dayMaxEventRows: allDayExpanded ? false : ALL_DAY_ROWS } }}
          allDayContent={() => (
            <Tooltip label={allDayExpanded ? 'Réduire la journée entière' : 'Développer la journée entière'}>
              <ActionIcon
                variant="light"
                size="sm"
                aria-label={allDayExpanded ? 'Réduire la ligne journée entière' : 'Développer la ligne journée entière'}
                aria-expanded={allDayExpanded}
                onClick={() => setAllDayExpanded(!allDayExpanded)}
              >
                {allDayExpanded ? <CaretUpIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
              </ActionIcon>
            </Tooltip>
          )}
          // "+N": expands the whole all-day row instead of opening a popover (same view and period: no move).
          moreLinkClick={(info) => {
            setAllDayExpanded(true);
            return info.view.type;
          }}
          firstDay={1}
          nowIndicator
          weekNumbers
          editable
          selectable
          selectMirror
          scrollTime="08:00:00"
          events={items}
          datesSet={(info: DatesSetArg) => {
            setTitle(info.view.title);
            const next = { from: dayOf(info.start), to: addDays(dayOf(info.end), -1) };
            setRange((current) => (current && current.from === next.from && current.to === next.to ? current : next));
          }}
          select={(info: DateSelectArg) => {
            const start = localParts(info.start);
            const end = localParts(info.end);
            openEvent({
              defaults: info.allDay
                ? { allDay: true, startDate: start.date, startTime: null, endDate: addDays(end.date, -1), endTime: null }
                : { allDay: false, startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time },
            });
            info.view.calendar.unselect();
          }}
          eventClick={(info: EventClickArg) => {
            info.jsEvent.preventDefault();
            if (info.event.extendedProps.kind === 'task') navigate(taskLink.to(info.event.extendedProps.task.number));
            else openEvent({ occurrence: info.event.extendedProps.occurrence });
          }}
          eventDrop={(info) => void handleChange(info)}
          eventResize={(info) => void handleChange(info)}
        />
      </Paper>
    </Stack>
  );
}
