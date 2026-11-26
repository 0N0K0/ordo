import { archivedIds } from '../../../lib/archive';
import { openFormPanel } from '../../../components/panels/panels';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Stack, Text } from '@mantine/core';
import { addDays, plannedSlots, routineMinutes, routineSlotSpan, routineTickPrefill, shiftTime } from '@ordo/shared';
import { useMemo, useState } from 'react';
import { parisDay } from '../../../lib/dates';
import { useCalendarEvents, useCalendars, useScheduleSources, useSubscribedCalendarEvents } from '../../calendar/api';
import { occurrenceSpan, scheduleSources, slotBarLook, slotLookClasses } from '../../calendar/lib/calendar-events';
import calendarClasses from '../../calendar/pages/CalendarPage.module.css';
import type { Routine } from '../api';
import { useRoutineTick } from '../hooks/use-routine-tick';
import { DoneAtForm } from './RoutineTick';
import { doneAtParts, doneAtText, windowText } from '../lib/routine-format';
import { parisCalendarOptions } from '../../calendar/lib/paris-calendar';
import * as fmt from '../../../lib/format';
import { ActionButton } from '../../../components/actions/ActionButton';
import { taggedKey } from '../../../lib/tagged-key';
import { CountdownLaunchButtons } from '../../countdowns/components/CountdownLaunchButtons';
import { routineCountdownItem } from '../lib/routine-countdowns';
import { OccurrenceOpening } from './OccurrenceOpening';

/** One time of the day of the history: planned (done or not), or ticked without being planned that day. */
export interface HistoryItem {
  key: string;
  routineId: string;
  /** Day that identifies its occurrence (its ticks): its due day, or the day of its rule when moved and kept apart. */
  date: string;
  /** Due day of its occurrence. */
  dueDate: string;
  /** First day of its occurrence (its « Ouverture »), as the API computes it. */
  startDate: string;
  slot: number;
  fromTime: string | null;
  dueTime: string | null;
  /** Open that day, from its first day to its due day (false: done that day, out of those days). */
  planned: boolean;
  optional: boolean;
  /** Day the occurrence was moved from, if any. */
  movedFrom: string | null;
  /** When it was done (ISO); null: not done yet. */
  doneAt: string | null;
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
const historyItemState = (item: HistoryItem, today: string): ItemState => (item.doneAt ? 'done' : item.dueDate >= today ? 'todo' : item.optional ? 'skipped' : 'missed');

interface TickFormProps {
  item: HistoryItem;
  routine: Routine | undefined;
  /** Day of the history it was opened from. */
  day: string;
  today: string;
  onDone: () => void;
}

/**
 * Ticks a time of the day after the fact at a chosen time (by default its scheduled time on the day of the history it
 * was opened from once past, else now), changes the time it was done at, or unticks it (with an undo); « Lancer » the
 * dead times of the routine for this occurrence.
 * @param {TickFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function TickForm({ item, routine, day, today, onDone }: TickFormProps) {
  const writes = useRoutineTick();
  const state = historyItemState(item, today);
  const window = windowText(item);
  const tick = { id: item.routineId, date: item.date, slot: item.slot };
  const [initial] = useState(() => (item.doneAt ? doneAtParts(item.doneAt) : routineTickPrefill(item, new Date(), day)));
  return (
    <Stack gap="md">
      <OccurrenceOpening routine={routine} occurrence={item}>
        <Text size="sm">
          {fmt.dayLong(item.dueDate)}
          {window ? ` · ${window}` : ''} ·{' '}
          <Text span c={`${STATES[state].color}.7`}>
            {item.doneAt ? doneAtText(item.doneAt) : STATES[state].text}
          </Text>
        </Text>
      </OccurrenceOpening>
      <DoneAtForm
        initial={initial}
        submitLabel={item.doneAt ? 'Changer l’heure' : 'Cocher comme faite'}
        change={item.doneAt !== null}
        description={item.doneAt ? undefined : 'L’heure prévue si elle est passée, sinon maintenant.'}
        disabled={!routine}
        loading={writes.pending}
        onSubmit={(at) => writes.tick(tick, at, item.doneAt, onDone)}
      >
        {item.doneAt && routine && (
          <ActionButton priority="secondary" icon={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => writes.untick(tick, item.doneAt, onDone)} loading={writes.pending}>
            Décocher
          </ActionButton>
        )}
      </DoneAtForm>
      {/* Its dead times, launched for this occurrence. */}
      {routine && !routine.archived && <CountdownLaunchButtons deadTimes={routine.deadTimes} savedCountdownIds={routine.savedCountdownIds} item={routineCountdownItem(routine, item.date)} />}
    </Stack>
  );
}

/** End of a time of the day at the midnight after the day (after every HH:MM). */
const MIDNIGHT = '24:00';

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
  const { schedules, foreign, types, defaultKind } = useScheduleSources();
  // Archived calendars (and archived events) are hidden, even when a saved layer still names them.
  const archivedCalendars = archivedIds(calendars?.calendars);
  const calendarIds = layers.calendarIds.filter((id) => !archivedCalendars.has(id));
  const shownCalendars = new Set(calendarIds);
  const subscriptions = (calendars?.calendarSubscriptions ?? []).filter((subscription) => shownCalendars.has(subscription.calendarId));
  const ownEvents = useCalendarEvents(calendarIds.length ? range : null);
  const subscribedEvents = useSubscribedCalendarEvents(subscriptions.length ? range : null);

  const events: EventInput[] = [];
  // Slots of the chosen schedules: their hours in the background, their name in the all-day row.
  const shownSchedules = new Set(layers.scheduleIds);
  const slotSources = scheduleSources(schedules ?? [], foreign ?? [], types ?? [], defaultKind, true).filter(({ schedule }) => shownSchedules.has(schedule.id));
  for (const { schedule, rule, color, label, foreign, ephemeris } of slotSources) {
    const slots = plannedSlots([rule], day, day);
    if (slots.length === 0) continue;
    events.push({
      id: taggedKey('slot-bar', schedule.id),
      title: label,
      allDay: true,
      start: day,
      end: addDays(day, 1),
      ...slotBarLook({ color, foreign, ephemeris }),
    });
    for (const slot of slots) {
      events.push({
        id: `slot:${schedule.id}:${slot.start}`,
        start: slot.allDay ? `${day}T00:00:00` : `${day}T${slot.start}:00`,
        end: slot.allDay ? `${addDays(day, 1)}T00:00:00` : `${day}T${slot.end}:00`,
        display: 'background',
        ...(color ? { backgroundColor: color } : {}),
        classNames: [color ? calendarClasses.typedSlot : calendarClasses.workHours, ...slotLookClasses({ foreign, ephemeris })],
      });
    }
  }
  // Events of the chosen calendars, read only.
  const calendarColor = new Map((calendars?.calendars ?? []).map((calendar) => [calendar.id, calendar.color]));
  const subscriptionColor = new Map(subscriptions.map((subscription) => [subscription.calendarId, subscription.color]));
  for (const occurrence of [...(ownEvents.data ?? []), ...(subscribedEvents.data ?? [])]) {
    // Archived events and calendars are already left out (by the queries and calendarIds).
    if (!shownCalendars.has(occurrence.calendarId)) continue;
    const color = calendarColor.get(occurrence.calendarId) ?? subscriptionColor.get(occurrence.calendarId) ?? 'var(--mantine-primary-color-filled)';
    events.push({
      id: taggedKey('event', occurrence.key),
      title: occurrence.label,
      ...occurrenceSpan(occurrence),
      backgroundColor: color,
      borderColor: color,
      editable: false,
      classNames: occurrence.calledOff ? [calendarClasses.closed] : [],
    });
  }
  // Routines: from their start to their end (`routineSlotSpan`, as their reminders count: the time to spend on them
  // from « dès » or up to « jusqu'à », 30 min without it); without hours, at the hour they were done,
  // else in the all-day row.
  for (const item of items) {
    const routine = byId.get(item.routineId);
    const state = historyItemState(item, today);
    const { color, text } = STATES[state];
    const minutes = routineMinutes(routine?.estimate);
    const doneAt = item.doneAt ? new Date(item.doneAt) : null;
    const span = routineSlotSpan(item, minutes);
    let start = span?.start ?? null;
    let end = span ? (span.end ?? MIDNIGHT) : null;
    if (!span && doneAt && parisDay(doneAt) === day) {
      start = fmt.time(doneAt);
      const stop = shiftTime(start, minutes);
      end = stop > start ? stop : MIDNIGHT;
    }
    const timed = start !== null && end !== null && start < end;
    // Done: shown on the day it was done, at that time.
    const status = doneAt ? `faite à ${fmt.time(doneAt)}` : text;
    events.push({
      id: taggedKey('routine', item.key),
      title: `${routine?.label ?? 'Routine supprimée'}${item.optional ? ' (facultatif)' : ''} · ${status}${item.planned ? '' : ' (non prévue ce jour)'}${routine?.archived ? ' (archivée)' : ''}`,
      allDay: !timed,
      start: timed ? `${day}T${start}:00` : day,
      end: timed ? (end === MIDNIGHT ? `${addDays(day, 1)}T00:00:00` : `${day}T${end}:00`) : addDays(day, 1),
      backgroundColor: `var(--mantine-color-${color}-light)`,
      borderColor: `var(--mantine-color-${color}-6)`,
      textColor: 'var(--mantine-color-text)',
      editable: false,
      // Of an archived routine: its past occurrences, read only.
      classNames: [calendarClasses.task, ...(item.movedFrom ? [calendarClasses.moved] : []), ...(routine?.archived ? [calendarClasses.archived] : [])],
      extendedProps: { item },
    });
  }

  /**
   * Opens the form ticking (or unticking) the routine clicked; an archived one is read only (nothing opens).
   * @param {EventClickArg} info Click.
   * @returns {void}
   */
  const handleClick = ({ event }: EventClickArg) => {
    const item: HistoryItem | undefined = event.extendedProps.item;
    if (!item) return;
    const routine = byId.get(item.routineId);
    if (routine?.archived) return;
    openFormPanel(routine?.label ?? 'Routine supprimée', (close) => <TickForm item={item} routine={routine} day={day} today={today} onDone={close} />, { panelId: `routine-tick-${item.key}` });
  };

  return (
    <FullCalendar
      // A new day: a new agenda on that day.
      key={day}
      // Its hours and « now » are those of Paris, as the agenda.
      {...parisCalendarOptions([timeGridPlugin, interactionPlugin])}
      initialView="timeGridDay"
      initialDate={day}
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
