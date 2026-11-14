import { commentBodySchema, dateSchema, effortSchema, markdownSchema, slotRuleSchema, taskTitleSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type Task, type TaskComment } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { attachAssignees } from './contributors';
import { forgetGithubComment, forgetGithubItems } from './github/links';
import { forgetDeletedOccurrences } from './task-recurrence';

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
async function loadRootOf(): Promise<(projectId: string | null) => string | null> {
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(projects.map((project) => [project.id, project.parentId]));
  // The tasks without project make a tree of their own (null).
  return (projectId) => {
    if (projectId === null) return null;
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
 * @param {string | null} projectId Project of the child (none: the parent has none either).
 * @param {string | null} childId Child task, or null for a new task.
 * @returns {Promise<void>}
 */
async function assertParent(parentId: string, projectId: string | null, childId: string | null): Promise<void> {
  const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { projectId: true, archivedAt: true } });
  if (!parent) throw fieldError('parentId', 'Tâche parente introuvable.');
  if (parent.archivedAt) throw fieldError('parentId', 'Cette tâche est archivée.');
  const rootOf = await loadRootOf();
  if (rootOf(parent.projectId) !== rootOf(projectId)) {
    throw fieldError('parentId', projectId ? 'La tâche parente doit appartenir au même projet ou à l’un de ses sous-projets.' : 'La tâche parente doit aussi être sans projet.');
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
    throw clientError('BAD_USER_INPUT', 'Les deux tâches doivent appartenir au même projet ou à ses sous-projets (ou être toutes deux sans projet).');
  }
}

/**
 * Checks that a milestone can be used by a task of a project: it belongs to the same project tree.
 * @param {string} milestoneId Milestone.
 * @param {string} projectId Project of the task.
 * @returns {Promise<void>}
 */
async function assertMilestone(milestoneId: string, projectId: string | null): Promise<void> {
  if (!projectId) throw fieldError('milestoneId', 'Une tâche sans projet n’a pas de jalon.');
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } });
  if (!milestone) throw fieldError('milestoneId', 'Jalon introuvable.');
  const rootOf = await loadRootOf();
  if (rootOf(milestone.projectId) !== rootOf(projectId)) {
    throw fieldError('milestoneId', 'Le jalon doit appartenir au projet de la tâche ou à son arborescence.');
  }
}

/**
 * Checks that sprints can be used by a task of a project: they belong to the same project tree.
 * @param {string[]} sprintIds Sprints.
 * @param {string} projectId Project of the task.
 * @returns {Promise<void>}
 */
async function assertSprints(sprintIds: string[], projectId: string | null): Promise<void> {
  if (sprintIds.length === 0) return;
  if (!projectId) throw fieldError('sprintIds', 'Une tâche sans projet n’est dans aucun sprint.');
  const sprints = await prisma.sprint.findMany({ where: { id: { in: sprintIds } }, select: { projectId: true } });
  if (sprints.length !== new Set(sprintIds).size) throw fieldError('sprintIds', 'Sprint introuvable.');
  const rootOf = await loadRootOf();
  if (sprints.some((sprint) => rootOf(sprint.projectId) !== rootOf(projectId))) {
    throw fieldError('sprintIds', 'Les sprints doivent appartenir au projet de la tâche ou à son arborescence.');
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
  tagIds?: string[] | null;
  beneficiaryIds?: string[] | null;
  beneficiaryRelationIds?: string[] | null;
}): Promise<void> {
  if (refs.beneficiaryIds?.length && (await prisma.contributor.count({ where: { id: { in: refs.beneficiaryIds } } })) !== new Set(refs.beneficiaryIds).size) throw notFound('Bénéficiaire');
  if (refs.beneficiaryRelationIds?.length && (await prisma.treasuryRelation.count({ where: { id: { in: refs.beneficiaryRelationIds } } })) !== new Set(refs.beneficiaryRelationIds).size) throw notFound('Bénéficiaire');
  if (refs.statusId && !(await prisma.taskStatus.findUnique({ where: { id: refs.statusId } }))) throw notFound('Statut');
  if (refs.priorityId && !(await prisma.taskPriority.findUnique({ where: { id: refs.priorityId } }))) {
    throw notFound('Priorité');
  }
  if (refs.typeId && !(await prisma.taskType.findUnique({ where: { id: refs.typeId } }))) throw notFound('Type');
  if (refs.assigneeIds?.length) {
    const count = await prisma.contributor.count({ where: { id: { in: refs.assigneeIds } } });
    if (count !== new Set(refs.assigneeIds).size) throw notFound('Contributeur');
  }
  if (refs.tagIds?.length) {
    const count = await prisma.taskTag.count({ where: { id: { in: refs.tagIds } } });
    if (count !== new Set(refs.tagIds).size) throw notFound('Étiquette');
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
  tagIds?: string[] | null;
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  parentId?: string | null;
  milestoneId?: string | null;
  sprintIds?: string[] | null;
  /** « Bénéficiaires »: contributors and relations the task is for. */
  beneficiaryIds?: string[] | null;
  beneficiaryRelationIds?: string[] | null;
  /** Slots the task is done on or out of; null: the default of the workspace. */
  slotRule?: unknown;
}

const detailsSchema = z.object({
  title: taskTitleSchema.optional(),
  description: markdownSchema.optional(),
  effort: effortSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  slotRule: slotRuleSchema.nullable().optional(),
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
    deadline: input.deadline,
    slotRule: input.slotRule as z.input<typeof slotRuleSchema> | null | undefined,
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
    deadline: toDate(details.deadline),
    slotRule: details.slotRule === undefined ? undefined : (details.slotRule ?? Prisma.DbNull),
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
 * @param {TaskInput & { title: string }} input Task input (no project: a task of none, without number).
 * @returns {Promise<Task>} Created task.
 */
export async function createTask(input: TaskInput & { title: string }): Promise<Task> {
  if (!input.title?.trim()) throw fieldError('title', 'Le titre est requis.');
  const details = parseDetails(input);
  const projectId = input.projectId ?? null;
  if (projectId) await assertProject(projectId);
  await assertReferences(input);
  if (input.parentId) await assertParent(input.parentId, projectId, null);
  if (input.milestoneId) await assertMilestone(input.milestoneId, projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, projectId);

  const task = await prisma.task.create({
    data: {
      ...details,
      title: details.title!,
      projectId,
      statusId: input.statusId ?? null,
      priorityId: input.priorityId ?? null,
      typeId: input.typeId ?? null,
      parentId: input.parentId ?? null,
      milestoneId: input.milestoneId ?? null,
      position: await nextPosition(),
      sprints: { connect: (input.sprintIds ?? []).map((id) => ({ id })) },
      assignees: { connect: (input.assigneeIds ?? []).map((id) => ({ id })) },
      beneficiaries: { connect: [...new Set(input.beneficiaryIds ?? [])].map((id) => ({ id })) },
      beneficiaryRelations: { connect: [...new Set(input.beneficiaryRelationIds ?? [])].map((id) => ({ id })) },
      tags: { connect: (input.tagIds ?? []).map((id) => ({ id })) },
    },
  });
  if (projectId) await attachAssignees([{ projectId, contributorIds: input.assigneeIds ?? [] }]);
  return task;
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
  if (input.milestoneId) await assertMilestone(input.milestoneId, task.projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, task.projectId);
  const previous = input.assigneeIds
    ? (await prisma.contributor.findMany({ where: { tasks: { some: { id } } }, select: { id: true } })).map((item) => item.id)
    : [];

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...details,
      statusId: input.statusId,
      priorityId: input.priorityId,
      typeId: input.typeId,
      parentId: input.parentId,
      milestoneId: input.milestoneId,
      ...(input.sprintIds && { sprints: { set: input.sprintIds.map((sprintId) => ({ id: sprintId })) } }),
      ...(input.assigneeIds && { assignees: { set: input.assigneeIds.map((assigneeId) => ({ id: assigneeId })) } }),
      ...(input.beneficiaryIds && { beneficiaries: { set: [...new Set(input.beneficiaryIds)].map((beneficiaryId) => ({ id: beneficiaryId })) } }),
      ...(input.beneficiaryRelationIds && { beneficiaryRelations: { set: [...new Set(input.beneficiaryRelationIds)].map((relationId) => ({ id: relationId })) } }),
      ...(input.tagIds && { tags: { set: input.tagIds.map((tagId) => ({ id: tagId })) } }),
    },
  });
  // Only new assignees: a contributor detached from the project on purpose stays detached.
  if (input.assigneeIds) {
    const added = input.assigneeIds.filter((assigneeId) => !previous.includes(assigneeId));
    if (task.projectId) await attachAssignees([{ projectId: task.projectId, contributorIds: added }]);
  }
  return updated;
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
    await forgetGithubItems([id, ...descendants]);
    await forgetDeletedOccurrences([id, ...descendants]);
    await prisma.task.deleteMany({ where: { id: { in: [id, ...descendants] } } });
    return;
  }
  await forgetGithubItems([id]);
  await forgetDeletedOccurrences([id]);
  await prisma.$transaction([
    prisma.task.updateMany({ where: { parentId: id }, data: { parentId: task.parentId } }),
    prisma.task.delete({ where: { id } }),
  ]);
}

/**
 * Transfers a task and its sub-tasks to another project, where they take the next numbers (given by the database), or
 * out of any project (they lose their numbers, milestones, sprints and GitHub items). Links leaving the new tree are
 * removed.
 * @param {string} id Task id.
 * @param {string | null} projectId Target project; null: none.
 * @returns {Promise<{ task: Task, removedLinks: number }>} Moved task and number of removed links.
 */
export async function transferTask(id: string, projectId: string | null): Promise<{ task: Task; removedLinks: number }> {
  const task = await findTask(id);
  if (projectId) await assertProject(projectId);
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
  // Milestones of another tree cannot follow the moved tasks.
  const movedTasks = await prisma.task.findMany({
    where: { id: { in: moved }, milestoneId: { not: null } },
    select: { id: true, milestone: { select: { projectId: true } } },
  });
  const losingMilestone = movedTasks
    .filter((item) => item.milestone && rootOf(item.milestone.projectId) !== targetRoot)
    .map((item) => item.id);
  // Same for sprints: each task leaves those of another tree.
  const sprintTasks = await prisma.task.findMany({
    where: { id: { in: moved }, sprints: { some: {} } },
    select: { id: true, sprints: { select: { id: true, projectId: true } } },
  });
  const losingSprints = sprintTasks
    .map((item) => ({ id: item.id, sprints: item.sprints.filter((sprint) => rootOf(sprint.projectId) !== targetRoot).map((sprint) => ({ id: sprint.id })) }))
    .filter((item) => item.sprints.length > 0);

  // Out of any project: their GitHub items go (the link is through the project).
  if (!projectId) await forgetGithubItems(moved);
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
    prisma.task.updateMany({ where: { id: { in: moved } }, data: projectId ? { projectId } : { projectId: null, githubItemId: null } }),
    prisma.task.update({ where: { id }, data: parentOutside ? { parentId: null } : {} }),
    prisma.task.updateMany({ where: { id: { in: losingMilestone } }, data: { milestoneId: null } }),
    ...losingSprints.map((item) => prisma.task.update({ where: { id: item.id }, data: { sprints: { disconnect: item.sprints } } })),
  ]);
  const removedLinks = results[0].count + results[1].count + (parentOutside ? 1 : 0) + losingMilestone.length + losingSprints.length;
  // The assignees follow their tasks into the target project.
  const assignees = await prisma.contributor.findMany({ where: { tasks: { some: { id: { in: moved } } } }, select: { id: true } });
  if (projectId) await attachAssignees([{ projectId, contributorIds: assignees.map((assignee) => assignee.id) }]);
  return { task: results[3], removedLinks };
}

/**
 * Clones a task (every field, assignees and links, but not comments), optionally with its sub-tasks.
 * @param {string} id Task id.
 * @param {boolean} includeSubtasks Whether to clone the sub-tree too.
 * @returns {Promise<Task>} Clone of the task.
 */
export async function cloneTask(id: string, includeSubtasks: boolean): Promise<Task> {
  const include = { assignees: { select: { id: true } }, beneficiaries: { select: { id: true } }, beneficiaryRelations: { select: { id: true } }, tags: { select: { id: true } }, sprints: { select: { id: true } }, blocking: true, blockedBy: true, relationsA: true, relationsB: true };
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
      task: Prisma.TaskGetPayload<{ include: { assignees: { select: { id: true } }; beneficiaries: { select: { id: true } }; beneficiaryRelations: { select: { id: true } }; tags: { select: { id: true } }; sprints: { select: { id: true } } } }>,
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
          deadline: task.deadline,
          parentId,
          milestoneId: task.milestoneId,
          sprints: { connect: task.sprints },
          position: position++,
          assignees: { connect: task.assignees },
          beneficiaries: { connect: task.beneficiaries },
          beneficiaryRelations: { connect: task.beneficiaryRelations },
          tags: { connect: task.tags },
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
          include: { assignees: { select: { id: true } }, beneficiaries: { select: { id: true } }, beneficiaryRelations: { select: { id: true } }, tags: { select: { id: true } }, sprints: { select: { id: true } } },
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
  await forgetGithubComment(id);
  const { count } = await prisma.taskComment.deleteMany({ where: { id } });
  if (count === 0) throw notFound('Commentaire');
}

/**
 * Moves a task in the global manual order, just before another task (or at the end), and optionally
 * under another parent. Placing relative to a neighbour works the same in a filtered view.
 * @param {string} id Task id.
 * @param {string | null} beforeId Task to place it before, or null for the end.
 * @param {string | null} [parentId] New parent, null for a top-level task; undefined keeps the parent. Optional.
 * @returns {Promise<void>}
 */
export async function moveTask(id: string, beforeId: string | null, parentId?: string | null): Promise<void> {
  const task = await findTask(id);
  if (parentId) await assertParent(parentId, task.projectId, id);
  const reparent = parentId !== undefined && parentId !== task.parentId ? [prisma.task.update({ where: { id }, data: { parentId } })] : [];
  if (beforeId === id) {
    await prisma.$transaction(reparent);
    return;
  }
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
  await prisma.$transaction([
    ...reparent,
    ...order
      .map((taskId, position) => ({ taskId, position }))
      .filter(({ taskId, position }) => current.get(taskId) !== position)
      .map(({ taskId, position }) => prisma.task.update({ where: { id: taskId }, data: { position } })),
  ]);
}

/**
 * Closes (done) or reopens tasks. A closed task no longer blocks the tasks it blocks.
 * @param {string[]} ids Task ids.
 * @param {boolean} closed Target state.
 * @returns {Promise<void>}
 */
export async function setTasksClosed(ids: string[], closed: boolean): Promise<void> {
  await assertTasks(ids);
  await prisma.task.updateMany({
    // Already closed tasks keep their closing date.
    where: { id: { in: ids }, closedAt: closed ? null : { not: null } },
    data: { closedAt: closed ? new Date() : null },
  });
}

export interface BulkTaskChanges {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  milestoneId?: string | null;
  addSprintIds?: string[] | null;
  removeSprintIds?: string[] | null;
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  addAssigneeIds?: string[] | null;
  removeAssigneeIds?: string[] | null;
  addTagIds?: string[] | null;
  removeTagIds?: string[] | null;
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
    tagIds: [...(changes.addTagIds ?? []), ...(changes.removeTagIds ?? [])],
  });
  const add = (changes.addAssigneeIds ?? []).map((assigneeId) => ({ id: assigneeId }));
  const remove = (changes.removeAssigneeIds ?? []).map((assigneeId) => ({ id: assigneeId }));
  const addTags = (changes.addTagIds ?? []).map((tagId) => ({ id: tagId }));
  const removeTags = (changes.removeTagIds ?? []).map((tagId) => ({ id: tagId }));
  const addSprints = (changes.addSprintIds ?? []).map((sprintId) => ({ id: sprintId }));
  const removeSprints = (changes.removeSprintIds ?? []).map((sprintId) => ({ id: sprintId }));
  const details = parseInput(detailsSchema.pick({ effort: true, startDate: true, endDate: true, deadline: true }), {
    effort: changes.effort,
    startDate: changes.startDate,
    endDate: changes.endDate,
    deadline: changes.deadline,
  });

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true, startDate: true, endDate: true },
  });
  for (const task of tasks) {
    if (changes.milestoneId) await assertMilestone(changes.milestoneId, task.projectId);
    if (changes.addSprintIds?.length) await assertSprints(changes.addSprintIds, task.projectId);
    // The date range must stay valid for every task.
    const start = details.startDate === undefined ? task.startDate : toDate(details.startDate);
    const end = details.endDate === undefined ? task.endDate : toDate(details.endDate);
    if (start && end && end < start) throw fieldError('endDate', 'La date de fin doit suivre la date de début.');
  }

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: ids } },
      data: {
        statusId: changes.statusId,
        priorityId: changes.priorityId,
        typeId: changes.typeId,
        milestoneId: changes.milestoneId,
        effort: details.effort,
        startDate: toDate(details.startDate),
        endDate: toDate(details.endDate),
        deadline: toDate(details.deadline),
      },
    }),
    ...(add.length || remove.length || addTags.length || removeTags.length || addSprints.length || removeSprints.length
      ? ids.map((taskId) =>
          prisma.task.update({
            where: { id: taskId },
            data: {
              ...((add.length || remove.length) && { assignees: { ...(add.length && { connect: add }), ...(remove.length && { disconnect: remove }) } }),
              ...((addTags.length || removeTags.length) && { tags: { ...(addTags.length && { connect: addTags }), ...(removeTags.length && { disconnect: removeTags }) } }),
              ...((addSprints.length || removeSprints.length) && {
                sprints: { ...(addSprints.length && { connect: addSprints }), ...(removeSprints.length && { disconnect: removeSprints }) },
              }),
            },
          }),
        )
      : []),
  ]);
  await attachAssignees(tasks.flatMap((task) => (task.projectId ? [{ projectId: task.projectId, contributorIds: changes.addAssigneeIds ?? [] }] : [])));
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
 * Transfers several tasks (with their sub-tasks) to another project, or out of any.
 * @param {string[]} ids Task ids.
 * @param {string | null} projectId Target project; null: none.
 * @returns {Promise<number>} Number of links removed because they left the project tree.
 */
export async function bulkTransferTasks(ids: string[], projectId: string | null): Promise<number> {
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
  if (!deleteSubtasks) {
    await forgetGithubItems(ids);
    await forgetDeletedOccurrences(ids);
    await prisma.task.deleteMany({ where: { id: { in: ids } } });
  }
}
