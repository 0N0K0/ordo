import { ageOn, birthdayLabel, birthdaysBetween, readBirthDate } from '../people/birthdays';
import { scheduleRuns, type WorkScheduleRule } from '../calendar/work-schedules';
import { occurrenceKey } from '../calendar/calendar';
import { APP_PATHS, projectPath, taskPath } from '../core/app-paths';
import { taggedKey } from '../core/tagged-key';
import { windowText } from '../routines/routines';
import { taskNumbered } from '../tasks/tasks';
import { entrySeconds, previousOccurrence, type AlarmType } from '../tasks/time';
import { addDays } from './days';
import { dayText, weekdayText } from './format';
import { occurrenceReminders, parisInstant, reminderDayRange, remindersAt, remindersBefore, taskReminders, type PlannedReminder, type ReminderValue } from './reminders';
import { RING_LATE_MS } from './ringing';

/**
 * What rings, and what its ring shows, computed the same way by the open app (`ringPlannedReminders`, `dueAlarms`) and
 * by the server ringing outside the app (push notifications, lot 17c, decision FU): the reminders of the events, tasks,
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
 * @returns {(PlannedRing & { task: T })[]} Reminders.
 */
export function taskRings<T extends RemindedTask>(tasks: readonly T[], now: Date): (PlannedRing & { task: T })[] {
  return tasks.flatMap((task) => {
    if (task.closed || task.archived || !task.reminders.length) return [];
    const days = { minDate: task.effectiveMinDate, deadline: task.effectiveDeadline, reminders: task.reminders };
    const lines = shownLines([task.effectiveDeadline && `Échéance : ${dayText(task.effectiveDeadline)}`]);
    return taskReminders(taggedKey('task', task.id), days, now).map((reminder) => ({ ...reminder, title: task.label, lines, task }));
  });
}

// Routines -------------------------------------------------------------------------------------------------------

/** What the reminders of a routine are rung from (a routine of the open workspace or of another one). */
export interface RemindedRoutine {
  id: string;
  label: string;
  archived: boolean;
  location?: string | null;
  /** Due day of its current occurrence. */
  currentDate?: string | null;
  reminders: readonly ReminderValue[];
  /** Occurrences its reminders ring for (`reminderOccurrences` of the API). */
  reminderOccurrences: readonly { date: string; day: string; slots: readonly { slot: number; at: Date | string; endAt?: Date | string | null }[] }[];
  /** Times of the day of its current occurrence (the line of the ring). */
  slots: readonly { index: number; fromTime: string | null; dueTime: string | null; windows?: unknown }[];
}

/** A reminder of a routine: its time of the day, and whether it is of its current occurrence (it can be ticked). */
export type RoutineRing<R> = PlannedRing & { routine: R; slot: number; current: boolean };

/**
 * Reminders of the routines (decision D16), for the occurrences the API gives: each « N min avant » before each time of
 * the day not ticked (its first day, « Ouverture », at its « dès »; from the end: its due day at its « jusqu'à », none
 * without it, decision FS), each « À HH:MM » once per occurrence, on its first day (from the end: its due day). An
 * archived routine has none. Out of the slots of the routine, a reminder waits for the next moment they allow
 * (`defer`, the open workspace only). The ring tells the window of its time of the day and the place.
 * @template {RemindedRoutine} R
 * @param {readonly R[]} routines Routines.
 * @param {(routine: R, at: Date) => Date | null} [defer] First moment from a reminder on its slots allow, null: none soon. Optional. Default = none.
 * @returns {RoutineRing<R>[]} Reminders.
 */
export function routineRings<R extends RemindedRoutine>(routines: readonly R[], defer?: (routine: R, at: Date) => Date | null): RoutineRing<R>[] {
  return routines.flatMap((routine) => {
    if (routine.archived || routine.reminders.length === 0) return [];
    return routine.reminderOccurrences.flatMap((occurrence) => {
      const key = taggedKey('routine', occurrenceKey(routine.id, occurrence.date));
      const first = occurrence.slots[0]?.slot ?? 0;
      const planned = [
        ...occurrence.slots.flatMap((slot) =>
          [
            ...remindersBefore(`${key}:${slot.slot}`, new Date(slot.at), routine.reminders),
            ...(slot.endAt ? remindersBefore(`${key}:${slot.slot}`, new Date(slot.endAt), routine.reminders, 'end') : []),
          ].map((reminder) => ({ ...reminder, slot: slot.slot })),
        ),
        ...[...remindersAt(key, occurrence.day, routine.reminders), ...remindersAt(key, occurrence.date, routine.reminders, true, 'end')].map((reminder) => ({ ...reminder, slot: first })),
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
 * Reminders of the éphémérides (lot 16, decision FO): for each run of consecutive days it covers (its first day from
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
 * Reminders of the birthdays (lot 16): « À HH:MM » on the day, « N jours avant, à HH:MM »; the ring tells « Anniversaire
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
      remindersAt(taggedKey('birthday', `${birthday.id}:${date}`), date, birthday.reminders).map((reminder) => ({ ...reminder, title: birthdayLabel(birthday.name, ageOn(birth, date)), lines: [dayText(date)], birthday })),
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
 * Occurrence of a scheduled alarm (`REMINDER`, `NOT_TRACKING`) due now: its last one (`previousOccurrence`), after the
 * one rung last (`lastFiredAt`, else its creation) and missed by 6 hours at most.
 * @param {DueAlarmFields} alarm Alarm.
 * @param {Date} now Now.
 * @param {string} [timeZone] Time zone of its date and time. Optional. Default = the local one (the browser).
 * @returns {Date | null} Occurrence due, or none.
 */
export function dueAlarmOccurrence(alarm: DueAlarmFields, now: Date, timeZone?: string): Date | null {
  if (!alarm.enabled || alarm.type === 'TRACKING_DURATION') return null;
  const occurrence = previousOccurrence(alarm, now, 2, timeZone);
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
