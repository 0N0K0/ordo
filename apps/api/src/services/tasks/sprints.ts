import { addDays, formatDay, groupBy, markdownSchema, parseDay, sprintSchema } from '@ordo/shared';
import { prisma } from '../../db';
import type { Sprint } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { assertNotArchived, assertActive, refuseArchived } from '../core/archive';
import { findOrNotFound } from '../core/lookup';

/**
 * Loads a sprint or throws NOT_FOUND.
 * @param {string} id Sprint id.
 * @returns {Promise<Sprint>} Sprint.
 */
function findSprint(id: string): Promise<Sprint> {
  return findOrNotFound(prisma.sprint, id, 'Sprint');
}

const fieldsSchema = sprintSchema(markdownSchema);

export interface SprintInput {
  label: string;
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
    label: fields.label,
    goal: fields.goal,
    startDate: parseDay(fields.startDate),
    endDate: parseDay(fields.endDate),
  };
}

/**
 * Creates a sprint of a project (its tasks and those of its project tree can be planned in it).
 * @param {string} projectId Project.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Created sprint.
 */
export async function createSprint(projectId: string, input: SprintInput): Promise<Sprint> {
  await assertActive(prisma.project, projectId, 'Projet', { field: 'projectId' });
  return prisma.sprint.create({ data: { projectId, ...sprintData(input) } });
}

/**
 * Updates a sprint.
 * @param {string} id Sprint id.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Updated sprint.
 */
export async function updateSprint(id: string, input: SprintInput): Promise<Sprint> {
  const sprint = await findSprint(id);
  // Read only when archived, or in an archived project.
  refuseArchived(sprint);
  await assertNotArchived('project', sprint.projectId);
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
  const byTask = groupBy(changes, (change) => change.taskId);
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
