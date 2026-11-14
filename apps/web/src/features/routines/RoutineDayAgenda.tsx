import { closePanel, openPanel } from '../../components/panels/panels';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Button, Group, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { addDays, plannedSlots, shiftTime } from '@ordo/shared';
import { useMemo, useState } from 'react';
import { localDay } from '../../lib/dates';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { scheduleRules, useCalendarEvents, useCalendars, useDefaultScheduleKind, useScheduleTypes, useSubscribedCalendarEvents, useSubscribedSchedules, useWorkSchedules } from '../calendar/api';
import { useNow } from '../time/use-now';
import calendarClasses from '../calendar/CalendarPage.module.css';
import { useRoutineMutations, type Routine, type RoutineCheck } from './api';
import { windowText } from './routine-format';
import * as fmt from '../../lib/format';

/** One time of the day of the history: planned (done or not), or ticked without being planned that day. */
export interface HistoryItem {
  key: string;
  routineId: string;
  date: string;
  slot: number;
  fromTime: string | null;
  dueTime: string | null;
  /** Planned that day (false: ticked anyway). */
  planned: boolean;
  optional: boolean;
  /** Day the occurrence was moved from, if any. */
  movedFrom: string | null;
  check: RoutineCheck | undefined;
}

/** State of a time of the day: done, still to do (today), skipped (optional) or missed. */
type ItemState = 'done' | 'todo' | 'skipped' | 'missed';

/** Color and text of each state. */
const STATES: Record<ItemState, { color: string; text: string }> = {
  done: { color: 'green', text: 'faite' },
  todo: { color: 'orange', text: 'à faire' },
  skipped: { color: 'gray', text: 'facultatif, non fait' },
  missed: { color: 'red', text: 'non faite' },
};

/**
 * State of a time of the day.
 * @param {HistoryItem} item Time of the day.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {ItemState} State.
 */
const stateOf = (item: HistoryItem, today: string): ItemState => (item.check ? 'done' : item.date >= today ? 'todo' : item.optional ? 'skipped' : 'missed');

/**
 * Local time of an instant (HH:MM).
 * @param {Date} date Instant.
 * @returns {string} Time.
 */
const clock = (date: Date) => fmt.time(date);

/**
 * Hour proposed to tick a time of the day after the fact: when it was done if it was, else when it was due (its latest
 * time, else its start), else now today and noon another day.
 * @param {HistoryItem} item Time of the day.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {string} HH:MM.
 */
const proposedTime = (item: HistoryItem, today: string) => (item.check ? clock(new Date(item.check.doneAt)) : (item.dueTime ?? item.fromTime ?? (item.date === today ? clock(new Date()) : '12:00')));

interface TickFormProps {
  item: HistoryItem;
  routine: Routine | undefined;
  today: string;
  onDone: () => void;
}

/**
 * Ticks a time of the day after the fact at a chosen hour (by default when it was due), changes the hour it was done
 * at, or unticks it (with an undo).
 * @param {TickFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function TickForm({ item, routine, today, onDone }: TickFormProps) {
  const { setDone } = useRoutineMutations();
  const [time, setTime] = useState(() => proposedTime(item, today));
  const state = stateOf(item, today);
  const at = new Date(`${item.date}T${time || '00:00'}:00`);
  // Now when the form opened: a later hour is refused.
  const now = useNow(false);
  const future = at.getTime() > now;
  const window = windowText(item);
  const onError = { onError: (error: Error) => notifyError(error.message) };
  /**
   * Ticks it (done at the chosen hour) or unticks it, with an undo.
   * @param {boolean} done Target state.
   * @returns {void}
   */
  const save = (done: boolean) => {
    const previous = item.check ? new Date(item.check.doneAt).toISOString() : null;
    setDone.mutate(
      { id: item.routineId, done, date: item.date, slot: item.slot, doneAt: done ? at.toISOString() : null },
      {
        ...onError,
        onSuccess: () => {
          onDone();
          notifyWithUndo(done ? 'Routine cochée.' : 'Routine décochée.', () =>
            setDone.mutate({ id: item.routineId, done: previous !== null, date: item.date, slot: item.slot, doneAt: previous }, onError),
          );
        },
      },
    );
  };
  return (
    <Stack gap="md">
      <Text size="sm">
        {fmt.dayLong(item.date)}
        {window ? ` · ${window}` : ''} ·{' '}
        <Text span c={`${STATES[state].color}.7`}>
          {state === 'done' ? `faite à ${clock(new Date(item.check!.doneAt))}` : STATES[state].text}
        </Text>
      </Text>
      <TimeInput
        label={item.check ? 'Faite à' : 'Faite à (heure prévue par défaut)'}
        value={time}
        onChange={(event) => setTime(event.currentTarget.value)}
        error={future ? 'Cette heure n’est pas encore passée.' : undefined}
        data-autofocus
      />
      <Group justify="flex-end" gap="sm">
        {item.check && routine && (
          <Button variant="default" color="red" onClick={() => save(false)} loading={setDone.isPending}>
            Décocher
          </Button>
        )}
        <Button onClick={() => save(true)} disabled={!routine || !time || future} loading={setDone.isPending}>
          {item.check ? 'Changer l’heure' : 'Cocher comme faite'}
        </Button>
      </Group>
    </Stack>
  );
}

/** Schedules and calendars shown with the routines. */
export interface AgendaLayers {
  scheduleIds: string[];
  calendarIds: string[];
}

interface RoutineDayAgendaProps {
  day: string;
  today: string;
  items: HistoryItem[];
  byId: Map<string, Routine>;
  layers: AgendaLayers;
}

/**
 * A day of the history as an agenda: the times of the day of the routines at their hours (or at the hour they were
 * done, without hours), in the color of their state, with the hour they were done; the slots of the chosen schedules
 * in the background and the events of the chosen calendars. A routine clicked is ticked (at the hour it was due by
 * default), its hour changed, or unticked.
 * @param {RoutineDayAgendaProps} props Component props.
 * @returns {JSX.Element} Agenda.
 */
export function RoutineDayAgenda({ day, today, items, byId, layers }: RoutineDayAgendaProps) {
  const range = useMemo(() => ({ from: day, to: day }), [day]);
  const { data: calendars } = useCalendars();
  const { data: schedules } = useWorkSchedules();
  const { data: foreign } = useSubscribedSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const shownCalendars = new Set(layers.calendarIds);
  const subscriptions = (calendars?.calendarSubscriptions ?? []).filter((subscription) => shownCalendars.has(subscription.calendarId));
  const ownEvents = useCalendarEvents(layers.calendarIds.length ? range : null);
  const subscribedEvents = useSubscribedCalendarEvents(subscriptions.length ? range : null);

  const events: EventInput[] = [];
  // Slots of the chosen schedules: their hours in the background, their name in the all-day row.
  const shownSchedules = new Set(layers.scheduleIds);
  const typeOf = new Map((types ?? []).map((type) => [type.id, type]));
  const slotSources = [
    ...(schedules ?? []).map((schedule) => {
      const kind = (schedule.typeId ? typeOf.get(schedule.typeId) : undefined) ?? defaultKind;
      return { schedule, color: kind?.color ?? null, name: kind?.name ?? schedule.name };
    }),
    ...(foreign ?? []).map((schedule) => ({ schedule, color: schedule.color ?? null, name: `${schedule.typeName ?? schedule.name} · ${schedule.workspaceName}` })),
  ].filter(({ schedule }) => shownSchedules.has(schedule.id));
  for (const { schedule, color, name } of slotSources) {
    const slots = plannedSlots(scheduleRules([schedule]), day, day);
    if (slots.length === 0) continue;
    events.push({
      id: `slot-bar:${schedule.id}`,
      title: name,
      allDay: true,
      start: day,
      end: addDays(day, 1),
      backgroundColor: color ?? 'var(--mantine-color-green-light)',
      borderColor: color ?? 'var(--mantine-color-green-light)',
      textColor: 'var(--mantine-color-text)',
      classNames: [calendarClasses.slotBar],
    });
    for (const slot of slots) {
      events.push({
        id: `slot:${schedule.id}:${slot.start}`,
        start: slot.allDay ? `${day}T00:00:00` : `${day}T${slot.start}:00`,
        end: slot.allDay ? `${addDays(day, 1)}T00:00:00` : `${day}T${slot.end}:00`,
        display: 'background',
        ...(color ? { backgroundColor: color } : {}),
        classNames: [color ? calendarClasses.typedSlot : calendarClasses.workHours],
      });
    }
  }
  // Events of the chosen calendars, read only.
  const calendarColor = new Map((calendars?.calendars ?? []).map((calendar) => [calendar.id, calendar.color]));
  const subscriptionColor = new Map(subscriptions.map((subscription) => [subscription.calendarId, subscription.color]));
  for (const occurrence of [...(ownEvents.data ?? []), ...(subscribedEvents.data ?? [])]) {
    if (!shownCalendars.has(occurrence.calendarId)) continue;
    const color = calendarColor.get(occurrence.calendarId) ?? subscriptionColor.get(occurrence.calendarId) ?? 'var(--mantine-primary-color-filled)';
    events.push({
      id: `event:${occurrence.key}`,
      title: occurrence.title,
      allDay: occurrence.allDay,
      start: occurrence.allDay ? occurrence.startDate : String(occurrence.start),
      end: occurrence.allDay ? addDays(occurrence.endDate, 1) : String(occurrence.end),
      backgroundColor: color,
      borderColor: color,
      editable: false,
      classNames: occurrence.calledOff ? [calendarClasses.closed] : [],
    });
  }
  // Routines: between their times, or for the time to spend on them from (up to) their one time; without times, at the
  // hour they were done, else in the all-day row.
  for (const item of items) {
    const routine = byId.get(item.routineId);
    const state = stateOf(item, today);
    const { color, text } = STATES[state];
    const minutes = routine?.estimate ?? 30;
    const doneAt = item.check ? new Date(item.check.doneAt) : null;
    const before = item.dueTime ? shiftTime(item.dueTime, -minutes) : null;
    const after = item.fromTime ? shiftTime(item.fromTime, minutes) : null;
    let start = item.fromTime ?? (before && item.dueTime && before < item.dueTime ? before : null);
    let end = item.dueTime ?? (after && item.fromTime && after > item.fromTime ? after : null);
    if ((!start || !end) && doneAt && localDay(doneAt) === day) {
      start = clock(doneAt);
      const stop = shiftTime(start, minutes);
      end = stop > start ? stop : '23:59';
    }
    const timed = start !== null && end !== null && start < end;
    const status = doneAt ? `faite à ${localDay(doneAt) === item.date ? clock(doneAt) : `${clock(doneAt)} le ${fmt.dayShort(doneAt)}`}` : text;
    events.push({
      id: `routine:${item.key}`,
      title: `${routine?.title ?? 'Routine supprimée'}${item.optional ? ' (facultatif)' : ''} · ${status}${item.planned ? '' : ' (non prévue ce jour)'}`,
      allDay: !timed,
      start: timed ? `${day}T${start}:00` : day,
      end: timed ? `${day}T${end}:00` : addDays(day, 1),
      backgroundColor: `var(--mantine-color-${color}-light)`,
      borderColor: `var(--mantine-color-${color}-6)`,
      textColor: 'var(--mantine-color-text)',
      editable: false,
      classNames: [calendarClasses.task, ...(item.movedFrom ? [calendarClasses.moved] : [])],
      extendedProps: { item },
    });
  }

  /**
   * Opens the form ticking (or unticking) the routine clicked.
   * @param {EventClickArg} info Click.
   * @returns {void}
   */
  const handleClick = ({ event }: EventClickArg) => {
    const item: HistoryItem | undefined = event.extendedProps.item;
    if (!item) return;
    const routine = byId.get(item.routineId);
    const modalId = `routine-tick-${item.key}`;
    openPanel({
      panelId: modalId,
      title: routine?.title ?? 'Routine supprimée',
      children: <TickForm item={item} routine={routine} today={today} onDone={() => closePanel(modalId)} />,
    });
  };

  return (
    <FullCalendar
      // A new day: a new agenda on that day.
      key={day}
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridDay"
      initialDate={day}
      locale={frLocale}
      headerToolbar={false}
      dayHeaders={false}
      height="auto"
      nowIndicator
      scrollTime="07:00:00"
      events={events}
      eventClick={handleClick}
      editable={false}
      selectable={false}
    />
  );
}
