import {
  ancestorsOf,
  dateSchema,
  effortSchema,
  groupBy,
  lineageOf,
  mapById,
  markdownSchema,
  movedTo,
  parseOptionalDay,
  reaches,
  slotRuleSchema,
  type TaskInput as SharedTaskInput,
  taskLabelSchema,
} from '@ordo/shared';
import { z } from 'zod';
import { deleteTreeNode } from '../core/trees';
import { prisma } from '../../db';
import { BY_POSITION, nextPositionIn } from '../core/ordering';
import { Prisma, type Task, type TaskComment } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { assertProjectContributors, attachAssignees } from '../workspace/contributors';
import { forgetGithubComment, forgetGithubItems } from '../github/links';
import { forgetDeletedOccurrences } from './task-recurrence';
import { assertAllExist, assertExists, deleteOrNotFound } from '../core/lookup';
import { ARCHIVED_MESSAGE, assertNoneArchived, type ArchivableModel } from '../core/archive';
import { subtreeIds } from '../core/trees';
import { assertDateRange } from '../core/date-range';
import { connectIds } from '../core/relations';
import { commentBody } from '../core/comments';

/**
 * Root project of each project: tasks can only be linked inside the same tree.
 * @returns {Promise<(projectId: string) => string>} Root lookup.
 */
async function loadRootOf(): Promise<(projectId: string | null) => string | null> {
  const byId = mapById(await prisma.project.findMany({ select: { id: true, parentId: true } }));
  // The tasks without project make a tree of their own (null).
  return (projectId) => (projectId === null ? null : (lineageOf(byId, projectId).at(-1)?.id ?? projectId));
}

/**
 * Loads a task or throws NOT_FOUND.
 * @param {string} id Task id.
 * @returns {Promise<Task>} Task.
 */
async function findTask(id: string): Promise<Task> {
  const task = await orNotFound(prisma.task.findUnique({ where: { id } }), 'Tâche');
  return task;
}

/**
 * Ids of every sub-task of a task.
 * @param {string} id Task id.
 * @returns {Promise<string[]>} Descendant ids.
 */
function descendantIds(id: string): Promise<string[]> {
  return subtreeIds('task', id, false);
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
  await assertAllExist(prisma.contributor, refs.beneficiaryIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  await assertAllExist(prisma.treasuryRelation, refs.beneficiaryRelationIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  await assertExists(prisma.taskStatus, refs.statusId, 'Statut');
  await assertExists(prisma.taskPriority, refs.priorityId, 'Priorité');
  await assertExists(prisma.taskType, refs.typeId, 'Type');
  await assertAllExist(prisma.contributor, refs.assigneeIds, 'Contributeur');
  await assertAllExist(prisma.taskTag, refs.tagIds, 'Étiquette');
}

/** Values of a task that can be archived (an archived one stays on the tasks having it, but is not given anew). */
interface ActiveRefs {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  milestoneId?: string | null;
  sprintIds?: readonly string[] | null;
  assigneeIds?: readonly string[] | null;
  beneficiaryIds?: readonly string[] | null;
  tagIds?: readonly string[] | null;
}

/** Values that tasks already have (of several tasks: all of theirs). */
type CurrentRefs = { [K in keyof ActiveRefs]?: string | readonly string[] | null };

/** Model and field of the error of each value of `ActiveRefs`. */
const ACTIVE_REFS: { [K in keyof ActiveRefs]-?: [ArchivableModel, string] } = {
  statusId: ['taskStatus', 'statusId'],
  priorityId: ['taskPriority', 'priorityId'],
  typeId: ['taskType', 'typeId'],
  milestoneId: ['milestone', 'milestoneId'],
  sprintIds: ['sprint', 'sprintIds'],
  assigneeIds: ['contributor', 'assigneeIds'],
  beneficiaryIds: ['contributor', 'beneficiaryIds'],
  tagIds: ['taskTag', 'tagIds'],
};

/**
 * Refuses archived values newly given to tasks (field error « Élément archivé… »); those they already have stay
 * valid.
 * @param {ActiveRefs} refs Values given.
 * @param {CurrentRefs} [current] Values the tasks already have (several tasks: all of theirs). Optional. Default = none (a new task).
 * @param {boolean} [restoring] Undo giving back values the tasks had: archived ones accepted. Optional. Default = false.
 * @returns {Promise<void>}
 */
async function assertActiveRefs(refs: ActiveRefs, current: CurrentRefs = {}, restoring = false): Promise<void> {
  if (restoring) return;
  const ids = (value: string | readonly string[] | null | undefined): string[] => (typeof value === 'string' ? [value] : [...(value ?? [])]);
  for (const key of Object.keys(ACTIVE_REFS) as (keyof ActiveRefs)[]) {
    const [model, field] = ACTIVE_REFS[key];
    await assertNoneArchived(model, ids(refs[key]), { keep: ids(current[key]), field });
  }
}

/** Fields of a task sent to create or change it, its slot rule as GraphQL gives it (JSON, checked by the schema). */
export type TaskInput = Omit<SharedTaskInput, 'slotRule'> & { slotRule?: unknown };

const detailsSchema = z.object({
  label: taskLabelSchema.optional(),
  description: markdownSchema.optional(),
  effort: effortSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  minDate: dateSchema.optional(),
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
    label: input.label ?? undefined,
    description: input.description,
    effort: input.effort,
    startDate: input.startDate,
    endDate: input.endDate,
    deadline: input.deadline,
    minDate: input.minDate,
    slotRule: input.slotRule as z.input<typeof slotRuleSchema> | null | undefined,
  });
  assertDateRange(details, current);
  return {
    label: details.label,
    description: details.description,
    effort: details.effort,
    startDate: parseOptionalDay(details.startDate),
    endDate: parseOptionalDay(details.endDate),
    deadline: parseOptionalDay(details.deadline),
    minDate: parseOptionalDay(details.minDate),
    slotRule: details.slotRule === undefined ? undefined : (details.slotRule ?? Prisma.DbNull),
  };
}

/**
 * Creates a task at the end of the list.
 * @param {TaskInput & { label: string }} input Task input (no project: a task of none, without number).
 * @returns {Promise<Task>} Created task.
 */
export async function createTask(input: TaskInput & { label: string }): Promise<Task> {
  if (!input.label?.trim()) throw fieldError('label', 'Le libellé est requis.');
  const details = parseDetails(input);
  const projectId = input.projectId ?? null;
  if (projectId) await assertProject(projectId);
  await assertReferences(input);
  await assertActiveRefs(input);
  if (input.parentId) await assertParent(input.parentId, projectId, null);
  if (input.milestoneId) await assertMilestone(input.milestoneId, projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, projectId);
  await assertProjectContributors(projectId, input.assigneeIds ?? [], [], 'assigneeIds');

  const task = await prisma.task.create({
    data: {
      ...details,
      label: details.label!,
      projectId,
      statusId: input.statusId ?? null,
      priorityId: input.priorityId ?? null,
      typeId: input.typeId ?? null,
      parentId: input.parentId ?? null,
      milestoneId: input.milestoneId ?? null,
      position: await nextPositionIn('task'),
      sprints: { connect: connectIds(input.sprintIds ?? []) },
      assignees: { connect: connectIds(input.assigneeIds ?? []) },
      beneficiaries: { connect: connectIds(input.beneficiaryIds ?? []) },
      beneficiaryRelations: { connect: connectIds(input.beneficiaryRelationIds ?? []) },
      tags: { connect: connectIds(input.tagIds ?? []) },
    },
  });
  return task;
}

/**
 * Updates a task (not an archived one: restore it first). The project is changed with `bulkTransferTasks`.
 * @param {string} id Task id.
 * @param {TaskInput} input Changes; undefined leaves a field unchanged, null clears it.
 * @returns {Promise<Task>} Updated task.
 */
export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const task = await findTask(id);
  if (task.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  const details = parseDetails(input, task);
  await assertReferences(input);
  const links = await prisma.task.findUnique({
    where: { id },
    select: { sprints: { select: { id: true } }, assignees: { select: { id: true } }, beneficiaries: { select: { id: true } }, tags: { select: { id: true } } },
  });
  const idsOf = (items: { id: string }[] | undefined) => (items ?? []).map((item) => item.id);
  await assertActiveRefs(input, {
    ...task,
    sprintIds: idsOf(links?.sprints),
    assigneeIds: idsOf(links?.assignees),
    beneficiaryIds: idsOf(links?.beneficiaries),
    tagIds: idsOf(links?.tags),
  });
  if (input.parentId) await assertParent(input.parentId, task.projectId, id);
  if (input.milestoneId) await assertMilestone(input.milestoneId, task.projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, task.projectId);
  const previous = input.assigneeIds ? (await prisma.contributor.findMany({ where: { tasks: { some: { id } } }, select: { id: true } })).map((item) => item.id) : [];
  if (input.assigneeIds) await assertProjectContributors(task.projectId, input.assigneeIds, previous, 'assigneeIds');

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...details,
      statusId: input.statusId,
      priorityId: input.priorityId,
      typeId: input.typeId,
      parentId: input.parentId,
      milestoneId: input.milestoneId,
      ...(input.sprintIds && { sprints: { set: connectIds(input.sprintIds) } }),
      ...(input.assigneeIds && { assignees: { set: connectIds(input.assigneeIds) } }),
      ...(input.beneficiaryIds && { beneficiaries: { set: connectIds(input.beneficiaryIds) } }),
      ...(input.beneficiaryRelationIds && { beneficiaryRelations: { set: connectIds(input.beneficiaryRelationIds) } }),
      ...(input.tagIds && { tags: { set: connectIds(input.tagIds) } }),
    },
  });
  return updated;
}

/**
 * Archives a task with its active sub-tasks, or restores it with the sub-tasks archived along (and its archived
 * ancestors, alone: their other sub-tasks archived along with them then stay archived on their own).
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
  for (let parentId = task.parentId; parentId;) {
    const parent = await prisma.task.findUnique({ where: { id: parentId }, select: { id: true, parentId: true, archivedAt: true } });
    if (!parent) break;
    if (parent.archivedAt) ancestorIds.push(parent.id);
    parentId = parent.parentId;
  }
  const [, , , updated] = await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: descendants }, archivedByCascade: true },
      data: { archivedAt: null, archivedByCascade: false },
    }),
    prisma.task.updateMany({ where: { id: { in: ancestorIds } }, data: { archivedAt: null, archivedByCascade: false } }),
    // Sub-tasks archived by the cascade of a restored ancestor now stay archived on their own.
    prisma.task.updateMany({
      where: { archivedByCascade: true, id: { notIn: [id, ...descendants] }, parentId: { in: ancestorIds } },
      data: { archivedByCascade: false },
    }),
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
  await deleteTreeNode('task', task);
}

/**
 * Transfers a task (not an archived one) and its sub-tasks to another project, where they take the next numbers (given by the database), or
 * out of any project (they lose their numbers, milestones, sprints and GitHub items). Links leaving the new tree are
 * removed.
 * @param {string} id Task id.
 * @param {string | null} projectId Target project; null: none.
 * @returns {Promise<{ task: Task, removedLinks: number }>} Moved task and number of removed links.
 */
export async function transferTask(id: string, projectId: string | null): Promise<{ task: Task; removedLinks: number }> {
  const task = await findTask(id);
  if (task.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
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
  const losingMilestone = movedTasks.filter((item) => item.milestone && rootOf(item.milestone.projectId) !== targetRoot).map((item) => item.id);
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

/** People, tags and sprints a cloned task (and each cloned sub-task) keeps. */
const CLONED_LINKS = {
  assignees: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  tags: { select: { id: true } },
  sprints: { select: { id: true } },
} as const;

/**
 * Clones a task (every field, assignees and links, but not comments), optionally with its sub-tasks.
 * @param {string} id Task id.
 * @param {boolean} includeSubtasks Whether to clone the sub-tree too.
 * @returns {Promise<Task>} Clone of the task.
 */
export async function cloneTask(id: string, includeSubtasks: boolean): Promise<Task> {
  const include = {
    ...CLONED_LINKS,
    blocking: true,
    blockedBy: true,
    relationsA: true,
    relationsB: true,
  };
  const source = await orNotFound(prisma.task.findUnique({ where: { id }, include }), 'Tâche');

  return prisma.$transaction(async (tx) => {
    let position = await nextPositionIn('task', {}, tx);

    /**
     * Copies one task under a parent.
     * @param {object} task Source task with assignees.
     * @param {string | null} parentId Parent of the copy.
     * @returns {Promise<Task>} Copy.
     */
    const copy = (
      task: Prisma.TaskGetPayload<{
        include: {
          assignees: { select: { id: true } };
          beneficiaries: { select: { id: true } };
          beneficiaryRelations: { select: { id: true } };
          tags: { select: { id: true } };
          sprints: { select: { id: true } };
        };
      }>,
      parentId: string | null,
    ) =>
      tx.task.create({
        data: {
          label: task.label,
          description: task.description,
          projectId: task.projectId,
          statusId: task.statusId,
          priorityId: task.priorityId,
          typeId: task.typeId,
          effort: task.effort,
          startDate: task.startDate,
          endDate: task.endDate,
          deadline: task.deadline,
          minDate: task.minDate,
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
      data: [...source.blocking.map((link) => ({ blockerId: clone.id, blockedId: link.blockedId })), ...source.blockedBy.map((link) => ({ blockerId: link.blockerId, blockedId: clone.id }))],
    });
    const related = [...source.relationsA.map((link) => link.taskBId), ...source.relationsB.map((link) => link.taskAId)];
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
          include: CLONED_LINKS,
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
  const blocked = groupBy(await prisma.taskBlock.findMany(), (link) => link.blockerId);
  return reaches((id) => (blocked.get(id) ?? []).map((link) => link.blockedId), [from], to);
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
 * Checks that a comment exists and that its task can still take changes (not archived).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
async function assertCommentTask(id: string): Promise<void> {
  const comment = await orNotFound(prisma.taskComment.findUnique({ where: { id }, select: { task: { select: { archivedAt: true } } } }), 'Commentaire');
  if (comment.task.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
}

/**
 * Adds a comment to a task (not an archived one: its comments are read only too).
 * @param {string} taskId Task id.
 * @param {string} body Markdown body.
 * @returns {Promise<TaskComment>} Comment.
 */
export async function addComment(taskId: string, body: string): Promise<TaskComment> {
  const task = await findTask(taskId);
  if (task.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  return prisma.taskComment.create({ data: { taskId, body: commentBody(body) } });
}

/**
 * Edits a comment (not one of an archived task).
 * @param {string} id Comment id.
 * @param {string} body New markdown body.
 * @returns {Promise<TaskComment>} Comment.
 */
export async function updateComment(id: string, body: string): Promise<TaskComment> {
  await assertCommentTask(id);
  return prisma.taskComment.update({ where: { id }, data: { body: commentBody(body) } });
}

/**
 * Deletes a comment (not one of an archived task).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
export async function deleteComment(id: string): Promise<void> {
  await assertCommentTask(id);
  await forgetGithubComment(id);
  await deleteOrNotFound(prisma.taskComment, id, 'Commentaire');
}

/**
 * Moves a task (not an archived one) in the global manual order, just before another task (or at the end), and
 * optionally under another parent. Placing relative to a neighbour works the same in a filtered view.
 * @param {string} id Task id.
 * @param {string | null} beforeId Task to place it before, or null for the end.
 * @param {string | null} [parentId] New parent, null for a top-level task; undefined keeps the parent. Optional.
 * @returns {Promise<void>}
 */
export async function moveTask(id: string, beforeId: string | null, parentId?: string | null): Promise<void> {
  const task = await findTask(id);
  if (task.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  if (parentId) await assertParent(parentId, task.projectId, id);
  const reparent = parentId !== undefined && parentId !== task.parentId ? [prisma.task.update({ where: { id }, data: { parentId } })] : [];
  if (beforeId === id) {
    await prisma.$transaction(reparent);
    return;
  }
  const ordered = await prisma.task.findMany({
    orderBy: BY_POSITION,
    select: { id: true, position: true },
  });
  const others = ordered.filter((task) => task.id !== id).map((task) => task.id);
  const index = beforeId === null ? others.length : others.indexOf(beforeId);
  if (index < 0) throw notFound('Tâche');
  const order = movedTo(others, id, index);
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
 * Closes (done) or reopens tasks (none archived). A closed task no longer blocks the tasks it blocks.
 * @param {string[]} ids Task ids.
 * @param {boolean} closed Target state.
 * @returns {Promise<void>}
 */
export async function setTasksClosed(ids: string[], closed: boolean): Promise<void> {
  await assertTasks(ids);
  await assertNoneArchived('task', ids);
  await prisma.task.updateMany({
    // Already closed tasks keep their closing date.
    where: { id: { in: ids }, closedAt: closed ? null : { not: null } },
    data: { closedAt: closed ? new Date() : null },
  });
}

interface BulkTaskChanges {
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
  /** « Date min »: not to be done before. */
  minDate?: string | null;
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
  await assertAllExist(prisma.task, ids, 'Tâche');
}

/**
 * Applies the same changes to several tasks (none archived, except for an undo). Undefined fields are left unchanged,
 * null clears them.
 * @param {string[]} ids Task ids.
 * @param {BulkTaskChanges} changes Changes.
 * @param {boolean} [restoring] Undo of a former change: archived values given back, and tasks archived since, are accepted (only those checks are skipped). Optional. Default = false.
 * @returns {Promise<void>}
 */
export async function bulkUpdateTasks(ids: string[], changes: BulkTaskChanges, restoring = false): Promise<void> {
  await assertTasks(ids);
  if (!restoring) await assertNoneArchived('task', ids);
  await assertReferences({
    ...changes,
    assigneeIds: [...(changes.addAssigneeIds ?? []), ...(changes.removeAssigneeIds ?? [])],
    tagIds: [...(changes.addTagIds ?? []), ...(changes.removeTagIds ?? [])],
  });
  const add = connectIds(changes.addAssigneeIds ?? []);
  const remove = connectIds(changes.removeAssigneeIds ?? []);
  const addTags = connectIds(changes.addTagIds ?? []);
  const removeTags = connectIds(changes.removeTagIds ?? []);
  const addSprints = connectIds(changes.addSprintIds ?? []);
  const removeSprints = connectIds(changes.removeSprintIds ?? []);
  const details = parseInput(detailsSchema.pick({ effort: true, startDate: true, endDate: true, deadline: true, minDate: true }), {
    effort: changes.effort,
    startDate: changes.startDate,
    endDate: changes.endDate,
    deadline: changes.deadline,
    minDate: changes.minDate,
  });

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      projectId: true,
      startDate: true,
      endDate: true,
      statusId: true,
      priorityId: true,
      typeId: true,
      milestoneId: true,
      assignees: { select: { id: true } },
      tags: { select: { id: true } },
      sprints: { select: { id: true } },
    },
  });
  // Archived values are not given anew (those of one of the tasks stay valid: the same change on the others).
  const all = (pick: (task: (typeof tasks)[number]) => (string | null)[]): string[] => tasks.flatMap(pick).filter((id): id is string => id !== null);
  await assertActiveRefs(
    {
      statusId: changes.statusId,
      priorityId: changes.priorityId,
      typeId: changes.typeId,
      milestoneId: changes.milestoneId,
      sprintIds: changes.addSprintIds,
      assigneeIds: changes.addAssigneeIds,
      tagIds: changes.addTagIds,
    },
    {
      statusId: all((task) => [task.statusId]),
      priorityId: all((task) => [task.priorityId]),
      typeId: all((task) => [task.typeId]),
      milestoneId: all((task) => [task.milestoneId]),
      sprintIds: all((task) => task.sprints.map((sprint) => sprint.id)),
      assigneeIds: all((task) => task.assignees.map((assignee) => assignee.id)),
      tagIds: all((task) => task.tags.map((tag) => tag.id)),
    },
    restoring,
  );
  for (const task of tasks) {
    // Of a project: its contributors only (those already assigned stay).
    if (changes.addAssigneeIds?.length)
      await assertProjectContributors(
        task.projectId,
        changes.addAssigneeIds,
        task.assignees.map((assignee) => assignee.id),
        'assigneeIds',
        restoring,
      );
    if (changes.milestoneId) await assertMilestone(changes.milestoneId, task.projectId);
    if (changes.addSprintIds?.length) await assertSprints(changes.addSprintIds, task.projectId);
    // The date range must stay valid for every task.
    assertDateRange(details, task);
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
        startDate: parseOptionalDay(details.startDate),
        endDate: parseOptionalDay(details.endDate),
        deadline: parseOptionalDay(details.deadline),
        minDate: parseOptionalDay(details.minDate),
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
}

/**
 * Keeps only the topmost tasks of a selection: a selected sub-task moves or goes with its selected ancestor.
 * @param {string[]} ids Selected task ids.
 * @returns {Promise<string[]>} Ids without selected descendants.
 */
async function topmost(ids: string[]): Promise<string[]> {
  const selected = new Set(ids);
  const byId = mapById(await prisma.task.findMany({ select: { id: true, parentId: true } }));
  return ids.filter((id) => !ancestorsOf(byId, id).some((parent) => selected.has(parent.id)));
}

/**
 * Transfers several tasks (with their sub-tasks; none archived) to another project, or out of any.
 * @param {string[]} ids Task ids.
 * @param {string | null} projectId Target project; null: none.
 * @returns {Promise<number>} Number of links removed because they left the project tree.
 */
export async function bulkTransferTasks(ids: string[], projectId: string | null): Promise<number> {
  await assertTasks(ids);
  // Refused before any is moved.
  await assertNoneArchived('task', ids);
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
