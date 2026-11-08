import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { ActionIcon, Alert, Button, Checkbox, Group, Modal, MultiSelect, Paper, SegmentedControl, Stack, Switch, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { addDays, entrySeconds, formatDuration, plannedSlots, readScheduleDisplay } from '@ordo/shared';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, ClockIcon, DownloadSimpleIcon, FilePdfIcon, GearSixIcon, PlusIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useUpdateTask } from '../tasks/api';
import { useTaskContext } from '../tasks/use-task-context';
import { useTaskLink } from '../tasks/use-task-link';
import { useTimeEntriesSince } from '../time/api';
import { useNow } from '../time/use-now';
import { useTimeEntryDialogs } from '../time/use-time-dialogs';
import {
  calendarIcsUrl,
  scheduleRules,
  useCalendarCategories,
  useCalendarEventMutations,
  useCalendarEvents,
  useCalendars,
  useMaterializeTaskOccurrences,
  useSubscribedCalendarEvents,
  useScheduleTypes,
  useSubscribedSchedules,
  useWorkSchedules,
  type CalendarSubscription,
  type EventOccurrence,
} from './api';
import { askScope } from './ask-scope';
import classes from './CalendarPage.module.css';
import { downloadCalendarPdf, pdfItems } from './calendar-pdf';
import { categoryOptions, categorySubtree } from './category-tree';
import { localParts, occurrenceInput } from './event-input';
import { SubscribedEventModal } from './SubscribedEventModal';
import { useEventForm } from './use-event-form';
import { CalendarCategoriesManager } from './CalendarCategoriesManager';
import { CalendarsManager } from './CalendarsManager';
import { WorkSchedulesManager } from './WorkSchedulesManager';
import { useActiveWorkspace } from '../workspaces/api';

type View = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const VIEWS: { value: View; label: string }[] = [
  { value: 'dayGridMonth', label: 'Mois' },
  { value: 'timeGridWeek', label: 'Semaine' },
  { value: 'timeGridDay', label: 'Jour' },
];

interface Filters {
  tasks: boolean;
  /** Planned working hours, in the background. */
  workHours?: boolean;
  /** Tracked times (timers). */
  timers?: boolean;
  projectIds: string[];
  categoryIds: string[];
  contributorIds: string[];
  /** Calendars hidden (of the workspace, or of other workspaces it subscribes to). */
  hiddenCalendarIds?: string[];
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
 * Calendar: events and dated tasks by month, week or day, filtered by project, category and contributor;
 * calendars of the workspace, and those of other workspaces it subscribes to (read only), shown or hidden;
 * planned working hours in the background (none on paused days); tracked times (timers) on demand;
 * cancelled events struck through.
 * Events and tasks move and stretch by drag and drop; selecting a period creates an event. In week and
 * day views, the all-day row is collapsed by default and expands across every day. The
 * occurrences of recurring tasks are created for the displayed period only.
 * @returns {JSX.Element} Page.
 */
export function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const { context } = useTaskContext();
  const { data: categories } = useCalendarCategories();
  const { data: calendarsData } = useCalendars();
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
  const hidden = useMemo(() => new Set(filters.hiddenCalendarIds ?? []), [filters.hiddenCalendarIds]);
  const ownCalendars = useMemo(() => calendarsData?.calendars ?? [], [calendarsData]);
  const subscriptions = useMemo(() => calendarsData?.calendarSubscriptions ?? [], [calendarsData]);
  const shownSubscriptions = subscriptions.filter((subscription) => !hidden.has(subscription.calendarId));
  // Calendars of other workspaces: read in their workspaces, only when one is shown.
  const subscribedEvents = useSubscribedCalendarEvents(shownSubscriptions.length > 0 ? range : null);
  const [openedSubscribed, setOpenedSubscribed] = useState<{ occurrence: EventOccurrence; subscription: CalendarSubscription } | null>(null);
  const materialize = useMaterializeTaskOccurrences();
  const { update } = useCalendarEventMutations();
  const updateTask = useUpdateTask();
  const openEvent = useEventForm(context);
  const navigate = useNavigate();
  const taskLink = useTaskLink();
  const { data: schedules } = useWorkSchedules();
  const { data: scheduleTypes } = useScheduleTypes();
  const { data: foreignSchedules } = useSubscribedSchedules();
  const { perso } = useActiveWorkspace();
  const [managingSchedules, setManagingSchedules] = useState(false);
  // Tracked times of the displayed period (from its first day, local midnight).
  const showTimers = filters.timers === true;
  const timeEntries = useTimeEntriesSince(range ? new Date(`${range.from}T00:00:00`).toISOString() : null, showTimers && range !== null);
  const timerRunning = (timeEntries.data ?? []).some((entry) => entry.endedAt === null && entry.pausedAt === null);
  // A running timer grows every minute in the calendar.
  const now = useNow(showTimers && timerRunning);
  const minute = Math.floor(now / 60_000);
  const { openForm: openTimeEntry } = useTimeEntryDialogs(context);
  // A date to show (link to a postponed event…).
  const [params, setParams] = useSearchParams();
  const requestedDate = params.get('date');
  // Settings of the calendar (calendars, subscriptions, categories), opened from the URL too (?settings=1).
  const settingsOpen = params.get('settings') === '1';

  /**
   * Opens or closes the settings of the calendar (kept in the URL).
   * @param {boolean} open Whether they are shown.
   * @returns {void}
   */
  const showSettings = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('settings', '1');
    else next.delete('settings');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!requestedDate) return;
    calendarRef.current?.getApi().gotoDate(requestedDate);
    const next = new URLSearchParams(params);
    next.delete('date');
    setParams(next, { replace: true });
  }, [requestedDate, params, setParams]);

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
    const calendarColor = new Map(ownCalendars.map((calendar) => [calendar.id, calendar.color]));
    // Several calendars: each event shows the color of its own on its left.
    const striped = ownCalendars.length + subscriptions.length > 1;
    for (const occurrence of events.data ?? []) {
      if (hidden.has(occurrence.calendarId)) continue;
      if (!inProjects(occurrence.projectId)) continue;
      if (categoryFilter.size && !occurrence.categoryIds.some((id) => categoryFilter.has(id))) continue;
      if (filters.contributorIds.length && !occurrence.contributorIds.some((id) => filters.contributorIds.includes(id))) continue;
      const category = occurrence.categoryIds.map((id) => categoryById.get(id)).find(Boolean);
      const ofCalendar = calendarColor.get(occurrence.calendarId) ?? DEFAULT_COLOR;
      const color = category?.color ?? (occurrence.projectId ? context.projectById.get(occurrence.projectId)?.color : null) ?? ofCalendar;
      result.push({
        id: occurrence.key,
        title: occurrence.title,
        allDay: occurrence.allDay,
        start: occurrence.allDay ? occurrence.startDate : String(occurrence.start),
        end: occurrence.allDay ? addDays(occurrence.endDate, 1) : String(occurrence.end),
        backgroundColor: color,
        borderColor: striped ? ofCalendar : color,
        extendedProps: { kind: 'event', occurrence },
        classNames: [
          ...(striped ? [classes.calendarStripe] : []),
          ...(occurrence.occurrenceDate ? [classes.recurring] : []),
          ...(occurrence.calledOff ? [classes.closed] : []),
        ],
      });
    }
    // Calendars of other workspaces, read only: their projects, categories and contributors are not those of
    // this workspace, so a filter on them leaves them out.
    const filtering = filters.projectIds.length > 0 || categoryFilter.size > 0 || filters.contributorIds.length > 0;
    if (!filtering) {
      const subscriptionOf = new Map(subscriptions.map((subscription) => [subscription.calendarId, subscription]));
      for (const occurrence of subscribedEvents.data ?? []) {
        const subscription = subscriptionOf.get(occurrence.calendarId);
        if (!subscription || hidden.has(occurrence.calendarId)) continue;
        result.push({
          id: `subscribed:${occurrence.key}`,
          title: occurrence.title,
          allDay: occurrence.allDay,
          start: occurrence.allDay ? occurrence.startDate : String(occurrence.start),
          end: occurrence.allDay ? addDays(occurrence.endDate, 1) : String(occurrence.end),
          editable: false,
          backgroundColor: subscription.color,
          borderColor: subscription.color,
          extendedProps: { kind: 'subscribed', occurrence, subscription },
          classNames: [classes.subscribed, ...(occurrence.calledOff ? [classes.closed] : [])],
        });
      }
    }
    // Tracked times: blocks from their start to their end (now while running), in the color of their project.
    // A time spent on an event only shows its part outside the event.
    if (showTimers && range) {
      const occurrenceByKey = new Map((events.data ?? []).map((occurrence) => [`${occurrence.eventId}|${occurrence.occurrenceDate ?? ''}`, occurrence]));
      for (const entry of timeEntries.data ?? []) {
        if (!inProjects(entry.projectId)) continue;
        const start = new Date(entry.startedAt);
        if (dayOf(start) > range.to) continue;
        const running = entry.endedAt === null;
        const end = entry.endedAt ? new Date(entry.endedAt) : entry.pausedAt ? new Date(entry.pausedAt) : new Date(minute * 60_000 + 60_000);
        const project = context.projectById.get(entry.projectId);
        const color = project?.color ?? 'var(--mantine-color-gray-6)';
        const stop = end > start ? end : new Date(start.getTime() + 60_000);
        let parts: [Date, Date][] = [[start, stop]];
        const occurrence = entry.calendarEventId
          ? occurrenceByKey.get(`${entry.calendarEventId}|${entry.calendarOccurrenceDate ? String(entry.calendarOccurrenceDate) : ''}`)
          : undefined;
        if (occurrence && !occurrence.allDay) {
          const eventStart = new Date(occurrence.start);
          const eventEnd = new Date(occurrence.end);
          parts = parts.flatMap(([from, to]) =>
            [
              [from, new Date(Math.min(to.getTime(), eventStart.getTime()))],
              [new Date(Math.max(from.getTime(), eventEnd.getTime())), to],
            ].filter(([partStart, partEnd]) => partEnd.getTime() - partStart.getTime() >= 60_000) as [Date, Date][],
          );
        } else if (occurrence?.allDay) parts = [];
        parts.forEach(([partStart, partEnd], index) =>
          result.push({
            id: `time:${entry.id}:${index}`,
            title: `${running ? '● ' : ''}${occurrence ? `Hors « ${occurrence.title} » · ` : ''}${project?.title ?? 'Projet'}${entry.description ? ` — ${entry.description}` : ''} (${formatDuration(entrySeconds(entry, minute * 60_000))})`,
            start: partStart,
            end: partEnd,
            editable: false,
            backgroundColor: 'transparent',
            borderColor: color,
            textColor: 'var(--mantine-color-text)',
            extendedProps: { kind: 'time', entry },
            classNames: [classes.timer],
          }),
        );
      }
    }
    // Planned slots, in the color of their kind (working hours without one), shown as the kind (or the subscription
    // to it) asks: in the week and the day, a bar at the top (all-day row) and, in the time grid, their hours (the
    // whole day for an all-day slot) or the whole day in the background, or a thin line on the left of their hours;
    // in the month, the day in the background or a thin line at its bottom. Paused days simply have none. Slots of
    // other workspaces subscribed to are hatched.
    if (range && schedules && filters.workHours !== false) {
      const typeOf = new Map((scheduleTypes ?? []).map((type) => [type.id, type]));
      const own = schedules.map((schedule) => {
        const type = schedule.typeId ? typeOf.get(schedule.typeId) : undefined;
        return { rule: scheduleRules([schedule])[0], color: type?.color ?? null, name: type?.name ?? schedule.name, foreign: false, display: readScheduleDisplay(type) };
      });
      const subscribed = (foreignSchedules ?? []).map((schedule) => ({
        rule: scheduleRules([schedule])[0],
        color: schedule.color ?? null,
        name: `${schedule.typeName ?? schedule.name} · ${schedule.workspaceName}`,
        foreign: true,
        display: readScheduleDisplay(schedule),
      }));
      const month = view === 'dayGridMonth';
      for (const { rule, color, name, foreign, display } of [...own, ...subscribed]) {
        const hatched = foreign ? [classes.subscribedSlot] : [];
        const background = { display: 'background', ...(color ? { backgroundColor: color } : {}), classNames: [color ? classes.typedSlot : classes.workHours, ...hatched] };
        /**
         * Thin line of planned slots: a background event narrowed, in the full color.
         * @param {string} className Line on the left or at the bottom.
         * @returns {EventInput} Event props.
         */
        const line = (className: string) => ({ display: 'background', backgroundColor: color ?? 'var(--mantine-color-green-6)', classNames: [className] });
        const days = new Set<string>();
        for (const slot of plannedSlots([rule], range.from, range.to)) {
          const wholeDay = { start: `${slot.date}T00:00:00`, end: `${addDays(slot.date, 1)}T00:00:00` };
          if (!days.has(slot.date)) {
            days.add(slot.date);
            const day = { id: `work-day:${slot.scheduleId}:${slot.date}`, start: slot.date, end: addDays(slot.date, 1), allDay: true };
            if (month) {
              if (display.monthDisplay === 'BACKGROUND') result.push({ ...day, ...background });
              else if (display.monthDisplay === 'BORDER') result.push({ ...day, ...line(classes.slotBorderBottom) });
            } else {
              if (display.dayBar) {
                result.push({
                  ...day,
                  title: name,
                  editable: false,
                  backgroundColor: color ?? 'var(--mantine-color-green-light)',
                  borderColor: color ?? 'var(--mantine-color-green-light)',
                  textColor: 'var(--mantine-color-text)',
                  extendedProps: { kind: 'slot' },
                  classNames: [classes.slotBar, ...hatched],
                });
              }
              if (display.dayDisplay === 'DAY_BACKGROUND') result.push({ id: `work-whole:${slot.scheduleId}:${slot.date}`, ...wholeDay, ...background });
            }
          }
          if (month || (display.dayDisplay !== 'SLOT_BACKGROUND' && display.dayDisplay !== 'SLOT_BORDER')) continue;
          const hours = slot.allDay ? wholeDay : { start: `${slot.date}T${slot.start}:00`, end: `${slot.date}T${slot.end}:00` };
          result.push({ id: `work:${slot.scheduleId}:${slot.date}:${slot.start}`, ...hours, ...(display.dayDisplay === 'SLOT_BORDER' ? line(classes.slotBorderLeft) : background) });
        }
      }
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
          // Its number is only unique in its project: the project comes with it.
          title: context.taskLabel(task),
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
  }, [
    context,
    events.data,
    subscribedEvents.data,
    ownCalendars,
    subscriptions,
    hidden,
    filters,
    categoryFilter,
    categoryById,
    range,
    schedules,
    scheduleTypes,
    foreignSchedules,
    view,
    showTimers,
    timeEntries.data,
    minute,
  ]);

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
  const [exporting, setExporting] = useState(false);

  /**
   * Downloads the displayed view as a PDF (filters applied), to print.
   * @returns {Promise<void>}
   */
  const exportPdf = async () => {
    if (!range) return;
    setExporting(true);
    try {
      const filtersLabel = [
        filters.projectIds.length && context ? `Projets : ${filters.projectIds.map((id) => context.projectById.get(id)?.title ?? '').join(', ')}` : '',
        filters.categoryIds.length ? `Catégories : ${filters.categoryIds.map((id) => categoryById.get(id)?.name ?? '').join(', ')}` : '',
        filters.contributorIds.length && context ? `Contributeurs : ${filters.contributorIds.map((id) => context.contributorById.get(id)?.name ?? '').join(', ')}` : '',
      ].filter(Boolean);
      await downloadCalendarPdf({
        title,
        subtitle: ['Agenda', ...filtersLabel].join(' · '),
        view: view === 'dayGridMonth' ? 'month' : view === 'timeGridWeek' ? 'week' : 'day',
        from: range.from,
        to: range.to,
        today: localToday(),
        items: pdfItems(items, classes.closed),
      });
      notifySuccess('Agenda exporté.');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Export PDF impossible.');
    } finally {
      setExporting(false);
    }
  };

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
          <Tooltip label="Exporter la vue en PDF (pour l’imprimer)">
            <ActionIcon variant="default" size="lg" aria-label="Exporter la vue en PDF" loading={exporting} disabled={!range} onClick={() => void exportPdf()}>
              <FilePdfIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Exporter les calendriers de l’espace (.ics), pour un autre agenda">
            <ActionIcon component="a" href={calendarIcsUrl(null)} download variant="default" size="lg" aria-label="Exporter les calendriers (.ics)">
              <DownloadSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Button variant="default" leftSection={<ClockIcon aria-hidden />} onClick={() => setManagingSchedules(true)}>
            {perso ? 'Plages' : 'Plages de travail'}
          </Button>
          <Tooltip label="Calendriers, abonnements aux autres espaces, catégories">
            <Button variant="default" leftSection={<GearSixIcon aria-hidden />} onClick={() => showSettings(true)}>
              Paramètres
            </Button>
          </Tooltip>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openEvent()} disabled={!context}>
            Nouvel évènement
          </Button>
        </Group>
      </Group>

      <Group gap="md" wrap="wrap" align="center">
        <Text size="sm" fw={500}>
          Calendriers
        </Text>
        {[
          ...ownCalendars.map((calendar) => ({ id: calendar.id, label: calendar.name, color: calendar.color })),
          ...subscriptions.map((subscription) => ({ id: subscription.calendarId, label: `${subscription.name} · ${subscription.workspace.name}`, color: subscription.color })),
        ].map((calendar) => (
          <Checkbox
            key={calendar.id}
            size="xs"
            color={calendar.color}
            label={calendar.label}
            checked={!hidden.has(calendar.id)}
            onChange={(event) =>
              setFilters({
                ...filters,
                hiddenCalendarIds: event.currentTarget.checked ? [...hidden].filter((id) => id !== calendar.id) : [...hidden, calendar.id],
              })
            }
          />
        ))}
        <Tooltip label="Gérer les calendriers et les abonnements aux autres espaces">
          <ActionIcon variant="subtle" color="gray" aria-label="Gérer les calendriers" onClick={() => showSettings(true)}>
            <GearSixIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group gap="sm" wrap="wrap" align="flex-end">
        <Switch label="Tâches" checked={filters.tasks} onChange={(event) => setFilters({ ...filters, tasks: event.currentTarget.checked })} />
        <Switch label={perso ? 'Plages' : 'Plages de travail'} checked={filters.workHours !== false} onChange={(event) => setFilters({ ...filters, workHours: event.currentTarget.checked })} />
        <Switch label="Chronos" checked={showTimers} onChange={(event) => setFilters({ ...filters, timers: event.currentTarget.checked })} />
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

      {(events.error ?? materialize.error ?? subscribedEvents.error) && (
        <Alert color="red" icon={<ErrorIcon />} title="Agenda incomplet">
          {(events.error ?? materialize.error ?? subscribedEvents.error)?.message}
        </Alert>
      )}
      <SubscribedEventModal opened={openedSubscribed} onClose={() => setOpenedSubscribed(null)} />
      <Modal opened={settingsOpen} onClose={() => showSettings(false)} title="Paramètres de l’agenda" size="xl">
        {settingsOpen && (
          <Stack gap="md">
            <CalendarsManager />
            <CalendarCategoriesManager />
          </Stack>
        )}
      </Modal>
      <Modal opened={managingSchedules} onClose={() => setManagingSchedules(false)} title={perso ? 'Plages' : 'Plages de travail'} size="xl">
        {managingSchedules && <WorkSchedulesManager />}
      </Modal>
      <Paper withBorder radius="md" p="xs" className={classes.calendar}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          initialDate={requestedDate ?? undefined}
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
              defaults: {
                // A new event goes into the first calendar shown.
                calendarId: ownCalendars.find((calendar) => !hidden.has(calendar.id))?.id ?? null,
                ...(info.allDay
                ? { allDay: true, startDate: start.date, startTime: null, endDate: addDays(end.date, -1), endTime: null }
                  : { allDay: false, startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time }),
              },
            });
            info.view.calendar.unselect();
          }}
          eventClick={(info: EventClickArg) => {
            info.jsEvent.preventDefault();
            // A bar of planned slots opens nothing.
            if (info.event.extendedProps.kind === 'slot') return;
            if (info.event.extendedProps.kind === 'task') navigate(taskLink.to(info.event.extendedProps.task.id));
            else if (info.event.extendedProps.kind === 'time') openTimeEntry(info.event.extendedProps.entry);
            else if (info.event.extendedProps.kind === 'subscribed')
              setOpenedSubscribed({ occurrence: info.event.extendedProps.occurrence, subscription: info.event.extendedProps.subscription });
            else openEvent({ occurrence: info.event.extendedProps.occurrence });
          }}
          eventDrop={(info) => void handleChange(info)}
          eventResize={(info) => void handleChange(info)}
        />
      </Paper>
    </Stack>
  );
}
