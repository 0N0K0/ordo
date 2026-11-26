import { eventRings, routineRingOf, routineRings, taskRings, type PlannedRing, type RemindedOccurrence, type RemindedRoutine, type RemindedTask } from './reminder-rings';

/**
 * Reminders to come of the events, tasks and routines of a workspace (the column « Rappels à venir » of the page
 * « Alarmes »): for each item, the reminders of its next occurrence only that ring within the next days, the soonest
 * first; planned by the same bricks as the rings (same keys, instants and texts).
 */

/** Days ahead the reminders to come are looked for. */
export const UPCOMING_REMINDER_DAYS = 30;

/** Kinds of items whose reminders are listed to come. */
export type UpcomingReminderKind = 'event' | 'task' | 'routine';

/** Due day of the occurrence of a reminder to come (the start of an event), and its time when it has one. */
export interface UpcomingDue {
  day: string;
  time: string | null;
}

/** A reminder to come: its ring (key, instant, ringtone, title, lines), its item and the due day of its occurrence. */
export type UpcomingReminder<O, T, R> = PlannedRing & { due: UpcomingDue | null } & (
    | { kind: 'event'; item: O }
    | { kind: 'task'; item: T }
    | { kind: 'routine'; item: R; occurrenceDate: string }
  );

/** An event occurrence with its event (the series all its occurrences share reminders with). */
export type UpcomingOccurrence = RemindedOccurrence & { eventId: string };

/** A routine with whether it is a parent (it rings nothing, its sub-routines ring their own). */
export type UpcomingRoutine = RemindedRoutine & { hasSubRoutines?: boolean | null };

/** What the reminders to come are read from. */
export interface UpcomingSources<O extends UpcomingOccurrence, T extends RemindedTask, R extends UpcomingRoutine> {
  /** Event occurrences from yesterday to `UPCOMING_REMINDER_DAYS` + `REMINDER_LOOKAHEAD_DAYS` days ahead. */
  occurrences: readonly O[];
  tasks: readonly T[];
  routines: readonly R[];
  /** First free moment a reminder of a routine rings at, null: none soon (as the rings do). Optional. */
  deferRoutine?: (routine: R, at: Date) => Date | null;
}

/** Where a ring belongs: its item, its occurrence and the rank of that occurrence among those of the item. */
interface RingPlace {
  item: string;
  occurrence: string;
  rank: number;
}

/**
 * Rings of the next occurrence of each item only, between now and `days` days ahead: of the occurrences of an item that
 * have rings in that window, the first one (by rank); all of its rings in the window.
 * @template {PlannedRing} P
 * @param {readonly P[]} rings Rings.
 * @param {(ring: P) => RingPlace} placeOf Item, occurrence and rank of a ring.
 * @param {Date} now Now.
 * @param {number} days Days ahead.
 * @returns {P[]} Rings kept.
 */
export function nextOccurrenceRings<P extends PlannedRing>(rings: readonly P[], placeOf: (ring: P) => RingPlace, now: Date, days: number): P[] {
  const end = now.getTime() + days * 24 * 3600_000;
  const inWindow = rings.filter((ring) => ring.at.getTime() >= now.getTime() && ring.at.getTime() <= end);
  const next = new Map<string, RingPlace>();
  for (const ring of inWindow) {
    const place = placeOf(ring);
    const kept = next.get(place.item);
    if (!kept || place.rank < kept.rank) next.set(place.item, place);
  }
  return inWindow.filter((ring) => {
    const place = placeOf(ring);
    return next.get(place.item)?.occurrence === place.occurrence;
  });
}

/**
 * Reminders to come of the events, tasks and routines: for each item, those of its next occurrence (an event: its
 * series; a task: itself; a routine: the occurrences its reminders ring for, by due day) that ring from now to `days` days ahead,
 * the soonest first (then by title). Only the reminders of the item itself: a parent routine rings nothing; cancelled
 * occurrences, closed or archived tasks and archived routines have none (as for the rings).
 * @template {UpcomingOccurrence} O
 * @template {RemindedTask} T
 * @template {UpcomingRoutine} R
 * @param {UpcomingSources<O, T, R>} sources Occurrences, tasks and routines.
 * @param {Date} now Now.
 * @param {number} [days] Days ahead. Optional. Default = `UPCOMING_REMINDER_DAYS`.
 * @returns {UpcomingReminder<O, T, R>[]} Reminders to come.
 */
export function upcomingReminders<O extends UpcomingOccurrence, T extends RemindedTask, R extends UpcomingRoutine>(sources: UpcomingSources<O, T, R>, now: Date, days = UPCOMING_REMINDER_DAYS): UpcomingReminder<O, T, R>[] {
  const events: UpcomingReminder<O, T, R>[] = nextOccurrenceRings(
    eventRings(sources.occurrences),
    ({ occurrence }) => ({ item: occurrence.eventId, occurrence: occurrence.key, rank: new Date(occurrence.start).getTime() }),
    now,
    days,
  ).map(({ occurrence, ...ring }) => ({ ...ring, kind: 'event', item: occurrence, due: { day: occurrence.startDate, time: occurrence.allDay ? null : (occurrence.startTime ?? null) } }));

  const tasks: UpcomingReminder<O, T, R>[] = nextOccurrenceRings(taskRings(sources.tasks, now, days), ({ task }) => ({ item: task.id, occurrence: task.id, rank: 0 }), now, days).map(({ task, ...ring }) => ({
    ...ring,
    kind: 'task',
    item: task,
    due: task.effectiveDeadline ? { day: task.effectiveDeadline, time: null } : null,
  }));

  const routines: UpcomingReminder<O, T, R>[] = nextOccurrenceRings(
    routineRings(
      sources.routines.filter((routine) => !routine.hasSubRoutines),
      sources.deferRoutine,
    ),
    ({ routine, key }) => {
      const date = routineRingOf(key)?.date ?? '';
      // By its due day (an occurrence moved and kept apart is told by the day of its rule).
      const due = routine.reminderOccurrences.find((item) => item.date === date)?.dueDate ?? date;
      return { item: routine.id, occurrence: date, rank: Date.parse(due) || 0 };
    },
    now,
    days,
  ).map(({ routine, key, at, ringtone, title, lines }) => {
    const date = routineRingOf(key)?.date ?? '';
    const occurrence = routine.reminderOccurrences.find((item) => item.date === date);
    return { key, at, ...(ringtone && { ringtone }), title, lines, kind: 'routine', item: routine, occurrenceDate: date, due: { day: occurrence?.dueDate ?? date, time: null } };
  });

  return [...events, ...tasks, ...routines].sort((a, b) => a.at.getTime() - b.at.getTime() || a.title.localeCompare(b.title) || a.key.localeCompare(b.key));
}
