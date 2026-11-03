import { durationSchema, timeDescriptionSchema } from '@ordo/shared';
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

/**
 * Checks the project of a time entry and that its tasks belong to the project or its sub-projects.
 * @param {string} projectId Project.
 * @param {string[]} taskIds Tasks.
 * @param {boolean} active Whether the project must not be archived (new time).
 * @returns {Promise<void>}
 */
async function assertProjectAndTasks(projectId: string, taskIds: string[], active: boolean): Promise<void> {
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
  if (tasks.some((task) => !subtree.has(task.projectId))) {
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
 * @param {string} input.projectId Project.
 * @param {string[]} input.taskIds Tasks the time is spent on.
 * @param {string | null} [input.description] What is being done. Optional.
 * @returns {Promise<TimeEntry>} Running entry.
 */
export async function startTimer(input: { projectId: string; taskIds: string[]; description?: string | null }): Promise<TimeEntry> {
  const description = parseInput(timeDescriptionSchema, input.description ?? null);
  await assertProjectAndTasks(input.projectId, input.taskIds, true);
  await stopTimer();
  return prisma.timeEntry.create({
    data: {
      projectId: input.projectId,
      description,
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
  taskIds?: string[] | null;
  description?: string | null;
  startedAt?: Date | null;
  /** Seconds; finished entries only. */
  duration?: number | null;
}

/**
 * Adds a time entry by hand.
 * @param {TimeEntryInput & { projectId: string, startedAt: Date, duration: number }} input Entry.
 * @returns {Promise<TimeEntry>} Created entry.
 */
export async function createTimeEntry(
  input: TimeEntryInput & { projectId: string; startedAt: Date; duration: number },
): Promise<TimeEntry> {
  const { description, duration } = parseInput(z.object({ description: timeDescriptionSchema, duration: durationSchema }), {
    description: input.description ?? null,
    duration: input.duration,
  });
  const taskIds = input.taskIds ?? [];
  await assertProjectAndTasks(input.projectId, taskIds, true);
  return prisma.timeEntry.create({
    data: {
      projectId: input.projectId,
      description,
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
  const projectId = input.projectId ?? entry.projectId;
  const taskIds = input.taskIds ?? entry.tasks.map((task) => task.id);
  await assertProjectAndTasks(projectId, taskIds, false);

  const startedAt = input.startedAt ?? entry.startedAt;
  const seconds = duration ?? entry.duration;
  return prisma.timeEntry.update({
    where: { id },
    data: {
      projectId,
      description,
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
