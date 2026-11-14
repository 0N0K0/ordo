import { durationSchema, parseDay, timeDescriptionSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { TimeEntry } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Error attached to a form field.
 * @param {string} field Field name.
 * @param {string} message Human-readable reason.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
function fieldError(field: string, message: string) {
  return clientError('BAD_USER_INPUT', message, { fields: { [field]: message } });
}

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
  const event = await prisma.calendarEvent.findUnique({ where: { id: link.eventId }, select: { recurrence: true } });
  if (!event) throw fieldError('calendarEventId', 'Évènement introuvable.');
  const recurring = event.recurrence !== null;
  if (recurring && !link.occurrenceDate) throw fieldError('calendarEventId', 'Choisissez l’occurrence de l’évènement.');
  return { calendarEventId: link.eventId, calendarOccurrenceDate: recurring && link.occurrenceDate ? parseDay(link.occurrenceDate) : null };
}

/**
 * Project and routine of a time entry: the routine's project by default; at least one of them.
 * @param {string | null | undefined} projectId Project given.
 * @param {string | null | undefined} routineId Routine given.
 * @returns {Promise<{ projectId: string | null, routineId: string | null }>} Both.
 */
async function placeOf(
  projectId: string | null | undefined,
  routineId: string | null | undefined,
): Promise<{ projectId: string | null; routineId: string | null }> {
  if (!routineId) {
    if (!projectId) throw fieldError('projectId', 'Le projet est requis.');
    return { projectId, routineId: null };
  }
  const routine = await prisma.routine.findUnique({ where: { id: routineId }, select: { projectId: true } });
  if (!routine) throw fieldError('routineId', 'Routine introuvable.');
  return { projectId: projectId ?? routine.projectId, routineId };
}

/**
 * Checks the project of a time entry and that its tasks belong to the project or its sub-projects.
 * @param {string | null} projectId Project (none: no task either).
 * @param {string[]} taskIds Tasks.
 * @param {boolean} active Whether the project must not be archived (new time).
 * @returns {Promise<void>}
 */
async function assertProjectAndTasks(projectId: string | null, taskIds: string[], active: boolean): Promise<void> {
  if (!projectId) {
    // Without project: only tasks of no project.
    if (taskIds.length && (await prisma.task.count({ where: { id: { in: taskIds }, projectId: { not: null } } }))) throw fieldError('taskIds', 'Choisissez d’abord le projet des tâches.');
    return;
  }
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true, archivedAt: true } });
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw fieldError('projectId', 'Projet introuvable.');
  if (active && project.archivedAt) throw fieldError('projectId', 'Ce projet est archivé.');
  if (taskIds.length === 0) return;
  // The project and its sub-projects.
  const subtree = new Set([projectId]);
  for (let added = true; added; ) {
    added = false;
    for (const item of projects) {
      if (item.parentId && subtree.has(item.parentId) && !subtree.has(item.id)) {
        subtree.add(item.id);
        added = true;
      }
    }
  }
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } }, select: { projectId: true } });
  if (tasks.length !== new Set(taskIds).size) throw fieldError('taskIds', 'Tâche introuvable.');
  // Tasks of no project go with any project.
  if (tasks.some((task) => task.projectId !== null && !subtree.has(task.projectId))) {
    throw fieldError('taskIds', 'Les tâches doivent appartenir au projet ou à ses sous-projets.');
  }
}

/**
 * Loads a time entry or throws NOT_FOUND.
 * @param {string} id Time entry id.
 * @returns {Promise<TimeEntry & { tasks: { id: string }[] }>} Time entry with its task ids.
 */
async function findEntry(id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id }, include: { tasks: { select: { id: true } }, document: { select: { number: true, status: true } } } });
  if (!entry) throw notFound('Temps');
  return entry;
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
export function runningEntry(): Promise<TimeEntry | null> {
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
export async function startTimer(input: {
  projectId?: string | null;
  routineId?: string | null;
  taskIds: string[];
  description?: string | null;
  event?: TimeEventLink | null;
}): Promise<TimeEntry> {
  const description = parseInput(timeDescriptionSchema, input.description ?? null);
  const place = await placeOf(input.projectId, input.routineId);
  await assertProjectAndTasks(place.projectId, input.taskIds, true);
  const link = await eventLinkData(input.event ?? null);
  await stopTimer();
  return prisma.timeEntry.create({
    data: {
      ...place,
      description,
      ...link,
      startedAt: new Date(),
      tasks: { connect: input.taskIds.map((id) => ({ id })) },
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
 * @param {TimeEntryInput & { startedAt: Date, duration: number }} input Entry (a project, a routine or both).
 * @returns {Promise<TimeEntry>} Created entry.
 */
export async function createTimeEntry(input: TimeEntryInput & { startedAt: Date; duration: number }): Promise<TimeEntry> {
  const { description, duration } = parseInput(z.object({ description: timeDescriptionSchema, duration: durationSchema }), {
    description: input.description ?? null,
    duration: input.duration,
  });
  const taskIds = input.taskIds ?? [];
  const place = await placeOf(input.projectId, input.routineId);
  await assertProjectAndTasks(place.projectId, taskIds, true);
  const link = await eventLinkData(input.event ?? null);
  return prisma.timeEntry.create({
    data: {
      ...place,
      description,
      ...link,
      startedAt: input.startedAt,
      endedAt: new Date(input.startedAt.getTime() + duration * 1000),
      duration,
      tasks: { connect: taskIds.map((id) => ({ id })) },
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
  const { description, duration } = parseInput(
    z.object({ description: timeDescriptionSchema.optional(), duration: durationSchema.optional() }),
    { description: input.description === undefined ? undefined : input.description, duration: input.duration ?? undefined },
  );
  if (running && duration !== undefined) throw fieldError('duration', 'La durée d’un chrono en cours ne se modifie pas.');
  if (running && input.startedAt && input.startedAt.getTime() > Date.now()) {
    throw fieldError('startedAt', 'Le début ne peut pas être dans le futur.');
  }
  const place = await placeOf(
    input.projectId === undefined ? entry.projectId : input.projectId,
    input.routineId === undefined ? entry.routineId : input.routineId,
  );
  const taskIds = input.taskIds ?? entry.tasks.map((task) => task.id);
  await assertProjectAndTasks(place.projectId, taskIds, false);

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
      tasks: { set: taskIds.map((taskId) => ({ id: taskId })) },
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
