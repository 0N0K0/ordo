import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { ActionIcon, Alert, Button, Checkbox, Group, Modal, Paper, SegmentedControl, Stack, Switch, Tabs, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { addDays, entrySeconds, formatDuration, plannedSlots, readScheduleDisplay, shiftTime, type ScheduleSlotTime } from '@ordo/shared';
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, CheckIcon, ClockIcon, DownloadSimpleIcon, FilePdfIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { localToday } from '../../lib/dates';
import { taskPlacement, type TaskSpanKind } from './task-calendar';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useRoutineOccurrences, useRoutinesData } from '../routines/api';
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
  useDefaultScheduleKind,
  useSubscribedSchedules,
  useWorkSchedules,
  type CalendarSubscription,
  type EventOccurrence,
} from './api';
import { askScope } from './ask-scope';
import { useCalendarEdits, type RoutineOccurrenceRef } from './calendar-edits';
import classes from './CalendarPage.module.css';
import { downloadCalendarPdf, pdfItems } from './calendar-pdf';
import { localParts, occurrenceInput } from './event-input';
import { SubscribedEventModal } from './SubscribedEventModal';
import { useEventForm } from './use-event-form';
import { CalendarCategoriesManager } from './CalendarCategoriesManager';
import { CalendarsManager } from './CalendarsManager';
import { PlacesManager } from '../geo/PlacesManager';
import { ScheduleSettings } from './ScheduleSettings';
import { WorkSchedulesManager } from './WorkSchedulesManager';
import { useActiveWorkspace } from '../workspaces/api';
import { PageTitle } from '../../components/PageTitle';
import { PageSettings } from '../../layouts/PageSettings';

type View = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

const VIEWS: { value: View; label: string }[] = [
  { value: 'dayGridMonth', label: 'Mois' },
  { value: 'timeGridWeek', label: 'Semaine' },
  { value: 'timeGridDay', label: 'Jour' },
];

interface Filters {
  tasks: boolean;
  /** Occurrences of the routines (shown by default). */
  routines?: boolean;
  /** Planned working hours, in the background. */
  workHours?: boolean;
  /** Tracked times (timers). */
  timers?: boolean;
  /** Calendars hidden (of the workspace, or of other workspaces it subscribes to). */
  hiddenCalendarIds?: string[];
}

/** Tabs of the settings sidebar. */
type SettingsTab = 'display' | 'settings';

/**
 * Section of the settings sidebar, framed like the managers of the settings tab.
 * @param {{ title: string, children: ReactNode }} props Component props.
 * @param {string} props.title Title of the section.
 * @param {ReactNode} props.children Content.
 * @returns {JSX.Element} Section.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Title order={2} size="h4">
          {title}
        </Title>
        {children}
      </Stack>
    </Paper>
  );
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
 * Calendar: events and dated tasks by month, week or day;
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
  const [view, setView] = useLocalStorage<View>({
    key: 'ordo.calendar.view',
    defaultValue: 'timeGridWeek',
  });
  const [filters, setFilters] = useLocalStorage<Filters>({
    key: 'ordo.calendar.filters',
    defaultValue: { tasks: true },
  });
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  // Week and day: the all-day row (tasks…) is collapsed to a few rows, or expanded across every day.
  const [allDayExpanded, setAllDayExpanded] = useLocalStorage({
    key: 'ordo.calendar.allDayExpanded',
    defaultValue: false,
  });
  const [title, setTitle] = useState('');
  const events = useCalendarEvents(range);
  const hidden = useMemo(() => new Set(filters.hiddenCalendarIds ?? []), [filters.hiddenCalendarIds]);
  const ownCalendars = useMemo(() => calendarsData?.calendars ?? [], [calendarsData]);
  const subscriptions = useMemo(() => calendarsData?.calendarSubscriptions ?? [], [calendarsData]);
  const shownSubscriptions = subscriptions.filter((subscription) => !hidden.has(subscription.calendarId));
  // Calendars of other workspaces: read in their workspaces, only when one is shown.
  const subscribedEvents = useSubscribedCalendarEvents(shownSubscriptions.length > 0 ? range : null);
  const [openedSubscribed, setOpenedSubscribed] = useState<{
    occurrence: EventOccurrence;
    subscription: CalendarSubscription;
  } | null>(null);
  const materialize = useMaterializeTaskOccurrences();
  const { update } = useCalendarEventMutations();
  const updateTask = useUpdateTask();
  const openEvent = useEventForm(context);
  const navigate = useNavigate();
  const taskLink = useTaskLink();
  const { data: schedules } = useWorkSchedules();
  const { data: scheduleTypes } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { data: foreignSchedules } = useSubscribedSchedules();
  const { perso } = useActiveWorkspace();
  // Tracked times of the displayed period (from its first day, local midnight).
  const showTimers = filters.timers === true;
  const timeEntries = useTimeEntriesSince(range ? new Date(`${range.from}T00:00:00`).toISOString() : null, showTimers && range !== null);
  const timerRunning = (timeEntries.data ?? []).some((entry) => entry.endedAt === null && entry.pausedAt === null);
  // A running timer grows every minute in the calendar.
  const now = useNow(showTimers && timerRunning);
  const minute = Math.floor(now / 60_000);
  const { openForm: openTimeEntry } = useTimeEntryDialogs(context);
  // Routines: at their times of the day, or in the all-day row with the tasks.
  const showRoutines = filters.routines !== false;
  const { data: routinesData } = useRoutinesData();
  const routineOccurrences = useRoutineOccurrences(range, showRoutines);
  // Slots of the schedules and routines changed in the calendar (an exception, the following ones, or all).
  const edits = useCalendarEdits();
  // Slots of the schedules of the workspace shown as events, to move, stretch, change or delete.
  const [editingSlots, setEditingSlots] = useState(false);
  // A date to show (link to a postponed event…).
  const [params, setParams] = useSearchParams();
  const requestedDate = params.get('date');
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

  const items = useMemo<EventInput[]>(() => {
    if (!context) return [];
    const result: EventInput[] = [];
    const calendarColor = new Map(ownCalendars.map((calendar) => [calendar.id, calendar.color]));
    // Several calendars: each event shows the color of its own on its left.
    const striped = ownCalendars.length + subscriptions.length > 1;
    for (const occurrence of events.data ?? []) {
      if (hidden.has(occurrence.calendarId)) continue;
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
        classNames: [...(striped ? [classes.calendarStripe] : []), ...(occurrence.occurrenceDate ? [classes.recurring] : []), ...(occurrence.calledOff ? [classes.closed] : [])],
      });
      // Travel to the event and back, in the week and the day: hatched blocks in its color, against it, opening it.
      if (!occurrence.allDay && view !== 'dayGridMonth') {
        const start = new Date(String(occurrence.start)).getTime();
        const end = new Date(String(occurrence.end)).getTime();
        const legs = [
          {
            key: 'before',
            minutes: occurrence.travelBefore,
            from: start - occurrence.travelBefore * 60_000,
            to: start,
            title: 'Trajet aller',
          },
          {
            key: 'after',
            minutes: occurrence.travelAfter,
            from: end,
            to: end + occurrence.travelAfter * 60_000,
            title: 'Trajet retour',
          },
        ];
        for (const leg of legs) {
          if (leg.minutes <= 0) continue;
          result.push({
            id: `travel:${leg.key}:${occurrence.key}`,
            title: `${leg.title} · ${formatDuration(leg.minutes * 60)}`,
            start: new Date(leg.from).toISOString(),
            end: new Date(leg.to).toISOString(),
            editable: false,
            backgroundColor: 'transparent',
            borderColor: color,
            textColor: 'var(--mantine-color-dimmed)',
            extendedProps: { kind: 'travel', occurrence },
            classNames: [classes.travel, ...(occurrence.calledOff ? [classes.closed] : [])],
          });
        }
      }
    }
    // Calendars of other workspaces, read only.
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
    // Tracked times: blocks from their start to their end (now while running), in the color of their project.
    // A time spent on an event only shows its part outside the event.
    if (showTimers && range) {
      const occurrenceByKey = new Map((events.data ?? []).map((occurrence) => [`${occurrence.eventId}|${occurrence.occurrenceDate ?? ''}`, occurrence]));
      for (const entry of timeEntries.data ?? []) {
        const start = new Date(entry.startedAt);
        if (dayOf(start) > range.to) continue;
        const running = entry.endedAt === null;
        const end = entry.endedAt ? new Date(entry.endedAt) : entry.pausedAt ? new Date(entry.pausedAt) : new Date(minute * 60_000 + 60_000);
        const project = entry.projectId ? context.projectById.get(entry.projectId) : undefined;
        const color = project?.color ?? 'var(--mantine-color-gray-6)';
        const stop = end > start ? end : new Date(start.getTime() + 60_000);
        let parts: [Date, Date][] = [[start, stop]];
        const occurrence = entry.calendarEventId ? occurrenceByKey.get(`${entry.calendarEventId}|${entry.calendarOccurrenceDate ? String(entry.calendarOccurrenceDate) : ''}`) : undefined;
        if (occurrence && !occurrence.allDay) {
          const eventStart = new Date(occurrence.start);
          const eventEnd = new Date(occurrence.end);
          parts = parts.flatMap(
            ([from, to]) =>
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
    if (range && schedules && (filters.workHours !== false || editingSlots)) {
      const typeOf = new Map((scheduleTypes ?? []).map((type) => [type.id, type]));
      const own = schedules.map((schedule) => {
        const type = schedule.typeId ? typeOf.get(schedule.typeId) : undefined;
        // Without kind: the default kind of the workspace.
        const kind = type ?? defaultKind;
        return {
          rule: scheduleRules([schedule])[0],
          color: kind?.color ?? null,
          name: kind?.name ?? schedule.name,
          foreign: false,
          display: readScheduleDisplay(kind),
        };
      });
      const subscribed = (foreignSchedules ?? []).map((schedule) => ({
        rule: scheduleRules([schedule])[0],
        color: schedule.color ?? null,
        name: `${schedule.typeName ?? schedule.name} · ${schedule.workspaceName}`,
        foreign: true,
        display: readScheduleDisplay(schedule),
      }));
      const month = view === 'dayGridMonth';
      // Lines of several schedules on a day stand side by side (week, day) or one above the other (month): each
      // schedule with a line that day takes the next lane.
      const lanes = new Map<string, number>();
      for (const { rule, color, name, foreign, display } of [...own, ...subscribed]) {
        if (!foreign && editingSlots) {
          // Being changed: each slot an event, moved to another day or hour, stretched, or opened.
          for (const slot of plannedSlots([rule], range.from, range.to)) {
            const time: ScheduleSlotTime = { date: slot.date, start: slot.start, end: slot.end, allDay: slot.allDay };
            result.push({
              id: `edit-slot:${rule.id}:${slot.date}:${slot.start}:${slot.end}`,
              title: name,
              allDay: slot.allDay,
              start: slot.allDay ? slot.date : `${slot.date}T${slot.start}:00`,
              end: slot.allDay ? addDays(slot.date, 1) : `${slot.date}T${slot.end}:00`,
              backgroundColor: color ?? 'var(--mantine-color-green-light)',
              borderColor: color ?? 'var(--mantine-color-green-6)',
              textColor: 'var(--mantine-color-text)',
              classNames: [classes.editSlot],
              durationEditable: !slot.allDay,
              extendedProps: { kind: 'editSlot', schedule: rule, name, slot: time },
            });
          }
          continue;
        }
        if (filters.workHours === false) continue;
        const hatched = foreign ? [classes.subscribedSlot] : [];
        const background = {
          display: 'background',
          ...(color ? { backgroundColor: color } : {}),
          classNames: [color ? classes.typedSlot : classes.workHours, ...hatched],
        };
        /**
         * Thin line of planned slots: a background event narrowed, in the full color.
         * @param {string} className Line on the left or at the bottom.
         * @returns {EventInput} Event props.
         */
        const line = (className: string, lane: number) => ({
          display: 'background',
          backgroundColor: color ?? 'var(--mantine-color-green-6)',
          classNames: [className],
          extendedProps: { slotLane: lane },
        });
        const days = new Set<string>();
        let lane = 0;
        for (const slot of plannedSlots([rule], range.from, range.to)) {
          const wholeDay = {
            start: `${slot.date}T00:00:00`,
            end: `${addDays(slot.date, 1)}T00:00:00`,
          };
          if (!days.has(slot.date)) {
            days.add(slot.date);
            if ((month && display.monthDisplay === 'BORDER') || (!month && display.dayDisplay === 'SLOT_BORDER')) {
              lane = lanes.get(slot.date) ?? 0;
              lanes.set(slot.date, lane + 1);
            }
            const day = {
              id: `work-day:${slot.scheduleId}:${slot.date}`,
              start: slot.date,
              end: addDays(slot.date, 1),
              allDay: true,
            };
            if (month) {
              if (display.monthDisplay === 'BACKGROUND') result.push({ ...day, ...background });
              else if (display.monthDisplay === 'BORDER')
                result.push({
                  ...day,
                  id: `${day.id}:${lane}`,
                  ...line(classes.slotBorderBottom, lane),
                });
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
              if (display.dayDisplay === 'DAY_BACKGROUND')
                result.push({
                  id: `work-whole:${slot.scheduleId}:${slot.date}`,
                  ...wholeDay,
                  ...background,
                });
            }
          }
          if (month || (display.dayDisplay !== 'SLOT_BACKGROUND' && display.dayDisplay !== 'SLOT_BORDER')) continue;
          const hours = slot.allDay
            ? wholeDay
            : {
                start: `${slot.date}T${slot.start}:00`,
                end: `${slot.date}T${slot.end}:00`,
              };
          result.push({
            // The lane in the id: a line moved to another lane is drawn again (see eventDidMount).
            id: `work:${slot.scheduleId}:${slot.date}:${slot.start}:${lane}`,
            ...hours,
            ...(display.dayDisplay === 'SLOT_BORDER' ? line(classes.slotBorderLeft, lane) : background),
          });
        }
      }
    }
    if (filters.tasks) {
      const today = localToday();
      for (const task of context.tasks) {
        if (task.archived) continue;
        // Its dates, from start to end or to today; its latest acceptable date apart, today when late.
        const { span, deadline, overdue } = taskPlacement(task, today);
        const color = context.projectById.get(task.projectId)?.color ?? 'var(--mantine-color-gray-6)';
        // Its number is only unique in its project: the project comes with it (without « Sans client »).
        const label = `${context.projectLabel(task.projectId).replace(/^Sans client › /, '')} #${task.number} ${task.title}`;
        const look = {
          allDay: true,
          backgroundColor: 'transparent',
          borderColor: color,
          textColor: 'var(--mantine-color-text)',
          classNames: [classes.task, ...(task.closed ? [classes.closed] : [])],
        };
        if (span) {
          result.push({
            ...look,
            id: `task:${task.id}`,
            title: label,
            start: span.start,
            end: addDays(span.end, 1),
            // Up to a date the task does not hold (today, its latest date): moving it moves its start only.
            durationEditable: span.kind === 'dates',
            // Late and carried by its span (up to today): in red.
            ...(overdue && !deadline ? { borderColor: 'var(--mantine-color-red-6)' } : {}),
            extendedProps: { kind: 'task', task, part: span.kind },
          });
        }
        if (deadline) {
          result.push({
            ...look,
            id: `task-deadline:${task.id}`,
            title: label,
            start: deadline,
            end: addDays(deadline, 1),
            durationEditable: false,
            borderColor: overdue ? 'var(--mantine-color-red-6)' : color,
            classNames: [...look.classNames, classes.deadline],
            extendedProps: { kind: 'task', task, part: 'deadline' },
          });
        }
      }
    }
    if (showRoutines) {
      const routineById = new Map((routinesData?.routines ?? []).map((routine) => [routine.id, routine]));
      const routineCategory = new Map((routinesData?.routineCategories ?? []).map((category) => [category.id, category]));
      for (const occurrence of routineOccurrences.data ?? []) {
        const routine = routineById.get(occurrence.routineId);
        if (!routine || routine.archived) continue;
        const category = routine.categoryIds.map((id) => routineCategory.get(id)).find((item) => item?.color);
        const color = category?.color ?? (routine.projectId ? context.projectById.get(routine.projectId)?.color : null) ?? 'var(--mantine-color-gray-6)';
        const minutes = routine.estimate ?? 30;
        const slots = occurrence.slots.length ? occurrence.slots : [{ index: 0, fromTime: null, dueTime: null, optional: false, done: false }];
        for (const slot of slots) {
          // Between its two times, else up to its latest time or from its start time for the time to spend on it.
          // Within its day (shifted across midnight: from its start of day, or up to its end).
          const before = slot.dueTime ? shiftTime(slot.dueTime, -minutes) : null;
          const after = slot.fromTime ? shiftTime(slot.fromTime, minutes) : null;
          const start = slot.fromTime ?? (before && slot.dueTime && before < slot.dueTime ? before : '00:00');
          const end = slot.dueTime ?? (after && slot.fromTime && after > slot.fromTime ? after : '23:59');
          const timed = (slot.fromTime !== null || slot.dueTime !== null) && start < end;
          result.push({
            id: `routine:${routine.id}:${occurrence.date}:${slot.index}`,
            title: `${routine.title}${slot.optional ? ' (facultatif)' : ''}`,
            allDay: !timed,
            start: timed ? `${occurrence.date}T${start}:00` : occurrence.date,
            end: timed ? `${occurrence.date}T${end}:00` : addDays(occurrence.date, 1),
            backgroundColor: 'transparent',
            borderColor: color,
            textColor: 'var(--mantine-color-text)',
            classNames: [classes.task, classes.routine, ...(slot.done ? [classes.closed] : []), ...(occurrence.movedFrom ? [classes.moved] : [])],
            // Dragged to another day or hour, or stretched (between two times): asks which occurrences change.
            startEditable: !occurrence.slots.some((item) => item.done),
            durationEditable: !occurrence.slots.some((item) => item.done) && slot.fromTime !== null && slot.dueTime !== null,
            extendedProps: {
              kind: 'routine',
              occurrence: { routine, date: occurrence.date, slot: { index: slot.index, fromTime: slot.fromTime, dueTime: slot.dueTime } } satisfies RoutineOccurrenceRef,
              movedFrom: occurrence.movedFrom ? String(occurrence.movedFrom) : null,
            },
          });
        }
      }
    }
    return result;
  }, [
    editingSlots,
    showRoutines,
    routinesData,
    routineOccurrences.data,
    context,
    events.data,
    subscribedEvents.data,
    ownCalendars,
    subscriptions,
    hidden,
    filters,
    categoryById,
    range,
    schedules,
    scheduleTypes,
    defaultKind,
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

    if (event.extendedProps.kind === 'editSlot') {
      const slot: ScheduleSlotTime = event.extendedProps.slot;
      // Up to midnight: the end of its day.
      const end = endParts.date === addDays(startParts.date, 1) && endParts.time === '00:00' ? '23:59' : endParts.time;
      if (!allDay && endParts.date !== startParts.date && end !== '23:59') {
        revert();
        notifyError('Une plage s’arrête le jour où elle commence.');
        return;
      }
      const change: ScheduleSlotTime = allDay ? { date: startParts.date, start: '00:00', end: '24:00', allDay: true } : { date: startParts.date, start: startParts.time, end, allDay: false };
      void edits.changeSlot(event.extendedProps.schedule, slot, change, revert);
      return;
    }

    if (event.extendedProps.kind === 'routine') {
      const occurrence: RoutineOccurrenceRef = event.extendedProps.occurrence;
      const { fromTime, dueTime } = occurrence.slot;
      let times: { fromTime: string | null; dueTime: string | null };
      if (allDay) times = { fromTime: null, dueTime: null };
      else if (info.oldEvent.allDay) times = { fromTime: startParts.time, dueTime: endParts.date === startParts.date ? endParts.time : null };
      else if ('endDelta' in info && !('delta' in info)) times = { fromTime, dueTime: endParts.date === startParts.date ? endParts.time : null };
      else {
        // Its times move by as much as the event within the day.
        const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
        const shift = minutes(startParts.time) - minutes(localParts(info.oldEvent.start ?? event.start).time);
        const moved = (time: string | null) => (time === null ? null : minutes(time) + shift);
        const [from, due] = [moved(fromTime), moved(dueTime)];
        if ((from !== null && (from < 0 || from >= 1440)) || (due !== null && (due < 0 || due >= 1440))) {
          revert();
          notifyError('Une routine reste dans sa journée.');
          return;
        }
        times = { fromTime: from === null ? null : shiftTime('00:00', from), dueTime: due === null ? null : shiftTime('00:00', due) };
      }
      if (startParts.date === occurrence.date && times.fromTime === fromTime && times.dueTime === dueTime) return;
      void edits.changeRoutine(occurrence, startParts.date, times, revert);
      return;
    }

    if (event.extendedProps.kind === 'task') {
      const task = event.extendedProps.task;
      const part: TaskSpanKind | 'deadline' = event.extendedProps.part;
      // Its latest acceptable date, a span up to a date it does not hold (its start only), or its dates.
      const input =
        part === 'deadline'
          ? { deadline: startParts.date }
          : part === 'open' || !task.endDate
            ? task.startDate
              ? { startDate: startParts.date }
              : { endDate: endParts.date }
            : task.startDate
              ? { startDate: startParts.date, endDate: endParts.date }
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
  const [managingSchedules, setManagingSchedules] = useState(false);
  const [settingsTab, setSettingsTab] = useLocalStorage<SettingsTab>({
    key: 'ordo.calendar.settingsTab',
    defaultValue: 'display',
  });
  // Calendars that can be shown: those of the workspace, and those of other workspaces it subscribes to.
  const calendarChoices = [
    ...ownCalendars.map((calendar) => ({
      id: calendar.id,
      label: calendar.name,
      color: calendar.color,
    })),
    ...subscriptions.map((subscription) => ({
      id: subscription.calendarId,
      label: `${subscription.name} · ${subscription.workspace.name}`,
      color: subscription.color,
    })),
  ];
  const [exporting, setExporting] = useState(false);

  /**
   * Downloads the displayed view as a PDF (calendars shown, tasks, slots and timers as displayed), to print.
   * @returns {Promise<void>}
   */
  const exportPdf = async () => {
    if (!range) return;
    setExporting(true);
    try {
      await downloadCalendarPdf({
        title,
        subtitle: 'Agenda',
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

  // The week and the day fill the window (scrolling in place); the month grows with its days.
  const fill = view !== 'dayGridMonth';
  return (
    <Stack gap="md" className={fill ? classes.fill : undefined}>
      <PageTitle>Agenda</PageTitle>
      {/* The view and the period on the left, the slots and a new event on the right. */}
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="wrap">
          <SegmentedControl data={VIEWS} value={view} onChange={(value) => setView(value as View)} aria-label="Vue" />
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
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button variant="default" leftSection={<ClockIcon aria-hidden />} onClick={() => setManagingSchedules(true)}>
            {perso ? 'Plages' : 'Plages de travail'}
          </Button>
          <Tooltip label={editingSlots ? 'Revenir à l’affichage des plages' : 'Déplacer, étirer, changer ou supprimer les plages dans l’agenda'}>
            <Button
              variant={editingSlots ? 'filled' : 'default'}
              aria-pressed={editingSlots}
              leftSection={editingSlots ? <CheckIcon aria-hidden /> : <PencilSimpleIcon aria-hidden />}
              onClick={() => setEditingSlots(!editingSlots)}
            >
              {editingSlots ? 'Terminer' : 'Modifier les plages'}
            </Button>
          </Tooltip>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openEvent()} disabled={!context}>
            Nouvel évènement
          </Button>
        </Group>
      </Group>

      {(events.error ?? materialize.error ?? subscribedEvents.error) && (
        <Alert color="red" icon={<ErrorIcon />} title="Agenda incomplet">
          {(events.error ?? materialize.error ?? subscribedEvents.error)?.message}
        </Alert>
      )}
      <SubscribedEventModal opened={openedSubscribed} onClose={() => setOpenedSubscribed(null)} />
      {/*
       * In the settings sidebar (?settings=1): first what the agenda shows and its export; then
       * the calendars, subscriptions, categories, kinds of slots and places.
       */}
      <PageSettings title="Paramètres de l’agenda">
        <Tabs value={settingsTab} onChange={(value) => value && setSettingsTab(value as SettingsTab)}>
          <Tabs.List mb="md">
            <Tabs.Tab value="display">Affichage et export</Tabs.Tab>
            <Tabs.Tab value="settings">Paramètres</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="display">
            <Stack gap="md">
              <SettingsSection title="Affichage">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Calendriers
                  </Text>
                  {calendarChoices.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Aucun calendrier.
                    </Text>
                  ) : (
                    calendarChoices.map((calendar) => (
                      <Checkbox
                        key={calendar.id}
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
                    ))
                  )}
                </Stack>
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Aussi dans l’agenda
                  </Text>
                  <Switch
                    label="Tâches"
                    checked={filters.tasks}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        tasks: event.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    label="Routines"
                    checked={showRoutines}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        routines: event.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    label={perso ? 'Plages' : 'Plages de travail'}
                    checked={filters.workHours !== false}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        workHours: event.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    label="Chronos"
                    checked={showTimers}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        timers: event.currentTarget.checked,
                      })
                    }
                  />
                </Stack>
              </SettingsSection>
              <SettingsSection title="Exporter">
                <Group gap="sm" wrap="wrap">
                  <Tooltip label="La vue affichée, pour l’imprimer">
                    <Button variant="default" leftSection={<FilePdfIcon aria-hidden />} loading={exporting} disabled={!range} onClick={() => void exportPdf()}>
                      Vue en PDF
                    </Button>
                  </Tooltip>
                  <Tooltip label="Les calendriers de l’espace, pour un autre agenda (Google, Apple, Outlook…)">
                    <Button component="a" href={calendarIcsUrl(null)} download variant="default" leftSection={<DownloadSimpleIcon aria-hidden />}>
                      Calendriers (.ics)
                    </Button>
                  </Tooltip>
                </Group>
              </SettingsSection>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="settings">
            <Stack gap="md">
              <CalendarsManager />
              <CalendarCategoriesManager />
              <ScheduleSettings />
              <PlacesManager />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </PageSettings>
      <Modal opened={managingSchedules} onClose={() => setManagingSchedules(false)} title={perso ? 'Plages' : 'Plages de travail'} size="min(72rem, 100%)">
        {managingSchedules && <WorkSchedulesManager />}
      </Modal>
      <Paper withBorder radius="md" p="xs" className={classes.calendar}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          // Lane of a line of planned slots, beside (or above) those of the other schedules that day.
          eventDidMount={(info) => {
            const lane: unknown = info.event.extendedProps.slotLane;
            if (typeof lane === 'number') info.el.style.setProperty('--slot-lane', String(lane));
          }}
          initialView={view}
          initialDate={requestedDate ?? undefined}
          locale={frLocale}
          headerToolbar={false}
          // The month grows with its days (every task shown); week and day take the height left to the page.
          height={fill ? '100%' : 'auto'}
          views={{
            timeGrid: {
              dayMaxEventRows: allDayExpanded ? false : ALL_DAY_ROWS,
            },
          }}
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
            const next = {
              from: dayOf(info.start),
              to: addDays(dayOf(info.end), -1),
            };
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
                  ? {
                      allDay: true,
                      startDate: start.date,
                      startTime: null,
                      endDate: addDays(end.date, -1),
                      endTime: null,
                    }
                  : {
                      allDay: false,
                      startDate: start.date,
                      startTime: start.time,
                      endDate: end.date,
                      endTime: end.time,
                    }),
              },
            });
            info.view.calendar.unselect();
          }}
          eventClick={(info: EventClickArg) => {
            info.jsEvent.preventDefault();
            // A bar of planned slots opens nothing.
            if (info.event.extendedProps.kind === 'slot') return;
            if (info.event.extendedProps.kind === 'editSlot') edits.openSlot(info.event.extendedProps.schedule, info.event.extendedProps.name, info.event.extendedProps.slot);
            else if (info.event.extendedProps.kind === 'task') navigate(taskLink.to(info.event.extendedProps.task.id));
            else if (info.event.extendedProps.kind === 'routine') edits.openRoutine(info.event.extendedProps.occurrence, info.event.extendedProps.movedFrom);
            else if (info.event.extendedProps.kind === 'time') openTimeEntry(info.event.extendedProps.entry);
            else if (info.event.extendedProps.kind === 'subscribed')
              setOpenedSubscribed({
                occurrence: info.event.extendedProps.occurrence,
                subscription: info.event.extendedProps.subscription,
              });
            else openEvent({ occurrence: info.event.extendedProps.occurrence });
          }}
          eventDrop={(info) => void handleChange(info)}
          eventResize={(info) => void handleChange(info)}
        />
      </Paper>
    </Stack>
  );
}
