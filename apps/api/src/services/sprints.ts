import { addDays, formatDay, markdownSchema, parseDay, sprintNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Sprint } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Loads a sprint or throws NOT_FOUND.
 * @param {string} id Sprint id.
 * @returns {Promise<Sprint>} Sprint.
 */
async function findSprint(id: string): Promise<Sprint> {
  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw notFound('Sprint');
  return sprint;
}

const fieldsSchema = z
  .object({
    name: sprintNameSchema,
    goal: markdownSchema,
    startDate: z.iso.date({ error: 'La date de début est requise.' }),
    endDate: z.iso.date({ error: 'La date de fin est requise.' }),
  })
  .refine((fields) => fields.endDate >= fields.startDate, { path: ['endDate'], error: 'La fin doit suivre le début.' });

export interface SprintInput {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Prisma data of validated sprint fields.
 * @param {SprintInput} input Sprint.
 * @returns {object} Data.
 */
function sprintData(input: SprintInput) {
  const fields = parseInput(fieldsSchema, { ...input, goal: input.goal ?? null });
  return {
    name: fields.name,
    goal: fields.goal,
    startDate: new Date(`${fields.startDate}T00:00:00.000Z`),
    endDate: new Date(`${fields.endDate}T00:00:00.000Z`),
  };
}

/**
 * Creates a sprint of a project (its tasks and those of its project tree can be planned in it).
 * @param {string} projectId Project.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Created sprint.
 */
export async function createSprint(projectId: string, input: SprintInput): Promise<Sprint> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { archivedAt: true } });
  if (!project) throw notFound('Projet');
  if (project.archivedAt) throw clientError('BAD_USER_INPUT', 'Ce projet est archivé.');
  return prisma.sprint.create({ data: { projectId, ...sprintData(input) } });
}

/**
 * Updates a sprint.
 * @param {string} id Sprint id.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Updated sprint.
 */
export async function updateSprint(id: string, input: SprintInput): Promise<Sprint> {
  await findSprint(id);
  return prisma.sprint.update({ where: { id }, data: sprintData(input) });
}

/**
 * Deletes a sprint; its tasks simply leave it.
 * @param {string} id Sprint id.
 * @returns {Promise<void>}
 */
export async function deleteSprint(id: string): Promise<void> {
  await findSprint(id);
  await prisma.sprint.delete({ where: { id } });
}

/** Status of a task at the end of a sprint it is in. */
export interface SprintTaskStatus {
  sprintId: string;
  taskId: string;
  statusId: string | null;
  closed: boolean;
}

/**
 * Status of the tasks of the sprints ended before a day, at the end of each sprint: the last status recorded
 * up to its last day (the first one recorded when the task was created later). Tasks without recorded
 * status are left out (their current status stands).
 * @param {string} today Day (YYYY-MM-DD): sprints ending before it.
 * @returns {Promise<SprintTaskStatus[]>} Statuses.
 */
export async function sprintTaskStatuses(today: string): Promise<SprintTaskStatus[]> {
  const ended = await prisma.sprint.findMany({
    where: { endDate: { lt: parseDay(today) } },
    select: { id: true, endDate: true, tasks: { select: { id: true } } },
  });
  const taskIds = [...new Set(ended.flatMap((sprint) => sprint.tasks.map((task) => task.id)))];
  if (!taskIds.length) return [];
  const changes = await prisma.taskStatusChange.findMany({ where: { taskId: { in: taskIds } }, orderBy: { at: 'asc' }, select: { taskId: true, statusId: true, closed: true, at: true } });
  const byTask = new Map<string, typeof changes>();
  for (const change of changes) byTask.set(change.taskId, [...(byTask.get(change.taskId) ?? []), change]);
  const result: SprintTaskStatus[] = [];
  for (const sprint of ended) {
    // Up to the end of its last day.
    const end = parseDay(addDays(formatDay(sprint.endDate), 1)).getTime();
    for (const { id } of sprint.tasks) {
      const history = byTask.get(id);
      if (!history?.length) continue;
      const last = history.filter((change) => change.at.getTime() < end).at(-1) ?? history[0];
      result.push({ sprintId: sprint.id, taskId: id, statusId: last.statusId, closed: last.closed });
    }
  }
  return result;
}
