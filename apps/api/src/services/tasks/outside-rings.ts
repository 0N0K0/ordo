import {
  alarmRingKey,
  alarmRingText,
  alarmTarget,
  birthdayRings,
  calendarRingPage,
  countdownRingKey,
  countdownRingText,
  dueAlarmOccurrence,
  ephemerisRings,
  eventRings,
  formatOptionalDay,
  nextAllowedMoment,
  PARIS_ZONE,
  PUSH_GRACE_MS,
  pushRingActions,
  readReminders,
  readRingSettings,
  reminderDayRange,
  reminderDaysAhead,
  RING_KEPT_MS,
  RING_LATE_MS,
  routineRings,
  routinesRingPage,
  taskRings,
  trackingRingKey,
  trackingStep,
  workspaceRingLine,
  workspaceRingPage,
  type AlarmRingInput,
  type PlannedRing,
  type RingPage,
  type RingSettings,
} from '@ordo/shared';
import { prisma } from '../../db';
import type { AlarmRing, Workspace } from '../../generated/prisma/client';
import { runInWorkspace } from '../../workspace-context';
import { birthdays } from '../calendar/birthdays';
import { eventOccurrences } from '../calendar/calendar-events';
import { scheduleRule } from '../calendar/work-schedules';
import { loadScheduleContext, occurrencesOf, reminderOccurrences, slotsOf } from '../routines/routines';
import { forEachWorkspace, listWorkspaces, meContributorId, scheduleJob } from '../workspaces/workspaces';
import { markAlarmFired } from './alarms';
import { ringAgainOutside, ringOutside } from './alarm-rings';
import { ringCountdown } from './countdowns';
import { storedDueDates, DUE_DATES_SELECT } from './due-dates';
import { pushEnabled, pushToUser } from './push';

/**
 * Rings outside the app (push notifications, lot 17c, decision FU). Every 30 seconds, for the users who chose « Sonner
 * hors de l'app » and have a device subscribed, the server finds what is due in **every** workspace (as the open app:
 * decision EO) with the same shared bricks as the app (`eventRings`, `taskRings`, `routineRings`, `ephemerisRings`,
 * `birthdayRings`, `dueAlarmOccurrence`, `trackingStep`, `countdownRingText`: same keys, instants and texts), and the
 * end of their timers. Each one due for 30 seconds (`PUSH_GRACE_MS`: an open app rings it first) and missed by 6 hours
 * at most (`isRingDue`: what fell due while the server slept is caught up) that no tab nor device rang yet (no
 * `AlarmRing` for its key) is recorded (`ringOutside`) and pushed to every device of the user; then each ring is pushed
 * again at its next ring (`AlarmRing.nextAt`, 30 seconds late: an open app rings it again first) until stopped.
 */

/** A ring due, found in a workspace (or a timer of a user), with what follows once rung. */
interface DueRing {
  input: AlarmRingInput;
  /** Only for this user (a reminder of a routine, deferred past the events keeping their « Moi » busy). Optional. */
  userId?: string;
  /** Consumed without ringing (« pas de chrono » while a timer runs). */
  silent?: boolean;
  /** Done once rung (an alarm records its occurrence), in its workspace. */
  done?: () => Promise<unknown>;
}

/**
 * Whether a planned ring is due for the server: due for `PUSH_GRACE_MS` at least, missed by 6 hours at most.
 * @param {Date} at Instant it is due.
 * @param {Date} now Now.
 * @returns {boolean} Due.
 */
const dueOutside = (at: Date, now: Date): boolean => {
  const late = now.getTime() - at.getTime();
  return late >= PUSH_GRACE_MS && late <= RING_LATE_MS;
};

/**
 * Ring of a reminder of a workspace, as the app would record it there (with the workspace line when there are several).
 * @param {PlannedRing} planned Reminder planned.
 * @param {Workspace} workspace Its workspace.
 * @param {boolean} several The user has several workspaces (the line « Espace « X » »).
 * @param {RingPage | null} page Link of the ring.
 * @returns {AlarmRingInput} Ring.
 */
function ringInput(planned: Pick<PlannedRing, 'key' | 'at' | 'title' | 'lines' | 'ringtone'>, workspace: Workspace, several: boolean, page: RingPage | null): AlarmRingInput {
  return {
    key: planned.key,
    workspaceId: workspace.id,
    title: planned.title,
    lines: [...(several ? [workspaceRingLine(workspace.label)] : []), ...planned.lines.filter(Boolean)],
    path: page?.path,
    linkLabel: page?.label,
    ringtone: planned.ringtone,
    dueAt: planned.at,
  };
}

/**
 * Reminders of the events, tasks, routines, éphémérides and birthdays of the workspace due now; those of the routines
 * for each user, deferred to the next free moment as in the app (`nextAllowedMoment`, decision FV).
 * @param {Workspace} workspace Workspace (the job runs in it).
 * @param {boolean} several The user has several workspaces.
 * @param {Date} now Now.
 * @param {readonly string[]} userIds Users ringing outside the app.
 * @returns {Promise<DueRing[]>} Rings due.
 */
async function dueReminders(workspace: Workspace, several: boolean, now: Date, userIds: readonly string[]): Promise<DueRing[]> {
  const label = several ? workspace.label : undefined;
  const { from, to } = reminderDayRange(now);
  const withReminders = { NOT: { reminders: { equals: [] } } };
  const [occurrences, tasks, projects, routineRows, schedules, people] = await Promise.all([
    eventOccurrences(from, to, undefined, true),
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null, ...withReminders }, select: { id: true, number: true, label: true, projectId: true, reminders: true, ...DUE_DATES_SELECT } }),
    prisma.project.findMany({ select: { id: true, label: true } }),
    prisma.routine.findMany({
      where: { archivedAt: null, ...withReminders },
      include: { checks: { orderBy: { date: 'desc' }, take: 20, select: { date: true, slot: true } }, assignees: { select: { id: true } } },
    }),
    prisma.workSchedule.findMany({ where: { ephemeris: true, archivedAt: null, ...withReminders }, include: { type: { select: { archivedAt: true } } } }),
    birthdays(),
  ]);
  const calendar = calendarRingPage(label);
  const projectOf = (id: string) => projects.find((project) => project.id === id);

  // Tasks: the « Ouverture » and « Échéance » they go by; their link is their page.
  const reminded = tasks.map((task) => {
    const dates = storedDueDates(task);
    return { ...task, closed: false, archived: false, effectiveMinDate: dates.minDate, effectiveDeadline: dates.deadline, reminders: readReminders(task.reminders) };
  });
  // Routines: the occurrences their reminders ring for, the times of the day of their current one (the line).
  const context = await loadScheduleContext();
  const routines = routineRows.map((routine) => {
    const reminders = readReminders(routine.reminders);
    const currentDate = occurrencesOf(routine, undefined, context).current;
    return {
      ...routine,
      archived: false,
      reminders,
      currentDate,
      reminderOccurrences: reminderOccurrences(routine, context, reminderDaysAhead(reminders)),
      slots: slotsOf(routine, currentDate, context).map((slot, index) => ({ index, ...slot })),
    };
  });
  const ephemerides = schedules.map((schedule) => ({ id: schedule.id, label: schedule.label, archived: false, ephemeris: true, reminders: readReminders(schedule.reminders), row: schedule }));

  const planned: { ring: PlannedRing; page: RingPage | null }[] = [
    ...eventRings(occurrences).map((ring) => ({ ring, page: calendar })),
    ...taskRings(reminded, now).map((ring) => {
      const target = alarmTarget({ taskId: ring.task.id, projectId: null }, () => ring.task, projectOf);
      return { ring, page: target ? { label: target.label, path: target.to } : null };
    }),
    ...ephemerisRings(ephemerides, ({ row }) => scheduleRule(row), now).map((ring) => ({ ring, page: calendar })),
    ...birthdayRings(people, now).map((ring) => ({ ring, page: calendar })),
  ];
  const shared = planned.filter(({ ring }) => dueOutside(ring.at, now)).map(({ ring, page }): DueRing => ({ input: ringInput(ring, workspace, several, page) }));
  // Routines: a reminder while an event keeps their assignees (none: « Moi », of each user) busy waits for the next free moment, as in the app.
  const routinesPage = routinesRingPage(label);
  const perUser: DueRing[] = [];
  for (const userId of userIds) {
    const meId = await meContributorId(userId);
    const rings = routineRings(routines, (routine, at) =>
      nextAllowedMoment({ assigneeIds: routine.assignees.map((assignee) => assignee.id), routineId: routine.id }, at, { events: occurrences, meId, timeZone: PARIS_ZONE }),
    );
    perUser.push(...rings.filter((ring) => dueOutside(ring.at, now)).map((ring) => ({ input: ringInput(ring, workspace, several, routinesPage), userId })));
  }
  return [...shared, ...perUser];
}

/**
 * Alarms of the workspace due now: the scheduled ones at their times (in Paris time, as in the app), recorded as rung (« pas de chrono »: consumed without ringing while a timer runs); those on the
 * duration of a timer at each step of each running timer (the step reached now only).
 * @param {Workspace} workspace Workspace (the job runs in it).
 * @param {boolean} several The user has several workspaces.
 * @param {Date} now Now.
 * @returns {Promise<DueRing[]>} Rings due.
 */
async function dueAlarms(workspace: Workspace, several: boolean, now: Date): Promise<DueRing[]> {
  const [alarms, running] = await Promise.all([
    prisma.alarm.findMany({ where: { enabled: true }, include: { task: { select: { id: true, number: true, label: true, projectId: true } }, project: { select: { id: true, label: true } } } }),
    prisma.timeEntry.findMany({ where: { endedAt: null }, select: { id: true, startedAt: true, endedAt: true, pausedAt: true, pausedSeconds: true, duration: true } }),
  ]);
  const entries = running.map((entry) => ({ ...entry, startedAt: entry.startedAt.toISOString(), endedAt: null, pausedAt: entry.pausedAt?.toISOString() ?? null }));
  const projects = new Map(alarms.flatMap((alarm) => (alarm.project ? [[alarm.project.id, alarm.project] as const] : [])));
  return alarms.flatMap((alarm) => {
    const target = alarmTarget(alarm, () => alarm.task ?? undefined, (id) => projects.get(id));
    const page = target ? { label: target.label, path: target.to } : several ? workspaceRingPage(workspace.label) : null;
    const text = alarmRingText(alarm);
    if (alarm.type === 'TRACKING_DURATION') {
      return entries.flatMap((entry) => {
        const step = trackingStep(alarm.minutes, entry, now);
        if (step <= 0 || !alarm.minutes) return [];
        // Instant the step was reached: its start, its pauses and the minutes of the steps.
        const at = new Date(new Date(entry.startedAt).getTime() + (entry.pausedSeconds + step * alarm.minutes * 60) * 1000);
        return dueOutside(at, now) ? [{ input: ringInput({ key: trackingRingKey(alarm.id, entry.id, step), at, ...text }, workspace, several, page) }] : [];
      });
    }
    const schedule = { ...alarm, startDate: formatOptionalDay(alarm.startDate), endDate: formatOptionalDay(alarm.endDate) };
    const occurrence = dueAlarmOccurrence(schedule, now);
    if (!occurrence || !dueOutside(occurrence, now)) return [];
    return [
      {
        input: ringInput({ key: alarmRingKey(alarm.id, occurrence), at: occurrence, ...text }, workspace, several, page),
        silent: alarm.type === 'NOT_TRACKING' && entries.length > 0,
        done: () => runInWorkspace(workspace, () => markAlarmFired(alarm.id, occurrence)),
      },
    ];
  });
}

/**
 * Ends of the timers of a user due now (running, over, not rung yet): their ring, then recorded as rung.
 * @param {string} userId User.
 * @param {Date} now Now.
 * @returns {Promise<DueRing[]>} Rings due.
 */
async function dueCountdowns(userId: string, now: Date): Promise<DueRing[]> {
  const countdowns = await prisma.countdown.findMany({ where: { userId, rungAt: null, endsAt: { lte: new Date(now.getTime() - PUSH_GRACE_MS), gte: new Date(now.getTime() - RING_LATE_MS) } } });
  return countdowns.map((countdown) => ({
    input: {
      key: countdownRingKey(countdown.id),
      workspaceId: countdown.workspaceId,
      ...countdownRingText(countdown),
      path: countdown.path,
      linkLabel: countdown.linkLabel,
      ringtone: countdown.ringtone,
      dueAt: countdown.endsAt ?? now,
    },
    done: () => ringCountdown(userId, countdown.id),
  }));
}

/**
 * Message pushed for a ring: its title, its lines, its page, « Arrêter » and « Répéter dans N min ».
 * @param {AlarmRing} ring Ring.
 * @param {RingSettings} settings Settings of the user.
 * @returns {Parameters<typeof pushToUser>[1]} Message.
 */
function ringPayload(ring: AlarmRing, settings: RingSettings): Parameters<typeof pushToUser>[1] {
  const lines = Array.isArray(ring.lines) ? ring.lines.filter((line): line is string => typeof line === 'string') : [];
  return { key: ring.key, title: ring.title, body: lines.join('\n'), path: ring.path ?? '/', workspaceId: ring.workspaceId, actions: pushRingActions(settings) };
}

/**
 * First ring of a ring due for a user: recorded and pushed to its devices, unless a tab or a device rang it already.
 * @param {{ id: string, settings: RingSettings }} user User.
 * @param {DueRing} due Ring due.
 * @returns {Promise<void>} Done.
 */
async function ringDue(user: { id: string; settings: RingSettings }, due: DueRing): Promise<void> {
  if (due.silent) return;
  try {
    const created = await ringOutside(user.id, due.input);
    if (created) await pushToUser(user.id, ringPayload(created, user.settings));
  } catch (error) {
    // One ring refused (a text too long…) does not stop the others.
    console.warn(`Sonnerie hors de l’app en échec (${due.input.key}).`, error);
  }
}

/**
 * One run: what is due for the users ringing outside the app is recorded and pushed, the rings to repeat pushed again.
 * @returns {Promise<void>} Done.
 */
export async function ringOutsideTheApp(): Promise<void> {
  if (!pushEnabled()) return;
  const users = (await prisma.user.findMany({ where: { pushSubscriptions: { some: {} } }, select: { id: true, ringSettings: true } }))
    .map((user) => ({ id: user.id, settings: readRingSettings(user.ringSettings) }))
    .filter((user) => user.settings.outside);
  if (!users.length) return;
  const userIds = users.map((user) => user.id);

  const now = new Date();
  const several = (await listWorkspaces()).length > 1;
  // What is due in every workspace (whatever workspace the user has open, decision EO); a workspace failing is logged.
  const rings: DueRing[] = [];
  await forEachWorkspace(async (workspace) => {
    rings.push(...(await dueReminders(workspace, several, now, userIds)), ...(await dueAlarms(workspace, several, now)));
  });

  for (const user of users) {
    for (const due of rings) if (!due.userId || due.userId === user.id) await ringDue(user, due);
    // The end of a timer of the user: recorded as rung once rung (the app shows it no more).
    for (const due of await dueCountdowns(user.id, now)) {
      await ringDue(user, due);
      await due.done?.();
    }
    // Repetitions due (a tab or a device that rang them again moved their next ring: none here).
    const repeats = await prisma.alarmRing.findMany({
      where: { userId: user.id, stoppedAt: null, nextAt: { lte: new Date(now.getTime() - PUSH_GRACE_MS) }, updatedAt: { gte: new Date(now.getTime() - RING_KEPT_MS) } },
    });
    for (const ring of repeats) {
      if (await ringAgainOutside(ring)) await pushToUser(user.id, ringPayload(ring, user.settings));
    }
  }
  // An alarm occurrence is recorded once, whoever it rang for.
  for (const due of rings) await due.done?.();
}

/**
 * Starts the job ringing outside the app: first run 15 seconds after the start, then every 30 seconds.
 * @returns {void}
 */
export function scheduleOutsideRings(): void {
  scheduleJob('Sonneries hors de l’app', ringOutsideTheApp, { delay: 15_000, interval: 30_000 });
}
