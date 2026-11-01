import { commentBodySchema, dateSchema, effortSchema, markdownSchema, taskTitleSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Prisma, Task, TaskComment } from '../generated/prisma/client';
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
 * Root project of each project: tasks can only be linked inside the same tree.
 * @returns {Promise<(projectId: string) => string>} Root lookup.
 */
async function loadRootOf(): Promise<(projectId: string) => string> {
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(projects.map((project) => [project.id, project.parentId]));
  return (projectId) => {
    let current = projectId;
    for (let parent = parentOf.get(current); parent; parent = parentOf.get(current)) current = parent;
    return current;
  };
}

/**
 * Loads a task or throws NOT_FOUND.
 * @param {string} id Task id.
 * @returns {Promise<Task>} Task.
 */
async function findTask(id: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound('Tâche');
  return task;
}

/**
 * Ids of every sub-task of a task.
 * @param {string} id Task id.
 * @returns {Promise<string[]>} Descendant ids.
 */
async function descendantIds(id: string): Promise<string[]> {
  const tasks = await prisma.task.findMany({ select: { id: true, parentId: true } });
  const result: string[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const task of tasks) {
      if (task.parentId === current) {
        result.push(task.id);
        queue.push(task.id);
      }
    }
  }
  return result;
}

/**
 * Checks that a project exists and is active.
 * @param {string} projectId Project id.
 * @returns {Promise<void>}
 */
async function assertProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { archivedAt: true } });
  if (!project) throw fieldError('projectId', 'Projet introuvable.');
  if (project.archivedAt) throw fieldError('projectId', 'Ce projet est archivé.');
}

/**
 * Checks that a task can become the parent of another one (same tree, no cycle).
 * @param {string} parentId Parent candidate.
 * @param {string} projectId Project of the child.
 * @param {string | null} childId Child task, or null for a new task.
 * @returns {Promise<void>}
 */
async function assertParent(parentId: string, projectId: string, childId: string | null): Promise<void> {
  const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { projectId: true, archivedAt: true } });
  if (!parent) throw fieldError('parentId', 'Tâche parente introuvable.');
  if (parent.archivedAt) throw fieldError('parentId', 'Cette tâche est archivée.');
  const rootOf = await loadRootOf();
  if (rootOf(parent.projectId) !== rootOf(projectId)) {
    throw fieldError('parentId', 'La tâche parente doit appartenir au même projet ou à l’un de ses sous-projets.');
  }
  if (childId && (parentId === childId || (await descendantIds(childId)).includes(parentId))) {
    throw fieldError('parentId', 'Une tâche ne peut pas être placée sous l’une de ses sous-tâches.');
  }
}

/**
 * Checks that two tasks belong to the same project tree.
 * @param {string} taskId First task.
 * @param {string} otherId Second task.
 * @returns {Promise<void>}
 */
async function assertSameTree(taskId: string, otherId: string): Promise<void> {
  if (taskId === otherId) throw clientError('BAD_USER_INPUT', 'Une tâche ne peut pas être liée à elle-même.');
  const tasks = await prisma.task.findMany({ where: { id: { in: [taskId, otherId] } }, select: { projectId: true } });
  if (tasks.length !== 2) throw notFound('Tâche');
  const rootOf = await loadRootOf();
  if (rootOf(tasks[0].projectId) !== rootOf(tasks[1].projectId)) {
    throw clientError('BAD_USER_INPUT', 'Les deux tâches doivent appartenir au même projet ou à ses sous-projets.');
  }
}

/**
 * Checks that every referenced label and contributor exists.
 * @param {object} refs References.
 * @returns {Promise<void>}
 */
async function assertReferences(refs: {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  assigneeIds?: string[] | null;
}): Promise<void> {
  if (refs.statusId && !(await prisma.taskStatus.findUnique({ where: { id: refs.statusId } }))) throw notFound('Statut');
  if (refs.priorityId && !(await prisma.taskPriority.findUnique({ where: { id: refs.priorityId } }))) {
    throw notFound('Priorité');
  }
  if (refs.typeId && !(await prisma.taskType.findUnique({ where: { id: refs.typeId } }))) throw notFound('Type');
  if (refs.assigneeIds?.length) {
    const count = await prisma.contributor.count({ where: { id: { in: refs.assigneeIds } } });
    if (count !== new Set(refs.assigneeIds).size) throw notFound('Contributeur');
  }
}

/**
 * Converts a YYYY-MM-DD date to a UTC Date, keeping null and undefined.
 * @param {string | null | undefined} date Calendar date.
 * @returns {Date | null | undefined} Date at midnight UTC.
 */
function toDate(date: string | null | undefined): Date | null | undefined {
  if (date === undefined || date === null) return date;
  return new Date(`${date}T00:00:00.000Z`);
}

export interface TaskInput {
  title?: string | null;
  description?: string | null;
  projectId?: string | null;
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  assigneeIds?: string[] | null;
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  parentId?: string | null;
}

const detailsSchema = z.object({
  title: taskTitleSchema.optional(),
  description: markdownSchema.optional(),
  effort: effortSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

/**
 * Validates the scalar fields of a task (undefined: unchanged, null: cleared).
 * @param {TaskInput} input Raw input.
 * @param {{ startDate: Date | null, endDate: Date | null }} [current] Current dates on update. Optional.
 * @returns {object} Prisma data.
 */
function parseDetails(input: TaskInput, current?: { startDate: Date | null; endDate: Date | null }) {
  const details = parseInput(detailsSchema, {
    title: input.title ?? undefined,
    description: input.description,
    effort: input.effort,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  const startDate = details.startDate === undefined ? current?.startDate : toDate(details.startDate);
  const endDate = details.endDate === undefined ? current?.endDate : toDate(details.endDate);
  if (startDate && endDate && endDate < startDate) {
    throw fieldError('endDate', 'La date de fin doit suivre la date de début.');
  }
  return {
    title: details.title,
    description: details.description,
    effort: details.effort,
    startDate: toDate(details.startDate),
    endDate: toDate(details.endDate),
  };
}

/**
 * Next position at the end of the global task order.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(): Promise<number> {
  const { _max } = await prisma.task.aggregate({ _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/**
 * Creates a task at the end of the list.
 * @param {TaskInput & { title: string, projectId: string }} input Task input.
 * @returns {Promise<Task>} Created task.
 */
export async function createTask(input: TaskInput & { title: string; projectId: string }): Promise<Task> {
  if (!input.title?.trim()) throw fieldError('title', 'Le titre est requis.');
  const details = parseDetails(input);
  await assertProject(input.projectId);
  await assertReferences(input);
  if (input.parentId) await assertParent(input.parentId, input.projectId, null);

  return prisma.task.create({
    data: {
      ...details,
      title: details.title!,
      projectId: input.projectId,
      statusId: input.statusId ?? null,
      priorityId: input.priorityId ?? null,
      typeId: input.typeId ?? null,
      parentId: input.parentId ?? null,
      position: await nextPosition(),
      assignees: { connect: (input.assigneeIds ?? []).map((id) => ({ id })) },
    },
  });
}

/**
 * Updates a task. The project is changed with `transferTask`.
 * @param {string} id Task id.
 * @param {TaskInput} input Changes; undefined leaves a field unchanged, null clears it.
 * @returns {Promise<Task>} Updated task.
 */
export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const task = await findTask(id);
  const details = parseDetails(input, task);
  await assertReferences(input);
  if (input.parentId) await assertParent(input.parentId, task.projectId, id);

  return prisma.task.update({
    where: { id },
    data: {
      ...details,
      statusId: input.statusId,
      priorityId: input.priorityId,
      typeId: input.typeId,
      parentId: input.parentId,
      ...(input.assigneeIds && { assignees: { set: input.assigneeIds.map((assigneeId) => ({ id: assigneeId })) } }),
    },
  });
}

/**
 * Archives a task with its active sub-tasks, or restores it with the sub-tasks archived along
 * (and its archived ancestors, alone).
 * @param {string} id Task id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Task>} Updated task.
 */
export async function setTaskArchived(id: string, archived: boolean): Promise<Task> {
  const task = await findTask(id);
  if ((task.archivedAt !== null) === archived) return task;
  const descendants = await descendantIds(id);

  if (archived) {
    const now = new Date();
    const [, updated] = await prisma.$transaction([
      prisma.task.updateMany({
        where: { id: { in: descendants }, archivedAt: null },
        data: { archivedAt: now, archivedByCascade: true },
      }),
      prisma.task.update({ where: { id }, data: { archivedAt: now, archivedByCascade: false } }),
    ]);
    return updated;
  }

  const ancestorIds: string[] = [];
  for (let parentId = task.parentId; parentId; ) {
    const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { id: true, parentId: true, archivedAt: true } });
    if (!parent) break;
    if (parent.archivedAt) ancestorIds.push(parent.id);
    parentId = parent.parentId;
  }
  const [, , updated] = await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: descendants }, archivedByCascade: true },
      data: { archivedAt: null, archivedByCascade: false },
    }),
    prisma.task.updateMany({ where: { id: { in: ancestorIds } }, data: { archivedAt: null, archivedByCascade: false } }),
    prisma.task.update({ where: { id }, data: { archivedAt: null, archivedByCascade: false } }),
  ]);
  return updated;
}

/**
 * Deletes a task; its sub-tasks are deleted too, or moved up to its parent.
 * @param {string} id Task id.
 * @param {boolean} deleteSubtasks Whether to delete the whole sub-tree.
 * @returns {Promise<void>}
 */
export async function deleteTask(id: string, deleteSubtasks: boolean): Promise<void> {
  const task = await findTask(id);
  if (deleteSubtasks) {
    const descendants = await descendantIds(id);
    await prisma.task.deleteMany({ where: { id: { in: [id, ...descendants] } } });
    return;
  }
  await prisma.$transaction([
    prisma.task.updateMany({ where: { parentId: id }, data: { parentId: task.parentId } }),
    prisma.task.delete({ where: { id } }),
  ]);
}

/**
 * Transfers a task and its sub-tasks to another project. Links leaving the new project tree are removed.
 * @param {string} id Task id.
 * @param {string} projectId Target project.
 * @returns {Promise<{ task: Task, removedLinks: number }>} Moved task and number of removed links.
 */
export async function transferTask(id: string, projectId: string): Promise<{ task: Task; removedLinks: number }> {
  const task = await findTask(id);
  await assertProject(projectId);
  const moved = [id, ...(await descendantIds(id))];
  const rootOf = await loadRootOf();
  const targetRoot = rootOf(projectId);

  // Tasks outside the moved set that end up in another tree lose their links with it.
  const others = await prisma.task.findMany({
    where: { id: { notIn: moved } },
    select: { id: true, projectId: true },
  });
  const outside = others.filter((other) => rootOf(other.projectId) !== targetRoot).map((other) => other.id);
  const parentOutside = task.parentId !== null && outside.includes(task.parentId);

  const results = await prisma.$transaction([
    prisma.taskBlock.deleteMany({
      where: {
        OR: [
          { blockerId: { in: moved }, blockedId: { in: outside } },
          { blockedId: { in: moved }, blockerId: { in: outside } },
        ],
      },
    }),
    prisma.taskRelation.deleteMany({
      where: {
        OR: [
          { taskAId: { in: moved }, taskBId: { in: outside } },
          { taskBId: { in: moved }, taskAId: { in: outside } },
        ],
      },
    }),
    // Sub-tasks of the moved task whose parent is outside the moved set cannot exist: they all move.
    prisma.task.updateMany({ where: { id: { in: moved } }, data: { projectId } }),
    prisma.task.update({ where: { id }, data: parentOutside ? { parentId: null } : {} }),
  ]);
  const removedLinks = results[0].count + results[1].count + (parentOutside ? 1 : 0);
  return { task: results[3], removedLinks };
}

/**
 * Clones a task (every field, assignees and links, but not comments), optionally with its sub-tasks.
 * @param {string} id Task id.
 * @param {boolean} includeSubtasks Whether to clone the sub-tree too.
 * @returns {Promise<Task>} Clone of the task.
 */
export async function cloneTask(id: string, includeSubtasks: boolean): Promise<Task> {
  const include = { assignees: { select: { id: true } }, blocking: true, blockedBy: true, relationsA: true, relationsB: true };
  const source = await prisma.task.findUnique({ where: { id }, include });
  if (!source) throw notFound('Tâche');

  return prisma.$transaction(async (tx) => {
    let position = ((await tx.task.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1;

    /**
     * Copies one task under a parent.
     * @param {object} task Source task with assignees.
     * @param {string | null} parentId Parent of the copy.
     * @returns {Promise<Task>} Copy.
     */
    const copy = (
      task: Prisma.TaskGetPayload<{ include: { assignees: { select: { id: true } } } }>,
      parentId: string | null,
    ) =>
      tx.task.create({
        data: {
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          statusId: task.statusId,
          priorityId: task.priorityId,
          typeId: task.typeId,
          effort: task.effort,
          startDate: task.startDate,
          endDate: task.endDate,
          parentId,
          position: position++,
          assignees: { connect: task.assignees },
        },
      });

    const clone = await copy(source, source.parentId);
    await tx.taskBlock.createMany({
      data: [
        ...source.blocking.map((link) => ({ blockerId: clone.id, blockedId: link.blockedId })),
        ...source.blockedBy.map((link) => ({ blockerId: link.blockerId, blockedId: clone.id })),
      ],
    });
    const related = [
      ...source.relationsA.map((link) => link.taskBId),
      ...source.relationsB.map((link) => link.taskAId),
    ];
    await tx.taskRelation.createMany({
      data: related.map((other) => (clone.id < other ? { taskAId: clone.id, taskBId: other } : { taskAId: other, taskBId: clone.id })),
    });

    if (includeSubtasks) {
      const queue: { sourceId: string; cloneId: string }[] = [{ sourceId: source.id, cloneId: clone.id }];
      while (queue.length > 0) {
        const { sourceId, cloneId } = queue.shift()!;
        const children = await tx.task.findMany({
          where: { parentId: sourceId },
          orderBy: { position: 'asc' },
          include: { assignees: { select: { id: true } } },
        });
        for (const child of children) {
          const childClone = await copy(child, cloneId);
          queue.push({ sourceId: child.id, cloneId: childClone.id });
        }
      }
    }
    return clone;
  });
}

/**
 * Whether `from` reaches `to` by following "blocks" links.
 * @param {string} from Start task.
 * @param {string} to Target task.
 * @returns {Promise<boolean>} True when a path exists.
 */
async function blocksPath(from: string, to: string): Promise<boolean> {
  const links = await prisma.taskBlock.findMany();
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...links.filter((link) => link.blockerId === current).map((link) => link.blockedId));
  }
  return false;
}

/**
 * Records that a task blocks another one (cycles refused).
 * @param {string} blockerId Blocking task.
 * @param {string} blockedId Blocked task.
 * @returns {Promise<void>}
 */
export async function addTaskBlock(blockerId: string, blockedId: string): Promise<void> {
  await assertSameTree(blockerId, blockedId);
  if (await blocksPath(blockedId, blockerId)) {
    throw clientError('BAD_USER_INPUT', 'Ce lien créerait un blocage circulaire.');
  }
  await prisma.taskBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

/**
 * Removes a "blocks" link.
 * @param {string} blockerId Blocking task.
 * @param {string} blockedId Blocked task.
 * @returns {Promise<void>}
 */
export async function removeTaskBlock(blockerId: string, blockedId: string): Promise<void> {
  await prisma.taskBlock.deleteMany({ where: { blockerId, blockedId } });
}

/**
 * Orders a symmetric pair the way it is stored.
 * @param {string} a First task.
 * @param {string} b Second task.
 * @returns {{ taskAId: string, taskBId: string }} Stored pair.
 */
function relationPair(a: string, b: string) {
  return a < b ? { taskAId: a, taskBId: b } : { taskAId: b, taskBId: a };
}

/**
 * Records that two tasks are related.
 * @param {string} taskId First task.
 * @param {string} otherId Second task.
 * @returns {Promise<void>}
 */
export async function addTaskRelation(taskId: string, otherId: string): Promise<void> {
  await assertSameTree(taskId, otherId);
  const pair = relationPair(taskId, otherId);
  await prisma.taskRelation.upsert({ where: { taskAId_taskBId: pair }, create: pair, update: {} });
}

/**
 * Removes a "related to" link.
 * @param {string} taskId First task.
 * @param {string} otherId Second task.
 * @returns {Promise<void>}
 */
export async function removeTaskRelation(taskId: string, otherId: string): Promise<void> {
  await prisma.taskRelation.deleteMany({ where: relationPair(taskId, otherId) });
}

/**
 * Adds a comment to a task.
 * @param {string} taskId Task id.
 * @param {string} body Markdown body.
 * @returns {Promise<TaskComment>} Comment.
 */
export async function addComment(taskId: string, body: string): Promise<TaskComment> {
  await findTask(taskId);
  const parsed = parseInput(z.object({ body: commentBodySchema }), { body });
  return prisma.taskComment.create({ data: { taskId, body: parsed.body } });
}

/**
 * Edits a comment.
 * @param {string} id Comment id.
 * @param {string} body New markdown body.
 * @returns {Promise<TaskComment>} Comment.
 */
export async function updateComment(id: string, body: string): Promise<TaskComment> {
  if (!(await prisma.taskComment.findUnique({ where: { id } }))) throw notFound('Commentaire');
  const parsed = parseInput(z.object({ body: commentBodySchema }), { body });
  return prisma.taskComment.update({ where: { id }, data: { body: parsed.body } });
}

/**
 * Deletes a comment.
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
export async function deleteComment(id: string): Promise<void> {
  const { count } = await prisma.taskComment.deleteMany({ where: { id } });
  if (count === 0) throw notFound('Commentaire');
}

/**
 * Moves a task in the global manual order, just before another task (or at the end).
 * Placing relative to a neighbour works the same in a filtered view.
 * @param {string} id Task id.
 * @param {string | null} beforeId Task to place it before, or null for the end.
 * @returns {Promise<void>}
 */
export async function moveTask(id: string, beforeId: string | null): Promise<void> {
  await findTask(id);
  if (beforeId === id) return;
  const ordered = await prisma.task.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, position: true },
  });
  const others = ordered.filter((task) => task.id !== id).map((task) => task.id);
  const index = beforeId === null ? others.length : others.indexOf(beforeId);
  if (index < 0) throw notFound('Tâche');
  const order = [...others.slice(0, index), id, ...others.slice(index)];
  const current = new Map(ordered.map((task) => [task.id, task.position]));
  // Only rows whose position changes are written.
  await prisma.$transaction(
    order
      .map((taskId, position) => ({ taskId, position }))
      .filter(({ taskId, position }) => current.get(taskId) !== position)
      .map(({ taskId, position }) => prisma.task.update({ where: { id: taskId }, data: { position } })),
  );
}

export interface BulkTaskChanges {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  addAssigneeIds?: string[] | null;
  removeAssigneeIds?: string[] | null;
}

/**
 * Checks that every task exists.
 * @param {string[]} ids Task ids.
 * @returns {Promise<void>}
 */
async function assertTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) throw clientError('BAD_USER_INPUT', 'Aucune tâche sélectionnée.');
  const count = await prisma.task.count({ where: { id: { in: ids } } });
  if (count !== new Set(ids).size) throw notFound('Tâche');
}

/**
 * Applies the same changes to several tasks. Undefined fields are left unchanged, null clears them.
 * @param {string[]} ids Task ids.
 * @param {BulkTaskChanges} changes Changes.
 * @returns {Promise<void>}
 */
export async function bulkUpdateTasks(ids: string[], changes: BulkTaskChanges): Promise<void> {
  await assertTasks(ids);
  await assertReferences({
    ...changes,
    assigneeIds: [...(changes.addAssigneeIds ?? []), ...(changes.removeAssigneeIds ?? [])],
  });
  const add = (changes.addAssigneeIds ?? []).map((assigneeId) => ({ id: assigneeId }));
  const remove = (changes.removeAssigneeIds ?? []).map((assigneeId) => ({ id: assigneeId }));

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { statusId: changes.statusId, priorityId: changes.priorityId, typeId: changes.typeId },
    }),
    ...(add.length || remove.length
      ? ids.map((taskId) =>
          prisma.task.update({
            where: { id: taskId },
            data: { assignees: { ...(add.length && { connect: add }), ...(remove.length && { disconnect: remove }) } },
          }),
        )
      : []),
  ]);
}

/**
 * Keeps only the topmost tasks of a selection: a selected sub-task moves or goes with its selected ancestor.
 * @param {string[]} ids Selected task ids.
 * @returns {Promise<string[]>} Ids without selected descendants.
 */
async function topmost(ids: string[]): Promise<string[]> {
  const selected = new Set(ids);
  const tasks = await prisma.task.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(tasks.map((task) => [task.id, task.parentId]));
  return ids.filter((id) => {
    for (let parent = parentOf.get(id); parent; parent = parentOf.get(parent)) {
      if (selected.has(parent)) return false;
    }
    return true;
  });
}

/**
 * Transfers several tasks (with their sub-tasks) to another project.
 * @param {string[]} ids Task ids.
 * @param {string} projectId Target project.
 * @returns {Promise<number>} Number of links removed because they left the project tree.
 */
export async function bulkTransferTasks(ids: string[], projectId: string): Promise<number> {
  await assertTasks(ids);
  let removedLinks = 0;
  for (const id of await topmost(ids)) removedLinks += (await transferTask(id, projectId)).removedLinks;
  return removedLinks;
}

/**
 * Archives or restores several tasks (with the usual cascade).
 * @param {string[]} ids Task ids.
 * @param {boolean} archived Target state.
 * @returns {Promise<void>}
 */
export async function bulkSetTasksArchived(ids: string[], archived: boolean): Promise<void> {
  await assertTasks(ids);
  for (const id of await topmost(ids)) await setTaskArchived(id, archived);
}

/**
 * Deletes several tasks; their unselected sub-tasks are deleted too, or moved up.
 * @param {string[]} ids Task ids.
 * @param {boolean} deleteSubtasks Whether to delete the sub-trees.
 * @returns {Promise<void>}
 */
export async function bulkDeleteTasks(ids: string[], deleteSubtasks: boolean): Promise<void> {
  await assertTasks(ids);
  for (const id of await topmost(ids)) {
    if (await prisma.task.findUnique({ where: { id }, select: { id: true } })) await deleteTask(id, deleteSubtasks);
  }
  // Selected sub-tasks moved up by a deletion are still selected: delete them as well.
  if (!deleteSubtasks) await prisma.task.deleteMany({ where: { id: { in: ids } } });
}
