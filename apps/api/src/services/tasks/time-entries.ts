import { dayIn, DURATION_MAX_SECONDS, durationSchema, formatDay, formatOptionalDay, parseDay, parseOptionalDay, subtreeOf, TIME_SUBJECT_REQUIRED, timeDescriptionSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Prisma, TimeEntry } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { assertNoneArchived, refuseArchived } from '../core/archive';
import { connectIds } from '../core/relations';
import { modelDelegate } from '../core/delegate';
import { automated } from './task-automation-engine';
import { PARIS } from '../../today';
import { schedulePerWorkspace } from '../workspaces/workspaces';

/** Calendar event (and occurrence of a recurring one) a time is spent on. */
export interface TimeEventLink {
  eventId: string;
  /** Occurrence of a recurring event. */
  occurrenceDate: string | null;
}

/** What a time is spent on besides its project: tasks, routines, events (several of each). */
export interface TimeSubjects {
  taskIds: readonly string[];
  routineIds: readonly string[];
  events: readonly TimeEventLink[];
}

/** Event link as stored (`TimeEntryEvent`). */
type StoredEventLink = { eventId: string; occurrenceDate: Date | null };

/**
 * Event links of a time, each once, after checking them: every event exists, a recurring one needs its occurrence (a
 * one-off event ignores it).
 * @param {readonly TimeEventLink[]} links Events.
 * @returns {Promise<StoredEventLink[]>} Links as stored.
 */
async function eventLinksData(links: readonly TimeEventLink[]): Promise<StoredEventLink[]> {
  if (!links.length) return [];
  const ids = [...new Set(links.map((link) => link.eventId))];
  const events = await prisma.calendarEvent.findMany({ where: { id: { in: ids } }, select: { id: true, recurrence: true } });
  if (events.length !== ids.length) throw notFound('Évènement', 'events');
  const recurring = new Set(events.filter((event) => event.recurrence !== null).map((event) => event.id));
  const byKey = new Map<string, StoredEventLink>();
  for (const link of links) {
    if (recurring.has(link.eventId) && !link.occurrenceDate) throw fieldError('events', 'Choisissez l’occurrence de l’évènement.');
    const occurrenceDate = recurring.has(link.eventId) ? parseOptionalDay(link.occurrenceDate || null) : null;
    byKey.set(`${link.eventId}:${formatOptionalDay(occurrenceDate) ?? ''}`, { eventId: link.eventId, occurrenceDate });
  }
  return [...byKey.values()];
}

/**
 * Project of a time entry: the one given, else that of its first routine with a project. A time has at least a
 * project, a task, a routine or an event.
 * @param {string | null | undefined} projectId Project given.
 * @param {TimeSubjects} subjects Tasks, routines and events of the time (after the change).
 * @returns {Promise<string | null>} Project.
 */
async function placeOf(projectId: string | null | undefined, subjects: TimeSubjects): Promise<string | null> {
  if (!projectId && !subjects.taskIds.length && !subjects.routineIds.length && !subjects.events.length) throw fieldError('projectId', TIME_SUBJECT_REQUIRED);
  if (projectId || !subjects.routineIds.length) return projectId ?? null;
  const routines = await prisma.routine.findMany({ where: { id: { in: [...subjects.routineIds] } }, select: { id: true, projectId: true } });
  if (routines.length !== new Set(subjects.routineIds).size) throw notFound('Routine', 'routineIds');
  const byId = new Map(routines.map((routine) => [routine.id, routine.projectId]));
  return subjects.routineIds.map((id) => byId.get(id)).find((id) => id) ?? null;
}

/** Messages of the project tree check, for tasks and routines. */
const TREE_MESSAGES = {
  task: { field: 'taskIds', label: 'Tâche', noProject: 'Choisissez d’abord le projet des tâches.', outside: 'Les tâches doivent appartenir au projet ou à ses sous-projets.' },
  routine: { field: 'routineIds', label: 'Routine', noProject: 'Choisissez d’abord le projet des routines.', outside: 'Les routines doivent appartenir au projet ou à ses sous-projets.' },
} as const;

/**
 * Checks that tasks or routines of a time belong to its project or one of its sub-projects (those of no project go
 * with any project); without project, only those of no project.
 * @param {'task' | 'routine'} model Tasks or routines.
 * @param {readonly string[]} ids Their ids.
 * @param {Set<string> | null} subtree Project of the time and its sub-projects (null: no project).
 * @returns {Promise<void>}
 */
async function assertInProjectTree(model: 'task' | 'routine', ids: readonly string[], subtree: Set<string> | null): Promise<void> {
  if (!ids.length) return;
  const messages = TREE_MESSAGES[model];
  const items = await modelDelegate<{ findMany(args: object): Promise<{ projectId: string | null }[]> }>(model).findMany({ where: { id: { in: [...ids] } }, select: { projectId: true } });
  if (items.length !== new Set(ids).size) throw notFound(messages.label, messages.field);
  if (!subtree) {
    if (items.some((item) => item.projectId !== null)) throw fieldError(messages.field, messages.noProject);
    return;
  }
  if (items.some((item) => item.projectId !== null && !subtree.has(item.projectId))) throw fieldError(messages.field, messages.outside);
}

/**
 * Checks the project of a time entry and that its tasks and routines belong to the project or its sub-projects. While
 * its project stays, the tasks and routines it already had stay valid (one moved to another project since is kept),
 * only those added are checked.
 * @param {string | null} projectId Project (none: only tasks and routines of no project).
 * @param {TimeSubjects} subjects Tasks and routines of the time.
 * @param {{ projectId: string | null, subjects: TimeSubjects }} [kept] Project (accepted even if archived) and items the time already had. Optional.
 * @returns {Promise<void>}
 */
async function assertProjectTree(projectId: string | null, subjects: TimeSubjects, kept?: { projectId: string | null; subjects: TimeSubjects }): Promise<void> {
  const keptProjectId = kept?.projectId;
  let subtree: Set<string> | null = null;
  if (projectId) {
    const projects = await prisma.project.findMany({ select: { id: true, parentId: true, archivedAt: true } });
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw notFound('Projet', 'projectId');
    if (projectId !== keptProjectId) refuseArchived(project, 'projectId');
    subtree = subtreeOf(projects, projectId);
  }
  const same = kept !== undefined && kept.projectId === projectId;
  const added = (ids: readonly string[], had: readonly string[]) => (same ? ids.filter((id) => !had.includes(id)) : ids);
  await assertInProjectTree('task', added(subjects.taskIds, kept?.subjects.taskIds ?? []), subtree);
  await assertInProjectTree('routine', added(subjects.routineIds, kept?.subjects.routineIds ?? []), subtree);
}

/**
 * Checks that the routines, the tasks and the events chosen for a time are not archived; the ones it already had stay
 * valid (the error shows under the field).
 * @param {TimeSubjects} chosen Values chosen.
 * @param {TimeSubjects} [kept] Values the time already had. Optional.
 * @returns {Promise<void>}
 */
async function assertActiveLinks(chosen: TimeSubjects, kept?: TimeSubjects): Promise<void> {
  await assertNoneArchived('routine', chosen.routineIds, { keep: kept?.routineIds, field: 'routineIds' });
  await assertNoneArchived('task', chosen.taskIds, { keep: kept?.taskIds, field: 'taskIds' });
  const eventIds = (links: readonly TimeEventLink[] | undefined) => links?.map((link) => link.eventId);
  await assertNoneArchived('calendarEvent', eventIds(chosen.events), { keep: eventIds(kept?.events), field: 'events' });
}

/**
 * Checks what a time is spent on (project tree, archived items, events) and gives its project and stored event links.
 * @param {string | null | undefined} projectId Project given.
 * @param {TimeSubjects} subjects Tasks, routines and events (after the change).
 * @param {{ projectId: string | null, subjects: TimeSubjects }} [kept] What the time already had. Optional.
 * @returns {Promise<{ projectId: string | null, events: StoredEventLink[] }>} Project and event links.
 */
async function checkedSubjects(
  projectId: string | null | undefined,
  subjects: TimeSubjects,
  kept?: { projectId: string | null; subjects: TimeSubjects },
): Promise<{ projectId: string | null; events: StoredEventLink[] }> {
  const place = await placeOf(projectId, subjects);
  await assertProjectTree(place, subjects, kept);
  await assertActiveLinks(subjects, kept?.subjects);
  return { projectId: place, events: await eventLinksData(subjects.events) };
}

/**
 * Subjects of a stored time entry.
 * @param {{ tasks: { id: string }[], routines: { id: string }[], events: StoredEventLink[] }} entry Entry with its links.
 * @returns {TimeSubjects} Its subjects.
 */
const subjectsOf = (entry: { tasks: { id: string }[]; routines: { id: string }[]; events: StoredEventLink[] }): TimeSubjects => ({
  taskIds: entry.tasks.map((task) => task.id),
  routineIds: entry.routines.map((routine) => routine.id),
  events: entry.events.map((link) => ({ eventId: link.eventId, occurrenceDate: formatOptionalDay(link.occurrenceDate) })),
});

/** Prisma `select` of the links of a time entry. */
const LINKS = { tasks: { select: { id: true } }, routines: { select: { id: true } }, events: { select: { eventId: true, occurrenceDate: true } } } as const;

/**
 * Loads a time entry or throws NOT_FOUND.
 * @param {string} id Time entry id.
 * @returns {Promise<TimeEntry & TimeSubjects>} Time entry with its links and invoice.
 */
function findEntry(id: string) {
  return orNotFound(prisma.timeEntry.findUnique({ where: { id }, include: { ...LINKS, document: { select: { number: true, status: true } } } }), 'Temps');
}

/**
 * Checks that a time entry is not billed on a final invoice (it is part of what the invoice states).
 * @param {{ document: { number: string | null, status: string } | null }} entry Entry with its invoice.
 * @returns {void}
 */
function assertNotInvoiced(entry: { document: { number: string | null; status: string } | null }): void {
  if (entry.document?.status === 'FINAL') {
    throw clientError('BAD_USER_INPUT', `Ce temps est facturé sur ${entry.document.number} : il ne peut plus être modifié ni supprimé.`);
  }
}

/**
 * A running timer (several may run at once), or null when it is not running (stopped, or unknown).
 * @param {string} id Time entry id.
 * @returns {Promise<TimeEntry | null>} Running entry.
 */
function runningEntry(id: string): Promise<TimeEntry | null> {
  return prisma.timeEntry.findFirst({ where: { id, endedAt: null } });
}

/**
 * Stops a running entry (a paused timer ends when its pause started), unless it was stopped meanwhile (elsewhere, or
 * after 24 hours).
 * @param {TimeEntry} entry Running entry, as read.
 * @returns {Promise<TimeEntry | null>} Stopped entry, null when it no longer ran.
 */
async function stopEntry(entry: TimeEntry): Promise<TimeEntry | null> {
  const endedAt = entry.pausedAt ?? new Date();
  const duration = Math.max(0, Math.floor((endedAt.getTime() - entry.startedAt.getTime()) / 1000) - entry.pausedSeconds);
  // Only while it still runs as read (a pause or resume meanwhile: not stopped on stale values).
  const { count } = await prisma.timeEntry.updateMany({ where: { id: entry.id, endedAt: null, pausedAt: entry.pausedAt, pausedSeconds: entry.pausedSeconds }, data: { endedAt, pausedAt: null, duration } });
  return count ? { ...entry, endedAt, pausedAt: null, duration } : null;
}

/**
 * Stops the timers of the workspace that have run 24 hours (pauses left out, the longest time): each ends once its 24
 * hours are reached, its duration 24 hours, even when the app is closed (`scheduleTimerCap`).
 * @returns {Promise<number>} Timers stopped.
 */
export async function capRunningTimers(): Promise<number> {
  const now = Date.now();
  const running = await prisma.timeEntry.findMany({ where: { endedAt: null } });
  const over = running.filter((entry) => ((entry.pausedAt?.getTime() ?? now) - entry.startedAt.getTime()) / 1000 - entry.pausedSeconds >= DURATION_MAX_SECONDS);
  await prisma.$transaction(
    over.map((entry) =>
      prisma.timeEntry.update({
        where: { id: entry.id },
        data: { endedAt: new Date(entry.startedAt.getTime() + (entry.pausedSeconds + DURATION_MAX_SECONDS) * 1000), pausedAt: null, duration: DURATION_MAX_SECONDS },
      }),
    ),
  );
  return over.length;
}

/**
 * Stops, in every workspace, the timers that have run 24 hours (`capRunningTimers`), every 5 minutes.
 * @returns {void}
 */
export function scheduleTimerCap(): void {
  schedulePerWorkspace('Chronos de plus de 24 heures', capRunningTimers, { delay: 25_000, interval: 5 * 60_000 });
}

/**
 * Stops a running timer (a paused timer ends when its pause started); the others keep running.
 * @param {string} id Time entry id.
 * @returns {Promise<TimeEntry | null>} Stopped entry, or null when it does not run (any more).
 */
export async function stopTimer(id: string): Promise<TimeEntry | null> {
  const entry = await runningEntry(id);
  return entry ? stopEntry(entry) : null;
}

/**
 * « Arrêter tout »: stops every running timer of the workspace.
 * @returns {Promise<TimeEntry[]>} Entries this call stopped (not those stopped elsewhere meanwhile).
 */
export async function stopAllTimers(): Promise<TimeEntry[]> {
  const running = await prisma.timeEntry.findMany({ where: { endedAt: null } });
  return (await Promise.all(running.map(stopEntry))).filter((entry): entry is TimeEntry => entry !== null);
}

/**
 * What a new time is spent on, from an input (lists omitted: none).
 * @param {TimeEntryInput} input Input.
 * @returns {TimeSubjects} Subjects.
 */
const newSubjects = (input: TimeEntryInput): TimeSubjects => ({ taskIds: input.taskIds ?? [], routineIds: input.routineIds ?? [], events: input.events ?? [] });

/**
 * Prisma data of the links of a new time entry.
 * @param {TimeSubjects} subjects Subjects.
 * @param {StoredEventLink[]} events Event links checked.
 * @returns {object} Nested writes.
 */
const createLinks = (subjects: TimeSubjects, events: StoredEventLink[]) => ({
  tasks: { connect: connectIds(subjects.taskIds) },
  routines: { connect: connectIds(subjects.routineIds) },
  events: { create: events },
});

/**
 * Starts a timer; the ones running keep running (several at once, each counted in full).
 * @param {TimeEntryInput} input What the time is spent on (at least a project, a task, a routine or an event) and description.
 * @returns {Promise<TimeEntry>} Running entry.
 */
export const startTimer = automated(async function startTimer(input: Omit<TimeEntryInput, 'startedAt' | 'duration'>): Promise<TimeEntry> {
  const description = parseInput(timeDescriptionSchema, input.description ?? null);
  const subjects = newSubjects(input);
  const { projectId, events } = await checkedSubjects(input.projectId, subjects);
  return prisma.timeEntry.create({
    data: { projectId, description, startedAt: new Date(), ...createLinks(subjects, events) },
  });
}, (input) => input.taskIds ?? []);

/**
 * Pauses or resumes a running timer.
 * @param {string} id Time entry id.
 * @param {boolean} paused Target state.
 * @returns {Promise<TimeEntry>} Running entry.
 */
export async function setTimerPaused(id: string, paused: boolean): Promise<TimeEntry> {
  const entry = await runningEntry(id);
  if (!entry) throw clientError('BAD_USER_INPUT', 'Ce chrono ne tourne plus.');
  if (paused === (entry.pausedAt !== null)) return entry;
  if (paused) return prisma.timeEntry.update({ where: { id: entry.id }, data: { pausedAt: new Date() } });
  const pause = Math.floor((Date.now() - entry.pausedAt!.getTime()) / 1000);
  return prisma.timeEntry.update({
    where: { id: entry.id },
    data: { pausedAt: null, pausedSeconds: entry.pausedSeconds + pause },
  });
}

export interface TimeEntryInput {
  projectId?: string | null;
  /** Tasks (null: none at creation, unchanged at update). */
  taskIds?: readonly string[] | null;
  /** Routines (null: none at creation, unchanged at update). */
  routineIds?: readonly string[] | null;
  /** Events (null: none at creation, unchanged at update). */
  events?: readonly TimeEventLink[] | null;
  description?: string | null;
  startedAt?: Date | null;
  /** Seconds; finished entries only. */
  duration?: number | null;
}

/**
 * Adds a time entry by hand.
 * @param {TimeEntryInput & { startedAt: Date, duration: number }} input Entry (at least a project, a task, a routine or an event).
 * @returns {Promise<TimeEntry>} Created entry.
 */
export async function createTimeEntry(input: TimeEntryInput & { startedAt: Date; duration: number }): Promise<TimeEntry> {
  const { description, duration } = parseInput(z.object({ description: timeDescriptionSchema, duration: durationSchema }), {
    description: input.description ?? null,
    duration: input.duration,
  });
  const subjects = newSubjects(input);
  const { projectId, events } = await checkedSubjects(input.projectId, subjects);
  return prisma.timeEntry.create({
    data: {
      projectId,
      description,
      startedAt: input.startedAt,
      endedAt: new Date(input.startedAt.getTime() + duration * 1000),
      duration,
      ...createLinks(subjects, events),
    },
  });
}

/**
 * Updates a time entry. A running one keeps running (its duration is not editable).
 * @param {string} id Entry id.
 * @param {TimeEntryInput} input Changes; undefined (or null for a list) leaves a field unchanged.
 * @returns {Promise<TimeEntry>} Updated entry.
 */
export async function updateTimeEntry(id: string, input: TimeEntryInput): Promise<TimeEntry> {
  const entry = await findEntry(id);
  assertNotInvoiced(entry);
  const running = entry.endedAt === null;
  const { description, duration } = parseInput(z.object({ description: timeDescriptionSchema.optional(), duration: durationSchema.optional() }), {
    description: input.description === undefined ? undefined : input.description,
    duration: input.duration ?? undefined,
  });
  if (running && duration !== undefined) throw fieldError('duration', 'La durée d’un chrono en cours ne se modifie pas.');
  if (running && input.startedAt && input.startedAt.getTime() > Date.now()) {
    throw fieldError('startedAt', 'Le début ne peut pas être dans le futur.');
  }
  // Paused: the time run before the pause (its former pauses left out) may not become negative.
  if (running && input.startedAt && entry.pausedAt && input.startedAt.getTime() + entry.pausedSeconds * 1000 > entry.pausedAt.getTime()) {
    throw fieldError('startedAt', 'Le début doit précéder la pause.');
  }
  const kept = subjectsOf(entry);
  // Moved to another day (its events not given): it leaves the events that are not on that day.
  const otherDay = input.startedAt && input.events === undefined && dayIn(input.startedAt, PARIS) !== dayIn(entry.startedAt, PARIS);
  const events = otherDay ? await eventsOnDay(kept.events, dayIn(input.startedAt!, PARIS)) : (input.events ?? kept.events);
  // Removing the last item of a time without project is refused (TIME_SUBJECT_REQUIRED): the time is not deleted.
  const subjects: TimeSubjects = { taskIds: input.taskIds ?? kept.taskIds, routineIds: input.routineIds ?? kept.routineIds, events };
  const checked = await checkedSubjects(input.projectId === undefined ? entry.projectId : input.projectId, subjects, { projectId: entry.projectId, subjects: kept });

  const startedAt = input.startedAt ?? entry.startedAt;
  const seconds = duration ?? entry.duration;
  return prisma.timeEntry.update({
    where: { id },
    data: {
      projectId: checked.projectId,
      description,
      startedAt,
      ...(!running && seconds !== null && { duration: seconds, endedAt: new Date(startedAt.getTime() + seconds * 1000) }),
      tasks: { set: connectIds(subjects.taskIds) },
      routines: { set: connectIds(subjects.routineIds) },
      ...((input.events || otherDay) && { events: { deleteMany: {}, create: checked.events } }),
    },
  });
}

/**
 * Event links of a time that are on a day: an occurrence of that day, or a one-off event that day is within.
 * @param {readonly TimeEventLink[]} links Links.
 * @param {string} day Day (YYYY-MM-DD, Paris).
 * @returns {Promise<TimeEventLink[]>} Links kept.
 */
async function eventsOnDay(links: readonly TimeEventLink[], day: string): Promise<TimeEventLink[]> {
  const oneOff = links.filter((link) => link.occurrenceDate === null).map((link) => link.eventId);
  const events = new Map((await prisma.calendarEvent.findMany({ where: { id: { in: oneOff } }, select: { id: true, startDate: true, endDate: true } })).map((event) => [event.id, event]));
  return links.filter((link) => {
    if (link.occurrenceDate !== null) return link.occurrenceDate === day;
    const event = events.get(link.eventId);
    return Boolean(event && formatDay(event.startDate) <= day && formatDay(event.endDate) >= day);
  });
}

/**
 * Deletes a time entry (a running timer is discarded).
 * @param {string} id Entry id.
 * @returns {Promise<void>}
 */
export async function deleteTimeEntry(id: string): Promise<void> {
  assertNotInvoiced(await findEntry(id));
  await prisma.timeEntry.delete({ where: { id } });
}

/**
 * Keeps the time spent in projects about to be deleted: it leaves them, without project, with its
 * routines, tasks and events. Only the time left with nothing at all (no routine, no task, no event) is deleted: a
 * time has at least a project, a task, a routine or an event. A billed time is never deleted (it is part of its
 * invoice): it stays, with nothing attached.
 * @param {string[]} projectIds Projects deleted (a project and its sub-projects).
 * @returns {Promise<void>}
 */
export async function releaseProjectTime(projectIds: string[]): Promise<void> {
  const inProjects = { projectId: { in: projectIds } };
  await prisma.timeEntry.deleteMany({ where: { ...inProjects, documentId: null, routines: { none: {} }, events: { none: {} }, tasks: { none: {} } } });
  await prisma.timeEntry.updateMany({ where: inProjects, data: { projectId: null } });
}

/** Occurrences of an event about to be deleted: all of them, one (`on`), or it and the following ones (`from`). */
export interface GoneOccurrences {
  eventId: string;
  /** This occurrence only. Optional. */
  on?: string;
  /** This occurrence and the following ones. Optional. */
  from?: string;
}

/** Items about to be deleted, whose time may be left with nothing attached. */
export interface GoneSubjects {
  taskIds?: readonly string[];
  routineIds?: readonly string[];
  events?: readonly GoneOccurrences[];
}

/**
 * Condition of the event links of occurrences about to be deleted.
 * @param {GoneOccurrences} gone Occurrences.
 * @returns {Prisma.TimeEntryEventWhereInput} Prisma `where`.
 */
const goneLinkWhere = (gone: GoneOccurrences): Prisma.TimeEntryEventWhereInput => ({
  eventId: gone.eventId,
  ...(gone.on ? { occurrenceDate: parseDay(gone.on) } : gone.from ? { occurrenceDate: { gte: parseDay(gone.from) } } : {}),
});

/**
 * Times left with nothing attached once items go: without project, not billed (a billed
 * time is never deleted), whose every task, routine and event is among those deleted.
 * @param {GoneSubjects} gone Items about to be deleted.
 * @returns {Promise<string[]>} Ids of these times.
 */
export async function timeLeftEmpty(gone: GoneSubjects): Promise<string[]> {
  const taskIds = new Set(gone.taskIds ?? []);
  const routineIds = new Set(gone.routineIds ?? []);
  const events = gone.events ?? [];
  const any: Prisma.TimeEntryWhereInput[] = [
    ...(taskIds.size ? [{ tasks: { some: { id: { in: [...taskIds] } } } }] : []),
    ...(routineIds.size ? [{ routines: { some: { id: { in: [...routineIds] } } } }] : []),
    ...(events.length ? [{ events: { some: { OR: events.map(goneLinkWhere) } } }] : []),
  ];
  if (!any.length) return [];
  const entries = await prisma.timeEntry.findMany({ where: { projectId: null, documentId: null, OR: any }, select: { id: true, ...LINKS } });
  /**
   * Whether an event link is among the occurrences deleted.
   * @param {StoredEventLink} link Link.
   * @returns {boolean} Gone.
   */
  const linkGone = (link: StoredEventLink) =>
    events.some((item) => {
      if (item.eventId !== link.eventId) return false;
      const date = formatOptionalDay(link.occurrenceDate);
      return item.on ? date === item.on : item.from ? date !== null && date >= item.from : true;
    });
  return entries
    .filter((entry) => entry.tasks.every((task) => taskIds.has(task.id)) && entry.routines.every((routine) => routineIds.has(routine.id)) && entry.events.every(linkGone))
    .map((entry) => entry.id);
}

/**
 * Before items are deleted: deletes the times they leave with nothing attached (`timeLeftEmpty`), and the links of
 * the event occurrences deleted (the rows of a whole event go with it).
 * @param {GoneSubjects} gone Items about to be deleted.
 * @param {Prisma.TransactionClient} [client] Client or transaction writing. Optional. Default = the client of the workspace.
 * @returns {Promise<void>}
 */
export async function releaseSubjectTime(gone: GoneSubjects, client: Prisma.TransactionClient = prisma): Promise<void> {
  const ids = await timeLeftEmpty(gone);
  if (ids.length) await client.timeEntry.deleteMany({ where: { id: { in: ids } } });
  const occurrences = (gone.events ?? []).filter((item) => item.on || item.from);
  if (occurrences.length) await client.timeEntryEvent.deleteMany({ where: { OR: occurrences.map(goneLinkWhere) } });
}
