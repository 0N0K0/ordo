import { changedInheritance, effectiveTask, emptyTaskFields, readTaskHours, taskFieldsGiven, formatDay, formatOptionalDay, parseOptionalDay, TASK_INHERITABLE_FIELDS, taskFieldOrigin, type EffectiveTask, type InheritingTask, type TaskInheritableField, type TaskInheritanceContext } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import { fieldError } from '../../graphql/errors';
import { toJson } from '../core/json';
import { connectIds } from '../core/relations';

/** Columns of a task its inheritance reads (a Prisma selection). */
export const INHERITING_TASK_SELECT = {
  id: true,
  parentId: true,
  inheritedFields: true,
  projectId: true,
  priorityId: true,
  milestoneId: true,
  minDate: true,
  deadline: true,
  slotCondition: true,
  hours: true,
  location: true,
  locationLat: true,
  locationLon: true,
  assignees: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  sprints: { select: { id: true } },
} as const;

/** Task row as `INHERITING_TASK_SELECT` loads it. */
type InheritingTaskRow = Prisma.TaskGetPayload<{ select: typeof INHERITING_TASK_SELECT }>;

/**
 * Task row as its inheritance reads it (days YYYY-MM-DD, ids of its people and sprints).
 * @param {InheritingTaskRow} row Stored task.
 * @returns {InheritingTask} Task.
 */
function inheritingTask(row: InheritingTaskRow): InheritingTask {
  const ids = (items: { id: string }[]) => items.map((item) => item.id);
  return {
    id: row.id,
    parentId: row.parentId,
    inheritedFields: row.inheritedFields,
    projectId: row.projectId,
    priorityId: row.priorityId,
    milestoneId: row.milestoneId,
    minDate: formatOptionalDay(row.minDate),
    deadline: formatOptionalDay(row.deadline),
    slotCondition: row.slotCondition,
    hours: row.hours,
    location: row.location,
    locationLat: row.locationLat,
    locationLon: row.locationLon,
    assigneeIds: ids(row.assignees),
    beneficiaryIds: ids(row.beneficiaries),
    beneficiaryRelationIds: ids(row.beneficiaryRelations),
    sprintIds: ids(row.sprints),
  };
}

/**
 * What the inheritance of the tasks of the current workspace is computed from: every task (archived ones too: a parent
 * archived still gives its values), milestones, projects and sprints.
 * @returns {Promise<TaskInheritanceContext>} Context of `effectiveTask`.
 */
export async function loadTaskInheritance(): Promise<TaskInheritanceContext> {
  const [tasks, milestones, projects, sprints] = await Promise.all([
    prisma.task.findMany({ select: INHERITING_TASK_SELECT }),
    prisma.milestone.findMany({ select: { id: true, projectId: true, dueDate: true, archivedAt: true } }),
    prisma.project.findMany({ select: { id: true, startDate: true } }),
    prisma.sprint.findMany({ select: { id: true, startDate: true, endDate: true } }),
  ]);
  return {
    tasks: new Map(tasks.map((row) => [row.id, inheritingTask(row)])),
    milestones: new Map(milestones.map((row) => [row.id, { projectId: row.projectId, dueDate: formatOptionalDay(row.dueDate), archived: row.archivedAt !== null }])),
    projects: new Map(projects.map((row) => [row.id, { startDate: formatOptionalDay(row.startDate) }])),
    sprints: new Map(sprints.map((row) => [row.id, { startDate: formatDay(row.startDate), endDate: formatDay(row.endDate) }])),
  };
}

/**
 * Effective task of an id (`effectiveTask`), none for a task missing from the context.
 * @param {TaskInheritanceContext} context Loaded context.
 * @param {string} id Task.
 * @returns {EffectiveTask | null} Task as it goes.
 */
export function effectiveTaskOf(context: TaskInheritanceContext, id: string): EffectiveTask | null {
  const task = context.tasks.get(id);
  return task ? effectiveTask(task, context) : null;
}

/**
 * Effective tasks of the current workspace, by id (one load for all).
 * @param {readonly string[]} ids Tasks.
 * @returns {Promise<Map<string, EffectiveTask>>} Tasks as they go.
 */
export async function effectiveTasks(ids: readonly string[]): Promise<Map<string, EffectiveTask>> {
  const context = await loadTaskInheritance();
  return new Map(ids.flatMap((id) => {
    const task = effectiveTaskOf(context, id);
    return task ? [[id, task] as const] : [];
  }));
}

/**
 * Fields a top-level task inherits once placed under a parent after the fact: those without any
 * value of its own (`emptyTaskFields`), as at its creation, except those the change gives a value; its own values stay.
 * @param {string} id Task.
 * @param {object} [input] Change placing it (its values given stay its own). Optional.
 * @returns {Promise<TaskInheritableField[]>} Fields it inherits.
 */
export async function adoptedTaskFields(id: string, input: object = {}): Promise<TaskInheritableField[]> {
  const row = await prisma.task.findUnique({ where: { id }, select: INHERITING_TASK_SELECT });
  if (!row) return [];
  const given = new Set(taskFieldsGiven(input));
  return emptyTaskFields(inheritingTask(row)).filter((field) => !given.has(field));
}

/**
 * Prisma data emptying fields of a task on purpose (« Vider »): no value of its own, not inherited. Its
 * project cannot be emptied (a sub-task stays in the tree of its parent).
 * @param {readonly TaskInheritableField[] | null | undefined} fields Fields emptied.
 * @returns {Prisma.TaskUncheckedUpdateInput} Data.
 */
export function clearedTaskData(fields: readonly TaskInheritableField[] | null | undefined): Prisma.TaskUncheckedUpdateInput {
  const cleared = new Set(fields ?? []);
  if (cleared.has('PROJECT')) throw fieldError('clear', 'Le projet d’une sous-tâche ne se vide pas : elle reste dans l’arborescence de projets de sa tâche parente.');
  return {
    ...(cleared.has('ASSIGNEES') && { assignees: { set: [] } }),
    ...(cleared.has('BENEFICIARIES') && { beneficiaries: { set: [] }, beneficiaryRelations: { set: [] } }),
    ...(cleared.has('SLOT_CONDITION') && { slotCondition: Prisma.DbNull }),
    ...(cleared.has('HOURS') && { hours: [] }),
    ...(cleared.has('MIN_DATE') && { minDate: null }),
    ...(cleared.has('DEADLINE') && { deadline: null }),
    ...(cleared.has('LOCATION') && { location: null, locationLat: null, locationLon: null }),
    ...(cleared.has('PRIORITY') && { priorityId: null }),
    ...(cleared.has('MILESTONE') && { milestoneId: null }),
  };
}

/**
 * Inherited list of a task once changed (`changedInheritance`): fields set to inherit, those given an own value or
 * emptied left out; none without parent.
 * @param {readonly string[]} current Fields it inherits now.
 * @param {{ inherit?: readonly TaskInheritableField[] | null, clear?: readonly TaskInheritableField[] | null, input: object, hasParent: boolean }} change Change.
 * @returns {TaskInheritableField[]} Fields inherited.
 */
export function changedTaskInheritance(
  current: readonly string[],
  change: { inherit?: readonly TaskInheritableField[] | null; clear?: readonly TaskInheritableField[] | null; input: object; hasParent: boolean },
): TaskInheritableField[] {
  return changedInheritance(current, { inherit: change.inherit, own: [...taskFieldsGiven(change.input), ...(change.clear ?? [])], hasParent: change.hasParent, fields: TASK_INHERITABLE_FIELDS });
}

/**
 * Before tasks lose their parent (made top-level, parent moved out of their tree or deleted): each field they inherit
 * becomes their own, with the value they went by (nothing changes for the user), and they inherit nothing more. Their
 * dates taken from their milestone, project or sprint stay so (not stored).
 * @param {readonly string[]} ids Tasks.
 * @returns {Promise<void>}
 */
export async function freezeTaskInheritance(ids: readonly string[]): Promise<void> {
  const inheriting = await prisma.task.findMany({ where: { id: { in: [...ids] }, NOT: { inheritedFields: { isEmpty: true } } }, select: { id: true } });
  if (!inheriting.length) return;
  const context = await loadTaskInheritance();
  await prisma.$transaction(
    inheriting.map(({ id }) => {
      const task = effectiveTaskOf(context, id)!;
      const inherited = new Set(context.tasks.get(id)!.inheritedFields);
      const fromParent = (field: 'MIN_DATE' | 'DEADLINE') => taskFieldOrigin(task, field).source === 'PARENT';
      return prisma.task.update({
        where: { id },
        data: {
          inheritedFields: [],
          // The project is kept equal to the effective one anyway (`syncTaskProjects`).
          ...(inherited.has('ASSIGNEES') && { assignees: { set: connectIds(task.assigneeIds) } }),
          ...(inherited.has('BENEFICIARIES') && { beneficiaries: { set: connectIds(task.beneficiaryIds) }, beneficiaryRelations: { set: connectIds(task.beneficiaryRelationIds) } }),
          ...(inherited.has('SLOT_CONDITION') && { slotCondition: task.slotCondition === null ? Prisma.DbNull : toJson(task.slotCondition) }),
          ...(inherited.has('HOURS') && { hours: toJson(readTaskHours(task.hours)) }),
          ...(inherited.has('MIN_DATE') && { minDate: fromParent('MIN_DATE') ? parseOptionalDay(task.minDate) : null }),
          ...(inherited.has('DEADLINE') && { deadline: fromParent('DEADLINE') ? parseOptionalDay(task.deadline) : null }),
          ...(inherited.has('LOCATION') && { location: task.location, locationLat: task.locationLat, locationLon: task.locationLon }),
          ...(inherited.has('PRIORITY') && { priorityId: task.priorityId }),
          ...(inherited.has('MILESTONE') && { milestoneId: task.milestoneId }),
        },
      });
    }),
  );
}

/**
 * Tasks among those given that inherit their project but are stored in another one than their parent's (a project
 * inherited is stored too: numbers, GitHub, time), with the project to move them to.
 * @param {readonly string[]} ids Tasks.
 * @returns {Promise<{ id: string, projectId: string | null }[]>} Tasks to move.
 */
export async function tasksOffParentProject(ids: readonly string[]): Promise<{ id: string; projectId: string | null }[]> {
  const tasks = await prisma.task.findMany({
    where: { id: { in: [...ids] }, inheritedFields: { has: 'PROJECT' }, parentId: { not: null } },
    select: { id: true, projectId: true, parent: { select: { projectId: true } } },
  });
  return tasks.filter((task) => task.parent && task.parent.projectId !== task.projectId).map((task) => ({ id: task.id, projectId: task.parent!.projectId }));
}
