import { ageOn, birthdayLabel, birthdaysBetween, readBirthDate } from '../people/birthdays';
import { scheduleRuns, type WorkScheduleRule } from '../calendar/work-schedules';
import { occurrenceKey, readOccurrenceKey } from '../calendar/calendar';
import { APP_PATHS, projectPath, taskPath } from '../core/app-paths';
import { parseTaggedKey, taggedKey } from '../core/tagged-key';
import { subtreeOf, type TreeItem } from '../core/tree';
import { routineSlotSpan, windowText } from '../routines/routines';
import { taskNumbered } from '../tasks/tasks';
import { entrySeconds, previousOccurrence, type AlarmType } from '../tasks/time';
import { addDays } from './days';
import { dayText, weekdayText } from './format';
import {
  occurrenceReminders,
  parisInstant,
  reminderDayRange,
  remindersAt,
  remindersBefore,
  ROUTINE_REMINDER_ANCHORS,
  taskReminders,
  type PlannedReminder,
  type ReminderAnchor,
  type ReminderValue,
} from './reminders';
import { RING_LATE_MS } from './ringing';

/**
 * What rings, and what its ring shows, computed the same way by the open app (`ringPlannedReminders`, `dueAlarms`) and
 * by the server ringing outside the app (push notifications): the reminders of the events, tasks,
 * routines, éphémérides and birthdays with their keys (one ring per key: the app and the server never ring one twice),
 * their instants, their titles and lines; the alarms due and the steps of the timers; the links of the rings.
 */

/** What a ring shows: its title and the lines under it. */
export interface RingText {
  title: string;
  lines: string[];
}

/** A reminder to ring at its instant, with what its ring shows. */
export interface PlannedRing extends PlannedReminder, RingText {}

/** A link of a ring to a page of the app. */
export interface RingPage {
  label: string;
  path: string;
}

/**
 * Lines kept (the empty ones left out).
 * @param {(string | null | undefined | false)[]} lines Lines.
 * @returns {string[]} Lines.
 */
const shownLines = (lines: (string | null | undefined | false)[]): string[] => lines.filter((line): line is string => Boolean(line));

/**
 * Link of a ring to the calendar (« Voir l'agenda », of another workspace: « Voir l'agenda de « X » »).
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {RingPage} Link.
 */
export const calendarRingPage = (workspaceLabel?: string): RingPage => ({ label: workspaceLabel ? `Voir l’agenda de « ${workspaceLabel} »` : 'Voir l’agenda', path: APP_PATHS.calendar });

/**
 * Link of a ring to the routines (« Voir les routines », of another workspace: « Voir les routines de « X » »).
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {RingPage} Link.
 */
export const routinesRingPage = (workspaceLabel?: string): RingPage => ({ label: workspaceLabel ? `Voir les routines de « ${workspaceLabel} »` : 'Voir les routines', path: APP_PATHS.routines });

/**
 * Link of a ring to the home of another workspace (« Ouvrir « X » »), when it has no page of its own.
 * @param {string} workspaceLabel Workspace.
 * @returns {RingPage} Link.
 */
export const workspaceRingPage = (workspaceLabel: string): RingPage => ({ label: `Ouvrir « ${workspaceLabel} »`, path: APP_PATHS.home });

// Events ---------------------------------------------------------------------------------------------------------

/** An event occurrence as its reminders ring (of the open workspace or of another one). */
export interface RemindedOccurrence {
  key: string;
  label: string;
  location?: string | null;
  allDay: boolean;
  startDate: string;
  /** HH:MM (Paris), when not all day. */
  startTime?: string | null;
  endDate: string;
  start: Date | string;
  end: Date | string;
  calledOff: boolean;
  reminders: readonly ReminderValue[];
}

/**
 * Reminders of event occurrences: minutes before their start or their end, or at a time of the day of their first or
 * last day or of some days before it; a cancelled occurrence has none. The ring tells its day and time (« ven. 13
 * nov., 14:05 », « Journée entière ») and its place.
 * @template {RemindedOccurrence} O
 * @param {readonly O[]} occurrences Occurrences of the next days.
 * @returns {(PlannedRing & { occurrence: O })[]} Reminders.
 */
export function eventRings<O extends RemindedOccurrence>(occurrences: readonly O[]): (PlannedRing & { occurrence: O })[] {
  return occurrences.flatMap((occurrence) => {
    if (occurrence.calledOff) return [];
    // An all-day occurrence starts at Paris midnight of its first day, ends at Paris midnight after its last one.
    const start = occurrence.allDay ? parisInstant(occurrence.startDate) : new Date(occurrence.start);
    const end = { day: occurrence.endDate, at: occurrence.allDay ? parisInstant(addDays(occurrence.endDate, 1)) : new Date(occurrence.end) };
    const body = [occurrence.allDay ? 'Journée entière' : `${weekdayText(occurrence.startDate)}, ${occurrence.startTime ?? ''}`, occurrence.location].filter(Boolean).join(' · ');
    return occurrenceReminders(taggedKey('event', occurrence.key), occurrence.startDate, start, occurrence.reminders, end).map((reminder) => ({ ...reminder, title: occurrence.label, lines: [body], occurrence }));
  });
}

// Tasks ----------------------------------------------------------------------------------------------------------

/** What the reminders of a task are rung from (a task of the open workspace or of another one). */
export interface RemindedTask {
  id: string;
  label: string;
  closed: boolean;
  archived: boolean;
  effectiveMinDate?: string | null;
  effectiveDeadline?: string | null;
  reminders: readonly ReminderValue[];
}

/**
 * Reminders of the open tasks (not closed nor archived): at their times of the day, every day from their « Ouverture »
 * to their « Échéance » (the « Échéance » day only without « Ouverture »; none without it), or once some days before
 * their « Échéance », those they go by. The ring tells the « Échéance ».
 * @template {RemindedTask} T
 * @param {readonly T[]} tasks Tasks.
 * @param {Date} now Now.
 * @param {number} [ahead] Days after today whose « À HH:MM » are given too (`taskReminders`). Optional. Default = 0.
 * @returns {(PlannedRing & { task: T })[]} Reminders.
 */
export function taskRings<T extends RemindedTask>(tasks: readonly T[], now: Date, ahead = 0): (PlannedRing & { task: T })[] {
  return tasks.flatMap((task) => {
    if (task.closed || task.archived || !task.reminders.length) return [];
    const days = { minDate: task.effectiveMinDate, deadline: task.effectiveDeadline, reminders: task.reminders };
    const lines = shownLines([task.effectiveDeadline && `Échéance : ${dayText(task.effectiveDeadline)}`]);
    return taskReminders(taggedKey('task', task.id), days, now, ahead).map((reminder) => ({ ...reminder, title: task.label, lines, task }));
  });
}

// Routines -------------------------------------------------------------------------------------------------------

/** A time of the day of an occurrence its reminders ring for: its index and its hours (« dès », « jusqu'à »). */
export interface RemindedRoutineSlot {
  slot: number;
  fromTime: string | null;
  dueTime: string | null;
}

/** An occurrence of a routine its reminders ring for (`reminderOccurrences` of the API). */
export interface RemindedRoutineOccurrence {
  /** Day that identifies the occurrence: its due day (« Échéance »), or the day of its rule when moved and kept apart. */
  date: string;
  /** Due day, when it is not `date` (moved and kept apart). Optional. Default = `date`. */
  dueDate?: string | null;
  /** Opening day (« Ouverture »). */
  day: string;
  /** Its times of the day not ticked. */
  slots: readonly RemindedRoutineSlot[];
}

/** What the reminders of a routine are rung from (a routine of the open workspace or of another one). */
export interface RemindedRoutine {
  id: string;
  label: string;
  archived: boolean;
  location?: string | null;
  /** Time to spend on it, in minutes: the end of a time without « jusqu'à », the start of one without « dès ». */
  estimate: number | null;
  /** Due day of its current occurrence. */
  currentDate?: string | null;
  reminders: readonly ReminderValue[];
  /** Occurrences its reminders ring for (`reminderOccurrences` of the API). */
  reminderOccurrences: readonly RemindedRoutineOccurrence[];
  /** Times of the day of its current occurrence (the line of the ring). */
  slots: readonly { index: number; fromTime: string | null; dueTime: string | null; windows?: unknown }[];
}

/** A reminder of a routine: its time of the day, and whether it is of its current occurrence (it can be ticked). */
export type RoutineRing<R> = PlannedRing & { routine: R; slot: number; current: boolean };

/**
 * Instants the reminders « avant » of a time of the day of an occurrence count from: its start and
 * its end (`routineSlotSpan`, as the agenda shows it: « dès » / « jusqu'à », the other one from the time to spend on
 * it), on the opening day (`start`, `openEnd`) and on the due day (`dueStart`, `end`), Paris time. A time without any
 * hour has none (no reminder « avant »).
 * @param {RemindedRoutineOccurrence} occurrence Occurrence.
 * @param {RemindedRoutineSlot} slot Time of the day.
 * @param {number | null} minutes Time to spend on the routine (`estimate`).
 * @returns {Record<ReminderAnchor, Date> | null} Instant of each anchor, null without any hour.
 */
export function routineSlotAnchors(occurrence: Pick<RemindedRoutineOccurrence, 'date' | 'day' | 'dueDate'>, slot: Omit<RemindedRoutineSlot, 'slot'>, minutes: number | null): Record<ReminderAnchor, Date> | null {
  const span = routineSlotSpan(slot, minutes);
  if (!span) return null;
  /**
   * End of the time of the day on a day: its end, else the Paris midnight after the day.
   * @param {string} day Day.
   * @returns {Date} Instant.
   */
  const end = (day: string) => (span.end ? parisInstant(day, span.end) : parisInstant(addDays(day, 1)));
  const due = occurrence.dueDate ?? occurrence.date;
  return { start: parisInstant(occurrence.day, span.start), openEnd: end(occurrence.day), dueStart: parisInstant(due, span.start), end: end(due) };
}

/**
 * Key of the reminders of an occurrence of a routine, before its time of the day and its reminder (`routine:<id>|<due
 * day>`).
 * @param {string} routineId Routine.
 * @param {string} date Due day of the occurrence.
 * @returns {string} Key prefix.
 */
export const routineRingPrefix = (routineId: string, date: string): string => taggedKey('routine', occurrenceKey(routineId, date));

/**
 * Routine, occurrence and time of the day of the key of a ring of a reminder of a routine (`routineRings`), to give a
 * ring shown again after a reload its actions back; null for another key.
 * @param {string} key Key of the ring.
 * @returns {{ routineId: string, date: string, slot: number | null } | null} Routine, due day and time of the day (null: a reminder « À HH:MM »).
 */
export function routineRingOf(key: string): { routineId: string; date: string; slot: number | null } | null {
  const tagged = parseTaggedKey(key);
  if (tagged?.tag !== 'routine') return null;
  const [occurrence, slot] = tagged.id.split(':');
  const { id, date } = readOccurrenceKey(occurrence);
  return date ? { routineId: id, date, slot: /^\d+$/.test(slot ?? '') ? Number(slot) : null } : null;
}

/**
 * Reminders of the routines, for the occurrences the API gives: each « N min avant » before each
 * time of the day not ticked that has an hour, from one of its four anchors (`routineSlotAnchors`: the start or the end
 * of the time on the opening day or on the due day), each « À HH:MM » and « N jours avant » once per occurrence, from its opening day
 * (from the end: its due day). An archived routine has none. When its assignees are kept busy, a reminder waits for the
 * next free moment (`defer`, the same for the app and the server: `nextAllowedMoment`). The ring tells the window of
 * its time of the day and the place.
 * @template {RemindedRoutine} R
 * @param {readonly R[]} routines Routines.
 * @param {(routine: R, at: Date) => Date | null} [defer] First free moment from a reminder on, null: none soon. Optional. Default = none.
 * @returns {RoutineRing<R>[]} Reminders.
 */
export function routineRings<R extends RemindedRoutine>(routines: readonly R[], defer?: (routine: R, at: Date) => Date | null): RoutineRing<R>[] {
  return routines.flatMap((routine) => {
    if (routine.archived || routine.reminders.length === 0) return [];
    return routine.reminderOccurrences.flatMap((occurrence) => {
      const key = routineRingPrefix(routine.id, occurrence.date);
      const first = occurrence.slots[0]?.slot ?? 0;
      const planned = [
        ...occurrence.slots.flatMap((slot) => {
          const anchors = routineSlotAnchors(occurrence, slot, routine.estimate);
          if (!anchors) return [];
          return ROUTINE_REMINDER_ANCHORS.flatMap((anchor) => remindersBefore(`${key}:${slot.slot}`, anchors[anchor], routine.reminders, anchor)).map((reminder) => ({ ...reminder, slot: slot.slot }));
        }),
        ...[...remindersAt(key, occurrence.day, routine.reminders), ...remindersAt(key, occurrence.dueDate ?? occurrence.date, routine.reminders, true, 'end')].map((reminder) => ({ ...reminder, slot: first })),
      ];
      const current = routine.currentDate === occurrence.date;
      return planned.flatMap((reminder) => {
        const at = defer ? defer(routine, reminder.at) : reminder.at;
        if (!at) return [];
        const slot = routine.slots.find((item) => item.index === reminder.slot);
        const lines = [[slot && windowText(slot), routine.location].filter(Boolean).join(' · ')];
        return [{ ...reminder, at, title: routine.label, lines, routine, current }];
      });
    });
  });
}

// Éphémérides and birthdays --------------------------------------------------------------------------------------

/** What the reminders of an éphéméride are rung from (of the open workspace or of another one). */
export interface RemindedSchedule {
  id: string;
  label: string;
  archived: boolean;
  ephemeris: boolean;
  reminders: readonly ReminderValue[];
}

/**
 * Reminders of the éphémérides: for each run of consecutive days it covers (its first day from
 * yesterday to the most days a reminder rings before), « N min avant » its start (Paris midnight all day), « À HH:MM »
 * that day, « N jours avant, à HH:MM ». A créneau or an archived éphéméride has none. The ring tells the day (and time).
 * @template {RemindedSchedule} S
 * @param {readonly S[]} schedules Schedules.
 * @param {(schedule: S) => WorkScheduleRule} ruleOf Rule of a schedule (its cases and exceptions read).
 * @param {Date} now Now.
 * @returns {(PlannedRing & { schedule: S })[]} Reminders.
 */
export function ephemerisRings<S extends RemindedSchedule>(schedules: readonly S[], ruleOf: (schedule: S) => WorkScheduleRule, now: Date): (PlannedRing & { schedule: S })[] {
  const { from, to } = reminderDayRange(now);
  return schedules.flatMap((schedule) => {
    if (!schedule.ephemeris || schedule.archived || !schedule.reminders.length) return [];
    return scheduleRuns(ruleOf(schedule), from, to).flatMap((run) => {
      const lines = [run.start === '00:00' ? dayText(run.day) : `${dayText(run.day)} · ${run.start}`];
      return occurrenceReminders(taggedKey('ephemeris', `${schedule.id}:${run.day}`), run.day, parisInstant(run.day, run.start), schedule.reminders).map((reminder) => ({ ...reminder, title: schedule.label, lines, schedule }));
    });
  });
}

/** What the reminders of a birthday are rung from (query `birthdays`, of the open workspace or of another one). */
export interface RemindedBirthday {
  id: string;
  name: string;
  birthDate: string;
  reminders: readonly ReminderValue[];
}

/**
 * Key of the reminders of a birthday on a day, before its reminder (`birthday:<contributor|relation>:<id>:<day>`).
 * @param {string} birthdayId Birthday (`personBirthdayId`).
 * @param {string} [date] Day; missing: any day (the start of the key). Optional.
 * @returns {string} Key prefix.
 */
export const birthdayRingPrefix = (birthdayId: string, date?: string): string => taggedKey('birthday', `${birthdayId}:${date ?? ''}`);

/**
 * Birthday of the key of a ring of a birthday reminder, among those given (a ring shown again gives « Ouvrir la fiche »
 * back).
 * @template {{ id: string }} B
 * @param {string} key Key of the ring.
 * @param {readonly B[]} birthdays Birthdays.
 * @returns {B | undefined} Birthday.
 */
export const birthdayRingOf = <B extends { id: string }>(key: string, birthdays: readonly B[]): B | undefined => birthdays.find((birthday) => key.startsWith(birthdayRingPrefix(birthday.id)));

/**
 * Reminders of the birthdays: « À HH:MM » on the day, « N jours avant, à HH:MM »; the ring tells « Anniversaire
 * de Paul — 40 ans » (the age when the year of birth is known) and its day.
 * @template {RemindedBirthday} B
 * @param {readonly B[]} birthdays Birthdays.
 * @param {Date} now Now.
 * @returns {(PlannedRing & { birthday: B })[]} Reminders.
 */
export function birthdayRings<B extends RemindedBirthday>(birthdays: readonly B[], now: Date): (PlannedRing & { birthday: B })[] {
  const { from, to } = reminderDayRange(now);
  return birthdays.flatMap((birthday) => {
    const birth = readBirthDate(birthday.birthDate);
    if (!birth || !birthday.reminders.length) return [];
    return birthdaysBetween(birth, from, to).flatMap(({ date }) =>
      remindersAt(birthdayRingPrefix(birthday.id, date), date, birthday.reminders).map((reminder) => ({ ...reminder, title: birthdayLabel(birthday.name, ageOn(birth, date)), lines: [dayText(date)], birthday })),
    );
  });
}

// Alarms ---------------------------------------------------------------------------------------------------------

/** An alarm as what is due is computed from (the app: GraphQL; the API: its row). */
export interface DueAlarmFields {
  id: string;
  enabled: boolean;
  type: AlarmType;
  minutes: number | null;
  startDate: string | null;
  time: string | null;
  frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  weekdays: number[];
  endDate: string | null;
  recurrence?: unknown;
  lastFiredAt: string | Date | null;
  createdAt: string | Date;
}

/**
 * Occurrence of a scheduled alarm (`REMINDER`, `NOT_TRACKING`) due now: its last one (`previousOccurrence`, Paris
 * time for the app and the server), after the one rung last (`lastFiredAt`, else its creation) and missed
 * by 6 hours at most.
 * @param {DueAlarmFields} alarm Alarm.
 * @param {Date} now Now.
 * @returns {Date | null} Occurrence due, or none.
 */
export function dueAlarmOccurrence(alarm: DueAlarmFields, now: Date): Date | null {
  if (!alarm.enabled || alarm.type === 'TRACKING_DURATION') return null;
  const occurrence = previousOccurrence(alarm, now);
  if (!occurrence) return null;
  const since = new Date(alarm.lastFiredAt ?? alarm.createdAt);
  return occurrence > since && now.getTime() - occurrence.getTime() <= RING_LATE_MS ? occurrence : null;
}

/**
 * Key of the ring of an occurrence of a scheduled alarm.
 * @param {string} alarmId Alarm.
 * @param {Date} occurrence Occurrence.
 * @returns {string} Key.
 */
export const alarmRingKey = (alarmId: string, occurrence: Date): string => `${alarmId}:${occurrence.getTime()}`;

/**
 * Step reached by a running timer for an alarm on its duration (`TRACKING_DURATION`): its seconds divided by the
 * minutes of the alarm; 0 for a paused timer or an alarm without minutes.
 * @param {number | null} minutes Minutes of the alarm.
 * @param {Parameters<typeof entrySeconds>[0]} entry Running timer.
 * @param {Date} now Now.
 * @returns {number} Step.
 */
export function trackingStep(minutes: number | null, entry: Parameters<typeof entrySeconds>[0], now: Date): number {
  if (!minutes || entry.pausedAt) return 0;
  return Math.floor(entrySeconds(entry, now.getTime()) / (minutes * 60));
}

/**
 * Whether a running timer counts for an alarm on its duration: an alarm of a task counts the timers on that task, an
 * alarm of a project (without task) those of that project and of its sub-projects at any depth, an alarm of neither
 * every timer.
 * @param {{ taskId: string | null, projectId: string | null }} alarm Alarm.
 * @param {{ projectId: string | null, taskIds: readonly string[] }} timer Running timer.
 * @param {readonly TreeItem[]} projects Every project of the workspace (id and parent).
 * @returns {boolean} Counted.
 */
export function timerCountsForAlarm(alarm: { taskId: string | null; projectId: string | null }, timer: { projectId: string | null; taskIds: readonly string[] }, projects: readonly TreeItem[]): boolean {
  if (alarm.taskId) return timer.taskIds.includes(alarm.taskId);
  if (alarm.projectId) return timer.projectId !== null && subtreeOf(projects, alarm.projectId).has(timer.projectId);
  return true;
}

/**
 * Key of the ring of a step of a running timer for an alarm on its duration.
 * @param {string} alarmId Alarm.
 * @param {string} entryId Timer.
 * @param {number} step Step.
 * @returns {string} Key.
 */
export const trackingRingKey = (alarmId: string, entryId: string, step: number): string => `${alarmId}:${entryId}:${step}`;

/**
 * Label of the link to the task of an alarm: its project first (a task number is only unique in its project), then its
 * number and label (« Site #12 Maquette »).
 * @param {{ number: number | null, label: string }} task Task.
 * @param {string} [projectLabel] Label of its project. Optional.
 * @returns {string} Label.
 */
export function alarmTaskLabel(task: { number: number | null; label: string }, projectLabel?: string): string {
  return `${projectLabel ? `${projectLabel} ` : ''}${taskNumbered(task)}`;
}

/** What an alarm or a reminder of a task is about, as a link: its task, or else its project. */
export interface AlarmTarget {
  label: string;
  to: string;
}

/**
 * Link of an alarm, the same in its list, its toast and its pushed notification: its task (« Site #12 Maquette »), or
 * else its project.
 * @param {{ taskId: string | null, projectId: string | null }} alarm Alarm.
 * @param {(id: string) => { id: string, number: number | null, label: string, projectId: string | null } | undefined} taskOf Task by id.
 * @param {(id: string) => { id: string, label: string } | undefined} projectOf Project by id.
 * @returns {AlarmTarget | null} Link, or none.
 */
export function alarmTarget(
  alarm: { taskId: string | null; projectId: string | null },
  taskOf: (id: string) => { id: string; number: number | null; label: string; projectId: string | null } | undefined,
  projectOf: (id: string) => { id: string; label: string } | undefined,
): AlarmTarget | null {
  const task = alarm.taskId ? taskOf(alarm.taskId) : undefined;
  // Its number is only unique in its project: the project comes with it.
  if (task) return { label: alarmTaskLabel(task, task.projectId ? projectOf(task.projectId)?.label : undefined), to: taskPath(task) };
  const project = alarm.projectId ? projectOf(alarm.projectId) : undefined;
  return project ? { label: project.label, to: projectPath(project.id) } : null;
}

/**
 * What the ring of an alarm shows: its label, then its note.
 * @param {{ label: string, note: string | null }} alarm Alarm.
 * @returns {RingText} Title and lines.
 */
export const alarmRingText = (alarm: { label: string; note: string | null }): RingText => ({ title: alarm.label, lines: shownLines([alarm.note]) });
