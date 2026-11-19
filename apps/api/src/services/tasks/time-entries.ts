import { durationSchema, parseOptionalDay, subtreeOf, TIME_SUBJECT_REQUIRED, timeDescriptionSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { TimeEntry } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { assertNoneArchived, assertNotArchived, refuseArchived } from '../core/archive';
import { connectIds } from '../core/relations';

/** Calendar event (and occurrence of a recurring one) a time is spent on. */
export interface TimeEventLink {
  eventId: string;
  /** Occurrence of a recurring event. */
  occurrenceDate: string | null;
}

/**
 * Prisma data of the event a time is spent on, after checking it (null: none, undefined: unchanged).
 * @param {TimeEventLink | null | undefined} link Event.
 * @returns {Promise<{ calendarEventId: string | null, calendarOccurrenceDate: Date | null } | undefined>} Data.
 */
async function eventLinkData(link: TimeEventLink | null | undefined): Promise<{ calendarEventId: string | null; calendarOccurrenceDate: Date | null } | undefined> {
  if (link === undefined) return undefined;
  if (link === null) return { calendarEventId: null, calendarOccurrenceDate: null };
  const event = await orNotFound(prisma.calendarEvent.findUnique({ where: { id: link.eventId }, select: { recurrence: true } }), 'Évènement', 'calendarEventId');
  const recurring = event.recurrence !== null;
  if (recurring && !link.occurrenceDate) throw fieldError('calendarEventId', 'Choisissez l’occurrence de l’évènement.');
  return { calendarEventId: link.eventId, calendarOccurrenceDate: recurring ? parseOptionalDay(link.occurrenceDate || null) : null };
}

/**
 * Project and routine of a time entry: the routine's project by default. A time has at least a project, a task, a
 * routine or an event (decision D17).
 * @param {string | null | undefined} projectId Project given.
 * @param {string | null | undefined} routineId Routine given.
 * @param {{ taskIds: readonly string[], eventId: string | null }} others Tasks and event of the time (after the change).
 * @returns {Promise<{ projectId: string | null, routineId: string | null }>} Both.
 */
async function placeOf(
  projectId: string | null | undefined,
  routineId: string | null | undefined,
  others: { taskIds: readonly string[]; eventId: string | null },
): Promise<{ projectId: string | null; routineId: string | null }> {
  if (!routineId) {
    if (!projectId && others.taskIds.length === 0 && !others.eventId) throw fieldError('projectId', TIME_SUBJECT_REQUIRED);
    return { projectId: projectId ?? null, routineId: null };
  }
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id: routineId }, select: { projectId: true } }), 'Routine', 'routineId');
  return { projectId: projectId ?? routine.projectId, routineId };
}

/**
 * Checks the project of a time entry and that its tasks belong to the project or its sub-projects.
 * @param {string | null} projectId Project (none: no task either).
 * @param {string[]} taskIds Tasks.
 * @param {string | null} [keptProjectId] Project the time already had: accepted even if archived. Optional.
 * @returns {Promise<void>}
 */
async function assertProjectAndTasks(projectId: string | null, taskIds: string[], keptProjectId?: string | null): Promise<void> {
  if (!projectId) {
    // Without project: only tasks of no project.
    if (taskIds.length && (await prisma.task.count({ where: { id: { in: taskIds }, projectId: { not: null } } }))) throw fieldError('taskIds', 'Choisissez d’abord le projet des tâches.');
    return;
  }
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true, archivedAt: true } });
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw notFound('Projet', 'projectId');
  if (projectId !== keptProjectId) refuseArchived(project, 'projectId');
  if (taskIds.length === 0) return;
  // The project and its sub-projects.
  const subtree = subtreeOf(projects, projectId);
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } }, select: { projectId: true } });
  if (tasks.length !== new Set(taskIds).size) throw notFound('Tâche', 'taskIds');
  // Tasks of no project go with any project.
  if (tasks.some((task) => task.projectId !== null && !subtree.has(task.projectId))) {
    throw fieldError('taskIds', 'Les tâches doivent appartenir au projet ou à ses sous-projets.');
  }
}

/**
 * Checks that the routine, the tasks and the event chosen for a time are not archived; the ones it already had stay
 * valid (decision AA: the error shows under the field).
 * @param {{ routineId: string | null, taskIds: readonly string[], eventId: string | null | undefined }} chosen Values chosen.
 * @param {{ routineId: string | null, taskIds: readonly string[], eventId: string | null }} [kept] Values the time already had. Optional.
 * @returns {Promise<void>}
 */
async function assertActiveLinks(
  chosen: { routineId: string | null; taskIds: readonly string[]; eventId: string | null | undefined },
  kept?: { routineId: string | null; taskIds: readonly string[]; eventId: string | null },
): Promise<void> {
  await assertNotArchived('routine', chosen.routineId, { keep: kept?.routineId, field: 'routineId' });
  await assertNoneArchived('task', chosen.taskIds, { keep: kept?.taskIds, field: 'taskIds' });
  await assertNotArchived('calendarEvent', chosen.eventId, { keep: kept?.eventId, field: 'calendarEventId' });
}

/**
 * Loads a time entry or throws NOT_FOUND.
 * @param {string} id Time entry id.
 * @returns {Promise<TimeEntry & { tasks: { id: string }[] }>} Time entry with its task ids.
 */
function findEntry(id: string) {
  return orNotFound(prisma.timeEntry.findUnique({ where: { id }, include: { tasks: { select: { id: true } }, document: { select: { number: true, status: true } } } }), 'Temps');
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
 * The running timer, if any.
 * @returns {Promise<TimeEntry | null>} Running entry.
 */
function runningEntry(): Promise<TimeEntry | null> {
  return prisma.timeEntry.findFirst({ where: { endedAt: null } });
}

/**
 * Stops the running timer (a paused timer ends when its pause started).
 * @returns {Promise<TimeEntry | null>} Stopped entry, or null when no timer runs.
 */
export async function stopTimer(): Promise<TimeEntry | null> {
  const entry = await runningEntry();
  if (!entry) return null;
  const endedAt = entry.pausedAt ?? new Date();
  const duration = Math.max(0, Math.floor((endedAt.getTime() - entry.startedAt.getTime()) / 1000) - entry.pausedSeconds);
  return prisma.timeEntry.update({ where: { id: entry.id }, data: { endedAt, pausedAt: null, duration } });
}

/**
 * Starts a timer; the running one, if any, is stopped first.
 * @param {object} input Timer input.
 * @param {string | null} [input.projectId] Project (the routine's by default). Optional.
 * @param {string | null} [input.routineId] Routine the time is spent on. Optional.
 * @param {string[]} input.taskIds Tasks the time is spent on.
 * @param {string | null} [input.description] What is being done. Optional.
 * @returns {Promise<TimeEntry>} Running entry.
 */
export async function startTimer(input: { projectId?: string | null; routineId?: string | null; taskIds: string[]; description?: string | null; event?: TimeEventLink | null }): Promise<TimeEntry> {
  const description = parseInput(timeDescriptionSchema, input.description ?? null);
  const place = await placeOf(input.projectId, input.routineId, { taskIds: input.taskIds, eventId: input.event?.eventId ?? null });
  await assertProjectAndTasks(place.projectId, input.taskIds);
  await assertActiveLinks({ ...place, taskIds: input.taskIds, eventId: input.event?.eventId });
  const link = await eventLinkData(input.event ?? null);
  await stopTimer();
  return prisma.timeEntry.create({
    data: {
      ...place,
      description,
      ...link,
      startedAt: new Date(),
      tasks: { connect: connectIds(input.taskIds) },
    },
  });
}

/**
 * Pauses or resumes the running timer.
 * @param {boolean} paused Target state.
 * @returns {Promise<TimeEntry>} Running entry.
 */
export async function setTimerPaused(paused: boolean): Promise<TimeEntry> {
  const entry = await runningEntry();
  if (!entry) throw clientError('BAD_USER_INPUT', 'Aucun chrono en cours.');
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
  /** Routine the time is spent on (null: none, undefined: unchanged). */
  routineId?: string | null;
  taskIds?: string[] | null;
  description?: string | null;
  startedAt?: Date | null;
  /** Seconds; finished entries only. */
  duration?: number | null;
  /** Event the time is spent on (null: none, undefined: unchanged). */
  event?: TimeEventLink | null;
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
  const taskIds = input.taskIds ?? [];
  const place = await placeOf(input.projectId, input.routineId, { taskIds, eventId: input.event?.eventId ?? null });
  await assertProjectAndTasks(place.projectId, taskIds);
  await assertActiveLinks({ ...place, taskIds, eventId: input.event?.eventId });
  const link = await eventLinkData(input.event ?? null);
  return prisma.timeEntry.create({
    data: {
      ...place,
      description,
      ...link,
      startedAt: input.startedAt,
      endedAt: new Date(input.startedAt.getTime() + duration * 1000),
      duration,
      tasks: { connect: connectIds(taskIds) },
    },
  });
}

/**
 * Updates a time entry. The running one keeps running (its duration is not editable).
 * @param {string} id Entry id.
 * @param {TimeEntryInput} input Changes; undefined leaves a field unchanged.
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
  const taskIds = input.taskIds ?? entry.tasks.map((task) => task.id);
  const eventId = input.event === undefined ? entry.calendarEventId : (input.event?.eventId ?? null);
  const place = await placeOf(input.projectId === undefined ? entry.projectId : input.projectId, input.routineId === undefined ? entry.routineId : input.routineId, { taskIds, eventId });
  await assertProjectAndTasks(place.projectId, taskIds, entry.projectId);
  await assertActiveLinks({ ...place, taskIds, eventId: input.event?.eventId }, { routineId: entry.routineId, taskIds: entry.tasks.map((task) => task.id), eventId: entry.calendarEventId });

  const startedAt = input.startedAt ?? entry.startedAt;
  const seconds = duration ?? entry.duration;
  const link = await eventLinkData(input.event);
  return prisma.timeEntry.update({
    where: { id },
    data: {
      ...place,
      description,
      ...link,
      startedAt,
      ...(!running && seconds !== null && { duration: seconds, endedAt: new Date(startedAt.getTime() + seconds * 1000) }),
      tasks: { set: connectIds(taskIds) },
    },
  });
}

/**
 * Deletes a time entry (the running timer is discarded).
 * @param {string} id Entry id.
 * @returns {Promise<void>}
 */
export async function deleteTimeEntry(id: string): Promise<void> {
  assertNotInvoiced(await findEntry(id));
  await prisma.timeEntry.delete({ where: { id } });
}

/**
 * Keeps the time spent in projects about to be deleted (decision D17): it leaves them, without project, with its
 * routine, tasks and event. Only the time left with nothing at all (no routine, no task, no event) is deleted: a time
 * has at least a project, a task, a routine or an event.
 * @param {string[]} projectIds Projects deleted (a project and its sub-projects).
 * @returns {Promise<void>}
 */
export async function releaseProjectTime(projectIds: string[]): Promise<void> {
  const inProjects = { projectId: { in: projectIds } };
  await prisma.timeEntry.deleteMany({ where: { ...inProjects, routineId: null, calendarEventId: null, tasks: { none: {} } } });
  await prisma.timeEntry.updateMany({ where: inProjects, data: { projectId: null } });
}
