import { changedList, copyName, sumOf, marksInherited, dateSchema, TASK_INHERITABLE_FIELDS, type EffectiveTask, type TaskInheritableField, deadTimesSchema, readDeadTimes, storedDeadTimes, effortSchema, groupBy, itemLinksSchema, normalizedReminders, readReminders, taskRemindersSchema, locationPointFields, markdownSchema, optionalText, parseOptionalDay, reaches, readSlotCondition, slotConditionSchema, readTaskHours, taskHoursSchema, type TaskCloseReason, type TaskInput as SharedTaskInput, taskFieldsGiven, taskLabelSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { assertBeneficiaries } from '../core/beneficiaries';
import { BY_POSITION, moveBefore, nextPositionIn } from '../core/ordering';
import { Prisma, type Task, type TaskComment } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { assertProjectContributors, attachAssignees } from '../projects/contributors';
import { forgetGithubComment, forgetGithubItems } from '../github/links';
import { releaseSubjectTime } from './time-entries';
import { assertAllExist, assertExists, deleteOrNotFound } from '../core/lookup';
import { assertNoneArchived, type ArchivableModel, assertActive, refuseArchived, archiveTree, findActive } from '../core/archive';
import { deleteTreeItems, subtreeIds, topmostIds } from '../core/trees';
import { assertDateRange } from '../core/date-range';
import { connectIds, orderedPair } from '../core/relations';
import { inProjectTree, loadProjectRootOf as loadRootOf, outsideMovedTree } from '../projects/project-tree';
import { checkLinkedDocuments, outOfTree } from '../projects/linked-documents';
import { commentBody } from '../core/comments';
import { toJson } from '../core/json';
import { readLinks } from '../core/links';
import { storedLocation } from '../core/geo';
import { assertConditionSchedules } from '../calendar/slot-conditions';
import { adoptedTaskFields, changedTaskInheritance, clearedTaskData, effectiveTasks, freezeTaskInheritance, frozenTaskWrites, tasksOffParentProject } from './task-inheritance';
import { undoOnFailure } from '../core/undo';
import { automated, registerTaskAutomationWrites } from './task-automation-engine';

/**
 * Checks that a project exists and is active.
 * @param {string} projectId Project id.
 * @returns {Promise<void>}
 */
async function assertProject(projectId: string): Promise<void> {
  await assertActive(prisma.project, projectId, 'Projet', { field: 'projectId', missingField: 'projectId' });
}

/**
 * Checks that a task can become the parent of another one (same tree, no cycle).
 * @param {string} parentId Parent candidate.
 * @param {string | null} projectId Project of the child (none: the parent has none either).
 * @param {string | null} childId Child task, or null for a new task.
 * @returns {Promise<void>}
 */
export async function assertParent(parentId: string, projectId: string | null, childId: string | null): Promise<void> {
  const parent = await orNotFound(prisma.task.findUnique({ where: { id: parentId }, select: { projectId: true, archivedAt: true } }), 'Tâche parente', 'parentId');
  refuseArchived(parent, 'parentId');
  const rootOf = await loadRootOf();
  if (rootOf(parent.projectId) !== rootOf(projectId)) {
    throw fieldError('parentId', projectId ? 'La tâche parente doit appartenir au même projet ou à l’un de ses sous-projets.' : 'La tâche parente doit aussi être sans projet.');
  }
  if (childId && (parentId === childId || (await subtreeIds('task', childId, false)).includes(parentId))) {
    throw fieldError('parentId', 'Une tâche ne peut pas être placée sous l’une de ses sous-tâches.');
  }
}

/**
 * Checks that two tasks can be linked: both active, in the same project tree.
 * @param {string} taskId First task.
 * @param {string} otherId Second task.
 * @returns {Promise<void>}
 */
async function assertSameTree(taskId: string, otherId: string): Promise<void> {
  if (taskId === otherId) throw clientError('BAD_USER_INPUT', 'Une tâche ne peut pas être liée à elle-même.');
  const tasks = await prisma.task.findMany({ where: { id: { in: [taskId, otherId] } }, select: { projectId: true, archivedAt: true } });
  if (tasks.length !== 2) throw notFound('Tâche');
  tasks.forEach((task) => refuseArchived(task));
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
  const milestone = await orNotFound(prisma.milestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } }), 'Jalon', 'milestoneId');
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
  if (sprints.length !== new Set(sprintIds).size) throw notFound('Sprint', 'sprintIds');
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
  // Archived beneficiaries are refused with the other values (ACTIVE_REFS).
  await assertBeneficiaries({ contributorIds: refs.beneficiaryIds, relationIds: refs.beneficiaryRelationIds }, { keep: 'all' });
  await assertExists(prisma.taskStatus, refs.statusId, 'Statut');
  await assertExists(prisma.taskPriority, refs.priorityId, 'Priorité');
  await assertExists(prisma.taskType, refs.typeId, 'Type');
  await assertAllExist(prisma.contributor, refs.assigneeIds, 'Assigné', { field: 'assigneeIds' });
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
  beneficiaryRelationIds?: readonly string[] | null;
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
  beneficiaryRelationIds: ['treasuryRelation', 'beneficiaryIds'],
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

/**
 * Fields of a task sent to create or change it, its slot condition as GraphQL gives it (JSON, checked by the schema),
 * and its inheritance (shared `TaskInput`): `inheritedFields` (creation: the fields it inherits; omitted,
 * with a parent: every field the input leaves out), `inherit` / `clear` (update: fields made inherited, fields emptied
 * on purpose; a field given a value becomes its own).
 */
export type TaskInput = Omit<SharedTaskInput, 'slotCondition' | 'hours'> & {
  slotCondition?: unknown;
  hours?: unknown;
};

const detailsSchema = z.object({
  label: taskLabelSchema.optional(),
  description: markdownSchema.optional(),
  effort: effortSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  minDate: dateSchema.optional(),
  slotCondition: slotConditionSchema.nullable().optional(),
  hours: taskHoursSchema.nullable().optional(),
  location: optionalText().optional(),
  ...locationPointFields,
  links: itemLinksSchema.nullable().optional(),
  reminders: taskRemindersSchema.nullable().optional(),
  deadTimes: deadTimesSchema.nullable().optional(),
});

/** Days of a task checked against the days sent. */
interface TaskDays {
  startDate: Date | null;
  endDate: Date | null;
  minDate: Date | null;
  deadline: Date | null;
}

/**
 * Checks the order of the « Ouverture » and the « Échéance » of a task on its own days once changed (the days sent
 * merged with those it has): the « Échéance » does not come before the « Ouverture » (« deadline » error). A day it
 * inherits or emptied on purpose is not compared (the days it goes by may come from its parent, milestone, project or
 * sprint).
 * @param {{ minDate?: string | null, deadline?: string | null }} changes Days sent (YYYY-MM-DD; null clears, undefined keeps).
 * @param {TaskDays} [current] Days it has. Optional. Default = a new task.
 * @param {readonly string[]} [notOwn] Fields it inherits or that are emptied (« MIN_DATE », « DEADLINE »). Optional. Default = none.
 * @returns {void}
 */
function assertOwnDays(changes: { minDate?: string | null; deadline?: string | null }, current?: TaskDays, notOwn: readonly string[] = []): void {
  const off = new Set(notOwn);
  assertDateRange(
    { startDate: off.has('MIN_DATE') ? null : changes.minDate, endDate: off.has('DEADLINE') ? null : changes.deadline },
    current && { startDate: current.minDate, endDate: current.deadline },
    'deadline',
  );
}

/**
 * Validates the scalar fields of a task (undefined: unchanged, null: cleared).
 * @param {TaskInput} input Raw input.
 * @param {{ startDate: Date | null, endDate: Date | null }} [current] Current dates on update. Optional.
 * @returns {object} Prisma data.
 */
function parseDetails(input: TaskInput, current?: TaskDays, notOwn: readonly string[] = []) {
  const details = parseInput(detailsSchema, {
    label: input.label ?? undefined,
    description: input.description,
    effort: input.effort,
    startDate: input.startDate,
    endDate: input.endDate,
    deadline: input.deadline,
    minDate: input.minDate,
    slotCondition: input.slotCondition as z.input<typeof slotConditionSchema> | null | undefined,
    hours: input.hours as z.input<typeof taskHoursSchema> | null | undefined,
    location: input.location,
    locationLat: input.locationLat ?? null,
    locationLon: input.locationLon ?? null,
    links: input.links,
    reminders: input.reminders,
    deadTimes: input.deadTimes,
  });
  assertDateRange(details, current);
  assertOwnDays(details, current, [...notOwn, ...(input.clear ?? [])]);
  return {
    label: details.label,
    description: details.description,
    effort: details.effort,
    startDate: parseOptionalDay(details.startDate),
    endDate: parseOptionalDay(details.endDate),
    deadline: parseOptionalDay(details.deadline),
    minDate: parseOptionalDay(details.minDate),
    // An empty group is no condition (any time).
    slotCondition: details.slotCondition === undefined ? undefined : details.slotCondition?.children.length ? toJson(details.slotCondition) : Prisma.DbNull,
    // None (null): any time; each case whose rhythm counts from a day has that day (`taskHoursSchema`).
    hours: details.hours === undefined ? undefined : toJson(details.hours ?? []),
    // A location changed replaces its point too (none: unknown).
    ...(details.location !== undefined && storedLocation({ location: details.location, locationLat: details.locationLat, locationLon: details.locationLon })),
    links: details.links === undefined ? undefined : toJson(details.links ?? []),
    reminders: details.reminders === undefined ? undefined : toJson(normalizedReminders(details.reminders ?? [])),
    deadTimes: details.deadTimes === undefined ? undefined : toJson(storedDeadTimes(details.deadTimes ?? [])),
  };
}

/**
 * Input of a task without the values of the fields it inherits (they are its parent's; its project is set apart).
 * @param {readonly TaskInheritableField[]} fields Fields inherited.
 * @returns {Partial<TaskInput>} Values left out.
 */
function inheritedInput(fields: readonly TaskInheritableField[]): Partial<TaskInput> {
  const has = (field: TaskInheritableField) => fields.includes(field);
  return {
    ...(has('ASSIGNEES') && { assigneeIds: undefined }),
    ...(has('BENEFICIARIES') && { beneficiaryIds: undefined, beneficiaryRelationIds: undefined }),
    ...(has('SLOT_CONDITION') && { slotCondition: undefined }),
    ...(has('HOURS') && { hours: undefined }),
    ...(has('MIN_DATE') && { minDate: undefined }),
    ...(has('DEADLINE') && { deadline: undefined }),
    ...(has('LOCATION') && { location: undefined, locationLat: undefined, locationLon: undefined }),
    ...(has('PRIORITY') && { priorityId: undefined }),
    ...(has('MILESTONE') && { milestoneId: undefined }),
  };
}

/**
 * Moves the tasks given that inherit their project into their parent's (a project inherited is stored too), each with
 * its sub-tasks.
 * @param {readonly string[]} ids Tasks.
 * @returns {Promise<void>}
 */
export async function followParentProjects(ids: readonly string[]): Promise<void> {
  for (const task of await tasksOffParentProject(ids)) await moveTaskTrees([task.id], task.projectId);
}

/**
 * Creates a task at the end of the list.
 * @param {TaskInput & { label: string }} given Task input (no project: a task of none, without number; under a parent, `inheritedFields` omitted: it inherits every field left out).
 * @returns {Promise<Task>} Created task.
 */
export const createTask = automated(async function createTask(given: TaskInput & { label: string }): Promise<Task> {
  if (!given.label?.trim()) throw fieldError('label', 'Le libellé est requis.');
  // Under a parent: the fields it inherits, their values not taken; its project, that of its parent.
  const own = taskFieldsGiven(given);
  const listed = given.inheritedFields ? new Set<string>(given.inheritedFields) : null;
  const inheritedFields = given.parentId ? TASK_INHERITABLE_FIELDS.filter((field) => (listed ? listed.has(field) : !own.includes(field))) : [];
  const inherits = (field: TaskInheritableField) => inheritedFields.includes(field);
  const input = { ...given, ...inheritedInput(inheritedFields) };
  const details = parseDetails(input, undefined, inheritedFields);
  await assertConditionSchedules([readSlotCondition(input.slotCondition)], []);
  const parentProject = input.parentId && inherits('PROJECT') ? (await orNotFound(prisma.task.findUnique({ where: { id: input.parentId }, select: { projectId: true } }), 'Tâche parente', 'parentId')).projectId : null;
  const projectId = inherits('PROJECT') ? parentProject : (input.projectId ?? null);
  if (projectId && !inherits('PROJECT')) await assertProject(projectId);
  await assertReferences(input);
  await assertActiveRefs(input);
  if (input.parentId) await assertParent(input.parentId, projectId, null);
  if (input.milestoneId) await assertMilestone(input.milestoneId, projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, projectId);
  await assertProjectContributors(projectId, input.assigneeIds ?? [], [], 'assigneeIds');
  const projectResourceIds = await checkLinkedDocuments(input, { projectId });

  const task = await prisma.task.create({
    data: {
      ...details,
      label: details.label!,
      projectId,
      inheritedFields,
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
      libraryDocuments: { connect: connectIds(input.libraryDocumentIds ?? []) },
      projectResources: { connect: connectIds(projectResourceIds ?? []) },
    },
  });
  return task;
});

/**
 * Updates a task (not an archived one: restore it first). The project is changed with `bulkTransferTasks`.
 * @param {string} id Task id.
 * @param {TaskInput} input Changes; undefined leaves a field unchanged, null clears it.
 * @param {boolean} [restoring] Undo giving back values the task had: archived ones accepted (only that check is skipped). Optional. Default = false.
 * @returns {Promise<Task>} Updated task.
 */
export const updateTask = automated(async function updateTask(id: string, input: TaskInput, restoring: boolean = false): Promise<Task> {
  const found = await findActive(prisma.task, id, 'Tâche');
  // Made top-level: what it inherited becomes its own (checked as such), put back if the change is refused.
  if (input.parentId === null && found.parentId) {
    const thaw = await freezeTaskInheritance([id]);
    return undoOnFailure(async () => savedTask(await prisma.task.findUniqueOrThrow({ where: { id } }), input, restoring), thaw);
  }
  return savedTask(found, input, restoring);
});

/**
 * Checks and saves the changes of a task (`updateTask`).
 * @param {Task} task Task as it is (made top-level: its inheritance already made its own).
 * @param {TaskInput} input Changes; undefined leaves a field unchanged, null clears it.
 * @param {boolean} restoring Undo: archived values given back accepted.
 * @returns {Promise<Task>} Updated task.
 */
async function savedTask(task: Task, input: TaskInput, restoring: boolean): Promise<Task> {
  const { id } = task;
  const parentId = input.parentId === undefined ? task.parentId : input.parentId;
  // Placed under a parent after the fact: its empty fields inherit, as at its creation.
  const adopted = parentId && !task.parentId ? await adoptedTaskFields(id, input) : [];
  const inheritedFields = changedTaskInheritance(task.inheritedFields, { inherit: [...(input.inherit ?? []), ...adopted.filter((field) => !input.clear?.includes(field))], clear: input.clear, input, hasParent: parentId !== null });
  const details = parseDetails(input, task, inheritedFields);
  // Archived schedules: no longer chosen, those already in its condition stay.
  if (input.slotCondition !== undefined) await assertConditionSchedules([readSlotCondition(input.slotCondition)], [readSlotCondition(task.slotCondition)]);
  await assertReferences(input);
  const links = await prisma.task.findUnique({
    where: { id },
    select: { ...TASK_PEOPLE_LINKS, projectResources: { select: { id: true } } },
  });
  const idsOf = (items: { id: string }[] | undefined) => (items ?? []).map((item) => item.id);
  await assertActiveRefs(input, {
    ...task,
    sprintIds: idsOf(links?.sprints),
    assigneeIds: idsOf(links?.assignees),
    beneficiaryIds: idsOf(links?.beneficiaries),
    beneficiaryRelationIds: idsOf(links?.beneficiaryRelations),
    tagIds: idsOf(links?.tags),
  }, restoring);
  if (input.parentId) await assertParent(input.parentId, task.projectId, id);
  if (input.milestoneId) await assertMilestone(input.milestoneId, task.projectId);
  if (input.sprintIds) await assertSprints(input.sprintIds, task.projectId);
  const previous = input.assigneeIds ? (await prisma.contributor.findMany({ where: { tasks: { some: { id } } }, select: { id: true } })).map((item) => item.id) : [];
  if (input.assigneeIds) await assertProjectContributors(task.projectId, input.assigneeIds, previous, 'assigneeIds', restoring);
  // Its project changes only by a transfer (`moveTaskTrees`): those it has out of its tree stay until then.
  const projectResourceIds = await checkLinkedDocuments(input, { projectId: task.projectId, previous: idsOf(links?.projectResources) });

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
      ...(input.libraryDocumentIds && { libraryDocuments: { set: connectIds(input.libraryDocumentIds) } }),
      ...(projectResourceIds && { projectResources: { set: connectIds(projectResourceIds) } }),
      // Emptied on purpose (« Vider »), whatever else is given.
      ...clearedTaskData(input.clear),
      inheritedFields,
    },
  });
  // Its project inherited again, or a new parent in another project of the tree: it moves to its parent's.
  if (inheritedFields.includes('PROJECT') && (await tasksOffParentProject([id])).length) {
    await followParentProjects([id]);
    return prisma.task.findUniqueOrThrow({ where: { id } });
  }
  return updated;
}

/**
 * Archives a task with its active sub-tasks, or restores it with the sub-tasks archived along (and its archived
 * ancestors, alone: their other sub-tasks archived along with them then stay archived on their own).
 * @param {string} id Task id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Task>} Updated task.
 */
export const setTaskArchived = automated(async function setTaskArchived(id: string, archived: boolean): Promise<Task> {
  return archiveTree<Task>('task', id, archived, 'Tâche');
});

/**
 * Moves tasks with their sub-tasks to a project, where they take the next numbers (given by the database), or out of
 * any project (they lose their numbers, milestones, sprints and GitHub items). Links leaving the new tree are removed:
 * blocks and relations with the tasks left behind, the parent left behind (and, without the sub-tasks, the sub-tasks
 * left behind lose their moved parent), milestones and sprints of another tree. The assignees follow into the target
 * project. No archive check: the callers make theirs.
 * @param {string[]} rootIds Tasks moved (with the sub-tasks: none under another one).
 * @param {string | null} projectId Target project; null: none.
 * @param {boolean} [withSubtasks=true] Each task moves with its whole sub-tree; false: only the tasks given. Optional. Default = true.
 * @returns {Promise<number>} Number of removed links.
 */
async function moveTaskTrees(rootIds: string[], projectId: string | null, withSubtasks = true): Promise<number> {
  if (rootIds.length === 0) return 0;
  const subtrees = withSubtasks ? (await Promise.all(rootIds.map((id) => subtreeIds('task', id, false)))).flat() : [];
  const moved = [...new Set([...rootIds, ...subtrees])];
  const rootOf = await loadRootOf();
  const targetRoot = rootOf(projectId);

  // Tasks outside the moved set that end up in another tree lose their links with it.
  const others = await prisma.task.findMany({
    where: { id: { notIn: moved } },
    select: { id: true, projectId: true },
  });
  const outside = outsideMovedTree(rootOf, others, moved, projectId);
  // A parent and its sub-task on both sides of two trees: the sub-task loses its parent (moved task whose parent stays,
  // or, without the sub-tasks, sub-task left behind by its moved parent).
  const parented = await prisma.task.findMany({ where: { OR: [{ id: { in: moved } }, { parentId: { in: moved } }], parentId: { not: null } }, select: { id: true, parentId: true } });
  const movedSet = new Set(moved);
  const parentOutside = parented
    .filter(({ id, parentId }) => parentId !== null && (movedSet.has(id) ? outside.has(parentId) : outside.has(id) && movedSet.has(parentId)))
    .map((task) => task.id);
  const outsideIds = [...outside];
  // Those losing their parent keep, as their own, what they inherited.
  await freezeTaskInheritance(parentOutside);
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
  // Same for the documents of projects: each task leaves those of another tree.
  const resourceTasks = await prisma.task.findMany({
    where: { id: { in: moved }, projectResources: { some: {} } },
    select: { id: true, projectResources: { select: { id: true, projectId: true } } },
  });
  const losingResources = resourceTasks
    .map((item) => ({ id: item.id, resources: outOfTree(rootOf, projectId, item.projectResources).map((id) => ({ id })) }))
    .filter((item) => item.resources.length > 0);

  // Out of any project: their GitHub items go (the link is through the project).
  if (!projectId) await forgetGithubItems(moved);
  const [blocks, relations] = await prisma.$transaction([
    prisma.taskBlock.deleteMany({
      where: {
        OR: [
          { blockerId: { in: moved }, blockedId: { in: outsideIds } },
          { blockedId: { in: moved }, blockerId: { in: outsideIds } },
        ],
      },
    }),
    prisma.taskRelation.deleteMany({
      where: {
        OR: [
          { taskAId: { in: moved }, taskBId: { in: outsideIds } },
          { taskBId: { in: moved }, taskAId: { in: outsideIds } },
        ],
      },
    }),
    // With the sub-tasks, a sub-task of a moved task is moved too; without them, those of another tree lose their parent.
    prisma.task.updateMany({ where: { id: { in: moved } }, data: projectId ? { projectId } : { projectId: null, githubItemId: null } }),
    prisma.task.updateMany({ where: { id: { in: parentOutside } }, data: { parentId: null } }),
    prisma.task.updateMany({ where: { id: { in: losingMilestone } }, data: { milestoneId: null } }),
    ...losingSprints.map((item) => prisma.task.update({ where: { id: item.id }, data: { sprints: { disconnect: item.sprints } } })),
    ...losingResources.map((item) => prisma.task.update({ where: { id: item.id }, data: { projectResources: { disconnect: item.resources } } })),
  ]);
  // The assignees follow their tasks into the target project.
  const assignees = await prisma.contributor.findMany({ where: { tasks: { some: { id: { in: moved } } } }, select: { id: true } });
  if (projectId) await attachAssignees([{ projectId, contributorIds: assignees.map((assignee) => assignee.id) }]);
  // A moved task whose parent stays, now in another project than it: that project is its own.
  for (const task of await tasksOffParentProject(moved)) {
    const { inheritedFields } = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: { inheritedFields: true } });
    await prisma.task.update({ where: { id: task.id }, data: { inheritedFields: inheritedFields.filter((field) => field !== 'PROJECT') } });
  }
  return blocks.count + relations.count + parentOutside.length + losingMilestone.length + losingSprints.length + sumOf(losingResources, (item) => item.resources.length);
}

/**
 * Takes the tasks of projects about to be deleted out of any project, as a transfer out of any project does
 * (`moveTaskTrees`), archived ones included. Only their tasks leave: a sub-task stored in a project that stays keeps
 * it (number, milestone, sprints) and only loses its parent, now out of its tree.
 * @param {string[]} projectIds Projects deleted (a project and its sub-projects).
 * @returns {Promise<void>}
 */
export async function releaseProjectTasks(projectIds: string[]): Promise<void> {
  const tasks = await prisma.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
  await moveTaskTrees(tasks.map((task) => task.id), null, false);
}

/** Ids of the people, tags and sprints of a task, as its writes check and copy them. */
export const TASK_PEOPLE_LINKS = {
  assignees: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  tags: { select: { id: true } },
  sprints: { select: { id: true } },
} as const;

/** People, tags and sprints a cloned task (and each cloned sub-task) keeps. */
const CLONED_LINKS = {
  ...TASK_PEOPLE_LINKS,
  savedCountdowns: { select: { id: true } },
  libraryDocuments: { select: { id: true } },
  projectResources: { select: { id: true, projectId: true } },
} as const;

/**
 * Duplicates a task not archived (every field, slot condition, assignees and links, but not comments), named « … (copie) », optionally
 * with its sub-tasks not archived (their labels kept). A former link out of its project tree (kept until it moves) is not copied.
 * @param {string} id Task id.
 * @param {boolean} includeSubtasks Whether to copy the sub-tree too.
 * @returns {Promise<Task>} Copy of the task.
 */
export const duplicateTask = automated(async function duplicateTask(id: string, includeSubtasks: boolean): Promise<Task> {
  const include = {
    ...CLONED_LINKS,
    blocking: true,
    blockedBy: true,
    relationsA: true,
    relationsB: true,
  };
  const source = await orNotFound(prisma.task.findUnique({ where: { id }, include }), 'Tâche');
  // An archived task is read only: restored first, then copied.
  refuseArchived(source);
  const linked = [...source.blocking.map((link) => link.blockedId), ...source.blockedBy.map((link) => link.blockerId), ...source.relationsA.map((link) => link.taskBId), ...source.relationsB.map((link) => link.taskAId)];
  const projectOf = new Map((await prisma.task.findMany({ where: { id: { in: linked } }, select: { id: true, projectId: true } })).map((task) => [task.id, task.projectId]));
  const rootOf = await loadRootOf();
  const inTree = inProjectTree(rootOf, source.projectId, projectOf);

  return prisma.$transaction(async (tx) => {
    let position = await nextPositionIn('task', {}, tx);

    /**
     * Copies one task under a parent.
     * @param {string} label Label of the copy.
     * @param {object} task Source task with assignees.
     * @param {string | null} parentId Parent of the copy.
     * @returns {Promise<Task>} Copy.
     */
    const copy = (
      label: string,
      task: Prisma.TaskGetPayload<{
        include: {
          assignees: { select: { id: true } };
          beneficiaries: { select: { id: true } };
          beneficiaryRelations: { select: { id: true } };
          tags: { select: { id: true } };
          sprints: { select: { id: true } };
          savedCountdowns: { select: { id: true } };
          libraryDocuments: { select: { id: true } };
          projectResources: { select: { id: true; projectId: true } };
        };
      }>,
      parentId: string | null,
    ) =>
      tx.task.create({
        data: {
          label,
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
          location: task.location,
          locationLat: task.locationLat,
          locationLon: task.locationLon,
          links: toJson(readLinks(task.links)),
          reminders: toJson(readReminders(task.reminders)),
          deadTimes: toJson(readDeadTimes(task.deadTimes)),
          slotCondition: task.slotCondition === null ? Prisma.DbNull : toJson(task.slotCondition),
          hours: toJson(readTaskHours(task.hours)),
          parentId,
          // The copy inherits what its source inherits (from the same parent, or from the copy of its parent).
          inheritedFields: task.inheritedFields,
          milestoneId: task.milestoneId,
          sprints: { connect: task.sprints },
          position: position++,
          assignees: { connect: task.assignees },
          beneficiaries: { connect: task.beneficiaries },
          beneficiaryRelations: { connect: task.beneficiaryRelations },
          tags: { connect: task.tags },
          savedCountdowns: { connect: task.savedCountdowns },
          libraryDocuments: { connect: task.libraryDocuments },
          // Those out of its project tree (kept until it moves) are not copied.
          projectResources: { connect: task.projectResources.filter((resource) => !outOfTree(rootOf, task.projectId, [resource]).length).map(({ id }) => ({ id })) },
        },
      });

    const clone = await copy(copyName(source.label), source, source.parentId);
    // Former links out of its project tree (kept until it moves) are not copied: the copy obeys the rule.
    const blocking = source.blocking.map((link) => link.blockedId).filter(inTree);
    const blockedBy = source.blockedBy.map((link) => link.blockerId).filter(inTree);
    await tx.taskBlock.createMany({
      data: [...blocking.map((blockedId) => ({ blockerId: clone.id, blockedId })), ...blockedBy.map((blockerId) => ({ blockerId, blockedId: clone.id }))],
    });
    const related = [...source.relationsA.map((link) => link.taskBId), ...source.relationsB.map((link) => link.taskAId)].filter(inTree);
    await tx.taskRelation.createMany({
      data: related.map((other) => relationPair(clone.id, other)),
    });

    if (includeSubtasks) {
      const queue: { sourceId: string; cloneId: string }[] = [{ sourceId: source.id, cloneId: clone.id }];
      while (queue.length > 0) {
        const { sourceId, cloneId } = queue.shift()!;
        // Archived sub-tasks (and theirs) are not copied.
        const children = await tx.task.findMany({
          where: { parentId: sourceId, archivedAt: null },
          orderBy: BY_POSITION,
          include: CLONED_LINKS,
        });
        for (const child of children) {
          const childClone = await copy(child.label, child, cloneId);
          queue.push({ sourceId: child.id, cloneId: childClone.id });
        }
      }
    }
    return clone;
  });
});

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
 * Removes a "blocks" link (neither task archived).
 * @param {string} blockerId Blocking task.
 * @param {string} blockedId Blocked task.
 * @returns {Promise<void>}
 */
export async function removeTaskBlock(blockerId: string, blockedId: string): Promise<void> {
  await assertNoneArchived('task', [blockerId, blockedId]);
  await prisma.taskBlock.deleteMany({ where: { blockerId, blockedId } });
}

/**
 * Orders a symmetric pair the way it is stored.
 * @param {string} a First task.
 * @param {string} b Second task.
 * @returns {{ taskAId: string, taskBId: string }} Stored pair.
 */
function relationPair(a: string, b: string) {
  const [taskAId, taskBId] = orderedPair(a, b);
  return { taskAId, taskBId };
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
 * Removes a "related to" link (neither task archived).
 * @param {string} taskId First task.
 * @param {string} otherId Second task.
 * @returns {Promise<void>}
 */
export async function removeTaskRelation(taskId: string, otherId: string): Promise<void> {
  await assertNoneArchived('task', [taskId, otherId]);
  await prisma.taskRelation.deleteMany({ where: relationPair(taskId, otherId) });
}

/**
 * Checks that a comment exists and that its task can still take changes (not archived).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
async function assertCommentTask(id: string): Promise<void> {
  const comment = await orNotFound(prisma.taskComment.findUnique({ where: { id }, select: { task: { select: { archivedAt: true } } } }), 'Commentaire');
  refuseArchived(comment.task);
}

/**
 * Adds a comment to a task (not an archived one: its comments are read only too).
 * @param {string} taskId Task id.
 * @param {string} body Markdown body.
 * @returns {Promise<TaskComment>} Comment.
 */
export async function addComment(taskId: string, body: string): Promise<TaskComment> {
  await findActive(prisma.task, taskId, 'Tâche');
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
export const moveTask = automated(async function moveTask(id: string, beforeId: string | null, parentId?: string | null): Promise<void> {
  const task = await findActive(prisma.task, id, 'Tâche');
  if (parentId) await assertParent(parentId, task.projectId, id);
  // Made top-level: what it inherited becomes its own, in the same transaction as the move.
  const frozen = parentId === null && task.parentId ? await frozenTaskWrites([id]) : [];
  // Placed under a parent after the fact: its empty fields inherit, as at its creation.
  const adopted = parentId && !task.parentId ? { inheritedFields: await adoptedTaskFields(id) } : {};
  const reparent = parentId !== undefined && parentId !== task.parentId ? [...frozen, prisma.task.update({ where: { id }, data: { parentId, ...adopted } })] : [];
  await moveBefore('task', id, beforeId, 'Tâche', reparent);
  // Under a parent of another project of the tree: one inheriting its project follows it.
  if (reparent.length) await followParentProjects([id]);
});

/**
 * Closes tasks as done or as cancelled, or reopens them (none archived, except for an undo). A closed task no longer
 * blocks the tasks it blocks. Their status is left as it is (the rules of the workspace may change it).
 * @param {string[]} ids Task ids.
 * @param {boolean} closed Target state.
 * @param {boolean} [restoring] Undo of a former change, or a rule of the archiving of the tasks: tasks archived accepted. Optional. Default = false.
 * @param {TaskCloseReason} [reason] How they are closed (done or cancelled); ignored when reopening. Optional. Default = 'COMPLETED'.
 * @returns {Promise<void>}
 */
export const setTasksClosed = automated(async function setTasksClosed(ids: string[], closed: boolean, restoring: boolean = false, reason: TaskCloseReason = 'COMPLETED'): Promise<void> {
  await assertTasks(ids);
  if (!restoring) await assertNoneArchived('task', ids);
  if (!closed) {
    await prisma.task.updateMany({ where: { id: { in: ids }, closedAt: { not: null } }, data: { closedAt: null, closeReason: null } });
    return;
  }
  // Already closed tasks keep their closing date; closed again another way, they take the new reason.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { id: { in: ids }, closedAt: null }, data: { closedAt: new Date(), closeReason: reason } }),
    prisma.task.updateMany({ where: { id: { in: ids }, closedAt: { not: null }, OR: [{ closeReason: null }, { closeReason: { not: reason } }] }, data: { closeReason: reason } }),
  ]);
});

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
  /** « Ouverture »: not to be done before. */
  minDate?: string | null;
  addAssigneeIds?: string[] | null;
  removeAssigneeIds?: string[] | null;
  addTagIds?: string[] | null;
  removeTagIds?: string[] | null;
  /** Fields made inherited again (« Rétablir l'héritage »); a sub-task only. */
  inheritFields?: TaskInheritableField[] | null;
  /** Fields emptied on purpose (« Vider »): no value, not inherited. */
  clearFields?: TaskInheritableField[] | null;
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
export const bulkUpdateTasks = automated(async function bulkUpdateTasks(ids: string[], changes: BulkTaskChanges, restoring: boolean = false): Promise<void> {
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
      minDate: true,
      deadline: true,
      statusId: true,
      priorityId: true,
      typeId: true,
      milestoneId: true,
      parentId: true,
      inheritedFields: true,
      assignees: { select: { id: true } },
      tags: { select: { id: true } },
      sprints: { select: { id: true } },
    },
  });
  // Assignees added to or removed from inherited ones: from those it goes by, now its own.
  const inheritingAssignees = tasks.filter((task) => marksInherited(task, 'ASSIGNEES') && (add.length || remove.length));
  const effective = inheritingAssignees.length ? await effectiveTasks(inheritingAssignees.map((task) => task.id)) : new Map<string, EffectiveTask>();
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
    // The date ranges must stay valid for every task (« Ouverture » / « Échéance »: on its own days).
    assertDateRange(details, task);
    const inherited = changedTaskInheritance(task.inheritedFields, { inherit: changes.inheritFields, clear: changes.clearFields, input: changes, hasParent: task.parentId !== null });
    assertOwnDays(details, task, [...inherited, ...(task.parentId !== null ? (changes.clearFields ?? []) : [])]);
  }

  const cleared = clearedTaskData(changes.clearFields);
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
              ...((add.length || remove.length) &&
                (effective.has(taskId)
                  ? { assignees: { set: connectIds(changedList(effective.get(taskId)!.assigneeIds, changes.addAssigneeIds ?? undefined, changes.removeAssigneeIds ?? undefined)) } }
                  : { assignees: { ...(add.length && { connect: add }), ...(remove.length && { disconnect: remove }) } })),
              ...((addTags.length || removeTags.length) && { tags: { ...(addTags.length && { connect: addTags }), ...(removeTags.length && { disconnect: removeTags }) } }),
              ...((addSprints.length || removeSprints.length) && {
                sprints: { ...(addSprints.length && { connect: addSprints }), ...(removeSprints.length && { disconnect: removeSprints }) },
              }),
            },
          }),
        )
      : []),
    // Their inheritance: fields inherited again, emptied, or given a value; emptied last. Tasks without parent stay
    // as they are (nothing to inherit, nothing emptied on purpose).
    ...tasks.map((task) =>
      prisma.task.update({
        where: { id: task.id },
        data: {
          ...(task.parentId !== null && cleared),
          inheritedFields: changedTaskInheritance(task.inheritedFields, { inherit: changes.inheritFields, clear: changes.clearFields, input: changes, hasParent: task.parentId !== null }),
        },
      }),
    ),
  ]);
  // Their project inherited again: each moves to its parent's.
  if (changes.inheritFields?.includes('PROJECT')) await followParentProjects(ids);
});

/**
 * Transfers several tasks (with their sub-tasks; none archived) to another project, or out of any.
 * @param {string[]} ids Task ids.
 * @param {string | null} projectId Target project; null: none.
 * @returns {Promise<number>} Number of links removed because they left the project tree.
 */
export const bulkTransferTasks = automated(async function bulkTransferTasks(ids: string[], projectId: string | null): Promise<number> {
  await assertTasks(ids);
  // Refused before any is moved.
  await assertNoneArchived('task', ids);
  if (projectId) await assertProject(projectId);
  // All at once: links between the moved tasks stay.
  return moveTaskTrees(await topmostIds('task', ids), projectId);
});

/**
 * Archives or restores several tasks (with the usual cascade).
 * @param {string[]} ids Task ids.
 * @param {boolean} archived Target state.
 * @returns {Promise<void>}
 */
export const bulkSetTasksArchived = automated(async function bulkSetTasksArchived(ids: string[], archived: boolean): Promise<void> {
  await assertTasks(ids);
  for (const id of await topmostIds('task', ids)) await setTaskArchived(id, archived);
});

/**
 * Deletes several tasks; their unselected sub-tasks are deleted too, or moved up. The times they leave with nothing
 * attached (no project, no other task, routine or event; not billed) are deleted with them.
 * @param {string[]} ids Task ids.
 * @param {boolean} deleteSubtasks Whether to delete the sub-trees.
 * @returns {Promise<void>}
 */
export const bulkDeleteTasks = automated(async function bulkDeleteTasks(ids: string[], deleteSubtasks: boolean): Promise<void> {
  await assertTasks(ids);
  // Their GitHub items are taken off the board first.
  await deleteTreeItems('task', ids, deleteSubtasks, async (gone) => {
    // Sub-tasks left by their deleted parent keep, as their own, what they inherited.
    await freezeTaskInheritance((await prisma.task.findMany({ where: { parentId: { in: gone }, id: { notIn: gone } }, select: { id: true } })).map((task) => task.id));
    await forgetGithubItems(gone);
    await releaseSubjectTime({ taskIds: gone });
  });
});

// The actions of the automations go through the same writes (same checks).
registerTaskAutomationWrites({
  bulkUpdate: (ids, changes, restoring) => bulkUpdateTasks(ids, changes, restoring),
  transfer: (ids, projectId) => bulkTransferTasks(ids, projectId),
  setClosed: (ids, closed, restoring, reason) => setTasksClosed(ids, closed, restoring, reason),
  archive: (id, archived) => setTaskArchived(id, archived),
});
