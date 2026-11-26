import {
  clipText,
  dayPart,
  DEFAULT_LABEL_COLOR,
  effortSchema,
  lineageOf,
  marksInherited,
  formatOptionalDay,
  isUnmapped,
  itemParentValue,
  mapById,
  mergeFields,
  changedAfter,
  itemIterationValue,
  snapshotIterationValue,
  nameKey,
  parseOptionalDay,
  readdedItemSnapshot,
  remoteChangeDate,
  removedFromBoardComment,
  REMOVED_FROM_BOARD,
  wasReadded,
  alreadyLinkedComment,
  commentToPublish,
  round2,
  sameName,
  sumOf,
  taskFieldOrigin,
  taskParentValue,
  type EffectiveTask,
  type SyncFields,
  type TaskInheritableField,
  type TaskInheritanceContext,
  upgradedSnapshot,
  githubSendRefusal,
  githubTaskState,
  GITHUB_SEND_REFUSALS,
} from '@ordo/shared';
import { prisma } from '../../db';
import { nextPositionIn } from '../core/ordering';
import { Prisma, type GithubProjectLink, type Task, type TaskComment } from '../../generated/prisma/client';
import { clientError, errorMessage, orNotFound } from '../../graphql/errors';
import { addTaskBlock, addTaskRelation, assertParent, createTask, followParentProjects, removeTaskBlock, removeTaskRelation, setTaskArchived } from '../tasks/tasks';
import {
  addIssueComment,
  addIssueToBoard,
  boardById,
  issueGone,
  boardItems,
  createItem,
  createLabel,
  createMilestone,
  repositoryLabels,
  repositoryMilestones,
  setBlockedBy,
  setIssueLabels,
  setIssueMilestone,
  setIssueFieldValue,
  setIssueParent,
  setIssueType,
  setItemArchived,
  setItemField,
  setRelatesTo,
  updateContent,
  updateIssueComment,
  type FieldValue,
  type RemoteItem,
} from './board';
import { currentGithubConnection, githubToken, isGoneOnGithub, stopsSync } from './client';
import { syncIterations } from './iterations';
import { linksByProject } from './links';
import { schedulePerWorkspace } from '../workspaces/workspaces';
import { subtreeIds, topmostIds } from '../core/trees';
import { connectIds } from '../core/relations';
import { toJson } from '../core/json';
import { parisToday } from '../../today';
import { adoptedTaskFields, effectiveTaskOf, freezeTaskInheritance, loadTaskInheritance } from '../tasks/task-inheritance';
import { automated } from '../tasks/task-automation-engine';

interface SyncSummary {
  /** Tasks created from items, and items created from tasks. */
  pulledNew: number;
  pushedNew: number;
  /** Tasks and items updated. */
  pulled: number;
  pushed: number;
  /** Tasks whose item left the board (kept, unlinked and archived). */
  unlinked: number;
  /** Sprints created, paired or updated from the iterations. */
  sprints: number;
  /** Iterations created or updated from the sprints. */
  sprintsPushed: number;
  /** Sprints not sent: they share a day with another sprint of the tree, or would with another iteration. */
  sprintsSkipped: number;
  /** Sprints not sent: the iteration writes of the link are stopped, or refused by GitHub. */
  sprintsBlocked: number;
  /** Sprints without iteration while the iterations are not written. */
  sprintsUnpaired: number;
  /** Tasks renumbered after their issue. */
  renumbered: number;
  /** Comments created, changed or deleted, on either side. */
  comments: number;
  /** Tasks whose sync failed (GitHub refused a write…): left as they were, tried again at the next sync. */
  failed: number;
}

const linkedTask = { select: { id: true, githubContentId: true, githubContentType: true } } as const;
const include = {
  assignees: { select: { id: true, githubLogin: true } },
  tags: { select: { id: true, label: true } },
  sprints: { select: { id: true, startDate: true, githubIterationId: true } },
  parent: { select: { githubContentId: true, githubContentType: true } },
  blockedBy: { select: { blocker: linkedTask } },
  relationsA: { select: { taskB: linkedTask } },
  relationsB: { select: { taskA: linkedTask } },
  timeEntries: { where: { duration: { not: null } }, select: { duration: true, _count: { select: { tasks: true } } } },
} as const;
interface LinkedTask {
  id: string;
  githubContentId: string | null;
  githubContentType: string | null;
}
type SyncedTask = Task & {
  assignees: { id: string; githubLogin: string | null }[];
  tags: { id: string; label: string }[];
  sprints: { id: string; startDate: Date; githubIterationId: string | null }[];
  parent: { githubContentId: string | null; githubContentType: string | null } | null;
  blockedBy: { blocker: LinkedTask }[];
  relationsA: { taskB: LinkedTask }[];
  relationsB: { taskA: LinkedTask }[];
  timeEntries: { duration: number | null; _count: { tasks: number } }[];
};

/** What a sync needs to translate values between both sides. */
interface Maps {
  statusOption: Record<string, string>;
  optionStatus: Map<string, string>;
  priorityOption: Record<string, string>;
  optionPriority: Map<string, string>;
  /** Type id → option (FIELD) or issue type (ISSUE_TYPE), and back. */
  typeOption: Record<string, string>;
  optionType: Map<string, string>;
  sprintIteration: Map<string, string>;
  iterationSprint: Map<string, string>;
  /** Contributor id by GitHub login, and back. */
  contributorByLogin: Map<string, string>;
  loginByContributor: Map<string, string>;
  /** Milestone label by id. */
  milestoneLabel: Map<string, string>;
  /** Inheritance of the tasks of the workspace: the values a task goes by are those sent. */
  inheritance: TaskInheritanceContext;
  /** Task id by GitHub issue or draft id. */
  taskByContent: Map<string, string>;
  /** Issue field of each board field showing one (issues only: drafts have none). */
  issueFields: Map<string, string>;
}

/**
 * Field value of an item as a synchronized value.
 * @param {FieldValue | undefined} value Field value.
 * @returns {string | number | null} Option, iteration, date or number.
 */
function fieldValue(value: FieldValue | undefined): string | number | null {
  return value?.optionId ?? value?.iterationId ?? value?.date ?? value?.number ?? null;
}

/**
 * Label names compared by their key (`nameKey`: « Été » and « ete » are one label).
 * @param {string[]} names Names.
 * @returns {string[]} Keys, sorted, each once.
 */
const labelKeys = (names: string[]) => [...new Set(names.map(nameKey))].sort();

/**
 * Linked tasks whose links are synchronized: with an issue, archived or not (both sides always show the same links).
 * @param {LinkedTask[]} tasks Tasks.
 * @returns {LinkedTask[]} Tasks kept.
 */
const syncedLinks = (tasks: LinkedTask[]) => tasks.filter((task) => task.githubContentType === 'ISSUE' && task.githubContentId);

/**
 * Issues of linked tasks, archived or not (tasks without issue are left alone on both sides).
 * @param {LinkedTask[]} tasks Tasks.
 * @returns {string[]} Issue node ids, sorted.
 */
const issuesOf = (tasks: LinkedTask[]) => [...new Set(syncedLinks(tasks).map((task) => task.githubContentId!))].sort();

/**
 * Tasks related to a task (relations are stored once per pair).
 * @param {SyncedTask} task Task.
 * @returns {LinkedTask[]} Related tasks.
 */
const relatedOf = (task: SyncedTask) => [...task.relationsA.map((relation) => relation.taskB), ...task.relationsB.map((relation) => relation.taskA)];

/**
 * Tracked time of a task in hours (two decimals): each finished time entry is shared equally between its tasks.
 * @param {SyncedTask} task Task.
 * @returns {number} Hours.
 */
const trackedHours = (task: SyncedTask) => round2(sumOf(task.timeEntries, (entry) => (entry.duration ?? 0) / Math.max(1, entry._count.tasks)) / 3600);

/**
 * Whether the type is synchronized for an item: in a field of the board, or as issue type (issues only).
 * @param {GithubProjectLink} link Board link.
 * @param {RemoteItem['type']} type Content type.
 * @returns {boolean} Synchronized.
 */
const syncsType = (link: GithubProjectLink, type: RemoteItem['type']) => (link.typeSource === 'FIELD' && Boolean(link.typeFieldId)) || (link.typeSource === 'ISSUE_TYPE' && type === 'ISSUE');

/**
 * Board field usable for an item: set, and not an issue field on a draft (a draft has no issue field value).
 * @param {string | null} fieldId Board field.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem['type']} type Content type.
 * @returns {boolean} Usable.
 */
const usable = (fieldId: string | null, maps: Maps, type: RemoteItem['type']): fieldId is string => Boolean(fieldId) && (type === 'ISSUE' || !maps.issueFields.has(fieldId!));

/** Synchronized values of a task that it may inherit. */
type InheritedValues = Pick<EffectiveTask, 'priorityId' | 'milestoneId' | 'deadline' | 'assigneeIds'>;

/**
 * Values a task goes by for the synchronized fields it may inherit: its own, or its parent's while it inherits them
 * (`effectiveTask`). Its « Échéance » only when it was typed on a task, its own or one of its parents' (`typedDeadline`):
 * the one taken from a milestone, a project or a sprint, even by a parent, is not sent (GitHub knows the date of the
 * milestone).
 * @param {SyncedTask} task Task.
 * @param {Maps} maps Correspondences (inheritance).
 * @returns {InheritedValues} Values.
 */
function inheritedValues(task: SyncedTask, maps: Maps): InheritedValues {
  const effective = effectiveTaskOf(maps.inheritance, task.id);
  if (!effective) return { priorityId: task.priorityId, milestoneId: task.milestoneId, deadline: formatOptionalDay(task.deadline), assigneeIds: task.assignees.map((assignee) => assignee.id) };
  return { ...effective, deadline: typedDeadline(effective, maps) ? effective.deadline : null };
}

/**
 * Whether the « Échéance » a task goes by was typed on a task: its own, or its parent's up the chain while it inherits
 * it; not one taken from a milestone, a project or a sprint, even by its parent.
 * @param {EffectiveTask} effective Effective task.
 * @param {Maps} maps Correspondences (inheritance).
 * @param {Set<string>} [seen] Tasks already on the way (cycles stop). Optional.
 * @returns {boolean} Typed on a task.
 */
function typedDeadline(effective: EffectiveTask, maps: Maps, seen = new Set<string>()): boolean {
  const { source, sourceId } = taskFieldOrigin(effective, 'DEADLINE');
  if (source === 'OWN') return true;
  if (source !== 'PARENT' || !sourceId || seen.has(sourceId)) return false;
  seen.add(sourceId);
  const parent = effectiveTaskOf(maps.inheritance, sourceId);
  return Boolean(parent && typedDeadline(parent, maps, seen));
}

/**
 * GitHub logins of the assignees a task goes by (those without login have no counterpart).
 * @param {SyncedTask} task Task.
 * @param {Maps} maps Correspondences.
 * @returns {string[]} Logins.
 */
const assigneeLogins = (task: SyncedTask, maps: Maps) => inheritedValues(task, maps).assigneeIds.flatMap((id) => maps.loginByContributor.get(id) ?? []);

/**
 * Synchronized values of a task: those it goes by, inherited ones included.
 * @param {SyncedTask} task Task.
 * @param {GithubProjectLink} link Board link.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem['type']} type Content of its item (a draft has no state, labels or parent).
 * @param {string | null} [currentIteration] Iteration of the item now. Optional.
 * @returns {SyncFields} Values.
 */
function localFields(task: SyncedTask, link: GithubProjectLink, maps: Maps, type: RemoteItem['type'], currentIteration: string | null = null): SyncFields {
  // Archived in Ordo ↔ archived on the board (issues and drafts).
  const fields: SyncFields = { title: task.label, body: task.description ?? '', archived: task.archivedAt !== null };
  const inherited = inheritedValues(task, maps);
  if (link.syncAssignees) fields.assignees = assigneeLogins(task, maps);
  if (type === 'ISSUE') {
    // Closed as done or as cancelled (the state reason of the issue), or open.
    fields.closed = task.closedAt !== null ? (task.closeReason ?? 'COMPLETED') : false;
    if (link.syncLabels) fields.labels = labelKeys(task.tags.map((tag) => tag.label));
    // The parent is an issue of the board (archived or not: both sides always show the same parent), or has no counterpart.
    fields.parent = taskParentValue(task.parentId, task.parent?.githubContentType === 'ISSUE' ? task.parent.githubContentId : null);
    fields.milestone = inherited.milestoneId ? (maps.milestoneLabel.get(inherited.milestoneId) ?? null) : null;
    fields.blockedBy = issuesOf(task.blockedBy.map((block) => block.blocker));
    fields.relatesTo = issuesOf(relatedOf(task));
  }
  if (usable(link.statusFieldId, maps, type)) fields.status = task.statusId ? (maps.statusOption[task.statusId] ?? `ordo:${task.statusId}`) : null;
  if (usable(link.priorityFieldId, maps, type)) fields.priority = inherited.priorityId ? (maps.priorityOption[inherited.priorityId] ?? `ordo:${inherited.priorityId}`) : null;
  if (syncsType(link, type) && (link.typeSource !== 'FIELD' || usable(link.typeFieldId, maps, type))) fields.type = task.typeId ? (maps.typeOption[task.typeId] ?? `ordo:${task.typeId}`) : null;
  if (link.iterationFieldId) {
    // A board item has one iteration, a task several sprints: the iteration of the item when it is one of them,
    // otherwise the latest sprint of the task.
    const current = currentIteration ? maps.iterationSprint.get(currentIteration) : undefined;
    const latest = [...task.sprints].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    fields.iteration = current && task.sprints.some((sprint) => sprint.id === current) ? currentIteration : latest ? (maps.sprintIteration.get(latest.id) ?? `ordo:${latest.id}`) : null;
  }
  if (usable(link.startFieldId, maps, type)) fields.start = formatOptionalDay(task.startDate);
  if (usable(link.endFieldId, maps, type)) fields.end = formatOptionalDay(task.endDate);
  if (usable(link.deadlineFieldId, maps, type)) fields.deadline = inherited.deadline;
  if (usable(link.effortFieldId, maps, type)) fields.effort = task.effort;
  return fields;
}

/**
 * Synchronized values of an item.
 * @param {RemoteItem} item Item.
 * @param {GithubProjectLink} link Board link.
 * @param {Maps} maps Correspondences.
 * @returns {SyncFields} Values.
 */
function remoteFields(item: RemoteItem, link: GithubProjectLink, maps: Maps): SyncFields {
  const option = (fieldId: string, reverse: Map<string, string>) => {
    const value = fieldValue(item.fields[fieldId]);
    return value === null ? null : reverse.has(String(value)) ? String(value) : `gh:${value}`;
  };
  // Issues without task (outside the board) are left alone on both sides; those of archived tasks are synchronized.
  const known = (ids: string[]) => [...new Set(ids.filter((id) => maps.taskByContent.has(id)))].sort();
  const fields: SyncFields = { title: item.title, body: item.body, archived: item.archived };
  // Logins without contributor are left alone on both sides.
  if (link.syncAssignees) fields.assignees = item.assignees.filter((login) => maps.contributorByLogin.has(login));
  if (item.type === 'ISSUE') {
    fields.closed = item.closed ? (item.closeReason ?? 'COMPLETED') : false;
    if (link.syncLabels) fields.labels = labelKeys(item.labels.map((label) => label.name));
    // A parent issue linked to a task, archived or not: both sides always show the same parent.
    fields.parent = itemParentValue(item.parentId, Boolean(item.parentId && maps.taskByContent.has(item.parentId)));
    fields.milestone = item.milestone?.title ?? null;
    fields.blockedBy = known(item.blockedBy);
    fields.relatesTo = known(item.relatesTo);
  }
  if (usable(link.statusFieldId, maps, item.type)) fields.status = option(link.statusFieldId, maps.optionStatus);
  if (usable(link.priorityFieldId, maps, item.type)) fields.priority = option(link.priorityFieldId, maps.optionPriority);
  if (syncsType(link, item.type) && (link.typeSource !== 'FIELD' || usable(link.typeFieldId, maps, item.type))) {
    if (link.typeSource === 'FIELD') fields.type = option(link.typeFieldId!, maps.optionType);
    else fields.type = item.issueTypeId ? (maps.optionType.has(item.issueTypeId) ? item.issueTypeId : `gh:${item.issueTypeId}`) : null;
  }
  // An iteration without sprint (deleted in Ordo) has no counterpart: a GitHub user putting the item in it is not undone.
  if (link.iterationFieldId) fields.iteration = itemIterationValue((fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null, maps.iterationSprint);
  if (usable(link.startFieldId, maps, item.type)) fields.start = dayPart(fieldValue(item.fields[link.startFieldId]) as string | null);
  if (usable(link.endFieldId, maps, item.type)) fields.end = dayPart(fieldValue(item.fields[link.endFieldId]) as string | null);
  if (usable(link.deadlineFieldId, maps, item.type)) fields.deadline = dayPart(fieldValue(item.fields[link.deadlineFieldId]) as string | null);
  if (usable(link.effortFieldId, maps, item.type)) fields.effort = (fieldValue(item.fields[link.effortFieldId]) as number | null) ?? null;
  return fields;
}

/**
 * Values pulled from GitHub that Ordo refuses, left out (the task keeps its own, sent back to GitHub at the next sync):
 * an effort out of its rule (negative, too large), a start and an end in the wrong order (the days pulled go, those of
 * the task stay), an « Échéance » before the own « Ouverture » of the task.
 * @param {SyncFields} values Values pulled from the item.
 * @param {SyncedTask} task Task.
 * @returns {SyncFields} Values kept.
 */
function acceptedValues(values: SyncFields, task: SyncedTask): SyncFields {
  const kept = { ...values };
  if ('effort' in kept && typeof kept.effort === 'number' && !effortSchema.safeParse(kept.effort).success) delete kept.effort;
  const day = (key: 'start' | 'end' | 'deadline', own: Date | null) => (key in kept ? (kept[key] as string | null) || null : formatOptionalDay(own));
  const start = day('start', task.startDate);
  const end = day('end', task.endDate);
  if (start && end && end < start) {
    delete kept.start;
    delete kept.end;
  }
  const deadline = day('deadline', task.deadline);
  const minDate = marksInherited(task, 'MIN_DATE') ? null : formatOptionalDay(task.minDate);
  if (deadline && minDate && deadline < minDate) delete kept.deadline;
  return kept;
}

/** Synchronized fields of a task that are inherited fields. */
const PULLED_INHERITED: Record<string, TaskInheritableField> = { priority: 'PRIORITY', deadline: 'DEADLINE', milestone: 'MILESTONE', assignees: 'ASSIGNEES' };

/**
 * Prisma data writing synchronized values on a task (tags missing in Ordo are created). A value taken from GitHub is the
 * task's own. Detached from its parent by GitHub, what it inherited becomes its own; placed under a parent while
 * top-level, its empty fields inherit (as in Ordo).
 * @param {SyncFields} values Values pulled from the item.
 * @param {SyncedTask} task Task.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem} item Item (label names and colors).
 * @returns {Promise<Prisma.TaskUpdateInput>} Data (with `parent` only when the parent pulled is accepted).
 */
async function pullData(values: SyncFields, task: SyncedTask, maps: Maps, item: RemoteItem): Promise<Prisma.TaskUpdateInput> {
  const data: Prisma.TaskUpdateInput = {};
  if ('title' in values) data.label = clipText(String(values.title)) || task.label;
  if ('body' in values) data.description = values.body ? String(values.body) : null;
  // Closed as done or as not planned (cancelled): an issue closed keeps the closing date of its task.
  if ('closed' in values) Object.assign(data, values.closed ? { closedAt: task.closedAt ?? new Date(), closeReason: values.closed === 'NOT_PLANNED' ? 'NOT_PLANNED' : 'COMPLETED' } : { closedAt: null, closeReason: null });
  if ('status' in values) data.status = values.status ? { connect: { id: maps.optionStatus.get(String(values.status))! } } : { disconnect: true };
  if ('priority' in values) data.priority = values.priority ? { connect: { id: maps.optionPriority.get(String(values.priority))! } } : { disconnect: true };
  if ('type' in values) data.type = values.type ? { connect: { id: maps.optionType.get(String(values.type))! } } : { disconnect: true };
  if ('deadline' in values) data.deadline = parseOptionalDay((values.deadline as string | null) || null);
  if ('milestone' in values)
    data.milestone = values.milestone ? { connect: { id: await milestoneOf(task.projectId!, String(values.milestone), maps) /* synced tasks are in a linked project */ } } : { disconnect: true };
  if ('blockedBy' in values) {
    const wanted = new Set((values.blockedBy as string[]).map((id) => maps.taskByContent.get(id)).filter((id): id is string => Boolean(id)));
    const current = syncedLinks(task.blockedBy.map((block) => block.blocker));
    // Archived tasks accepted: both sides always show the same links.
    for (const blocker of current) if (!wanted.has(blocker.id)) await removeTaskBlock(blocker.id, task.id, true);
    // A dependency Ordo refuses (circular, other project tree) is left out.
    for (const id of wanted) if (!current.some((blocker) => blocker.id === id)) await addTaskBlock(id, task.id, true).catch(() => undefined);
  }
  if ('relatesTo' in values) {
    const wanted = new Set((values.relatesTo as string[]).map((id) => maps.taskByContent.get(id)).filter((id): id is string => Boolean(id)));
    const current = syncedLinks(relatedOf(task));
    for (const other of current) if (!wanted.has(other.id)) await removeTaskRelation(task.id, other.id, true);
    for (const id of wanted) if (!current.some((other) => other.id === id)) await addTaskRelation(task.id, id, true).catch(() => undefined);
  }
  if ('iteration' in values) {
    // The sprint of the iteration is added: a task may be in several sprints, none is taken away from GitHub.
    const sprintId = values.iteration ? maps.iterationSprint.get(String(values.iteration)) : undefined;
    if (sprintId && !task.sprints.some((sprint) => sprint.id === sprintId)) data.sprints = { connect: [{ id: sprintId }] };
  }
  if ('start' in values) data.startDate = parseOptionalDay((values.start as string | null) || null);
  if ('end' in values) data.endDate = parseOptionalDay((values.end as string | null) || null);
  if ('effort' in values) data.effort = typeof values.effort === 'number' ? values.effort : null;
  if ('assignees' in values) {
    // Assignees without GitHub login stay (those it went by, inherited ones included).
    const kept = inheritedValues(task, maps).assigneeIds.filter((id) => !maps.loginByContributor.has(id));
    const synced = (values.assignees as string[]).map((login) => maps.contributorByLogin.get(login)).filter((id): id is string => Boolean(id));
    data.assignees = { set: connectIds([...kept, ...synced]) };
  }
  if ('labels' in values) {
    const tags = await prisma.taskTag.findMany();
    const ids: string[] = [];
    for (const key of values.labels as string[]) {
      // Names cut to the rule of the tags: a long label is found again by its cut name.
      let tag = tags.find((item) => sameName(item.label, clipText(key)));
      if (!tag) {
        const label = item.labels.find((entry) => nameKey(entry.name) === key);
        const position = await nextPositionIn('taskTag');
        tag = await prisma.taskTag.create({ data: { label: clipText(label?.name ?? key), color: DEFAULT_LABEL_COLOR, position } });
        tags.push(tag);
      }
      ids.push(tag.id);
    }
    data.tags = { set: connectIds(ids) };
  }
  let inherited: readonly string[] = task.inheritedFields;
  if ('parent' in values) {
    const parentId = values.parent ? maps.taskByContent.get(String(values.parent)) : null;
    // The parent obeys the rule of Ordo (same project tree, not under itself or one of its sub-tasks; archived or not,
    // as on GitHub): otherwise the task keeps its own.
    if (!parentId || (await assertParent(parentId, task.projectId, task.id, true).then(() => true, () => false))) {
      data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
      // An archived task given another parent is archived on its own: restoring its former parent leaves it archived.
      if (task.archivedAt) data.archivedByCascade = false;
      if (!parentId && task.parentId) {
        await freezeTaskInheritance([task.id]);
        inherited = [];
      } else if (parentId && !task.parentId) inherited = await adoptedTaskFields(task.id);
    }
  }
  const owned = new Set<string>(Object.entries(PULLED_INHERITED).flatMap(([key, field]) => (key in values ? [field] : [])));
  const remaining = inherited.filter((field) => !owned.has(field));
  // A part of its list (a top-level task's is empty): changed when shorter or longer.
  if (remaining.length !== task.inheritedFields.length) data.inheritedFields = remaining;
  return data;
}

/**
 * Milestone of a project with this label, created when there is none (and then known to the tasks pushed after it in
 * the same sync).
 * @param {string} projectId Project of the task.
 * @param {string} title Milestone title on GitHub.
 * @param {Maps} maps Correspondences (milestone labels, completed).
 * @returns {Promise<string>} Milestone id.
 */
async function milestoneOf(projectId: string, title: string, maps: Maps): Promise<string> {
  // Cut to the rule of the milestones: a long title is found again by its cut one.
  const cut = clipText(title);
  const found = await prisma.milestone.findFirst({ where: { projectId, label: cut }, select: { id: true } });
  if (found) return found.id;
  const position = await nextPositionIn('milestone', { projectId });
  const { id } = await prisma.milestone.create({ data: { projectId, label: cut, position }, select: { id: true } });
  maps.milestoneLabel.set(id, cut);
  return id;
}

/**
 * Gives a task the number of its issue (a task of the project holding it already takes the next free number;
 * one linked to an issue with that same number, from another repository, keeps it).
 * @param {string} taskId Task.
 * @param {number} number Issue number.
 * @returns {Promise<boolean>} Renumbered.
 */
async function matchIssueNumber(taskId: string, number: number): Promise<boolean> {
  // Read again: the task may have just given its number to another one.
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, number: true, projectId: true } });
  if (!task || task.number === number) return false;
  const holder = await prisma.task.findFirst({ where: { projectId: task.projectId, number, id: { not: task.id } }, select: { id: true, githubContentType: true, githubNumber: true } });
  if (holder?.githubContentType === 'ISSUE' && holder.githubNumber === number) return false;
  if (holder) {
    const { _max } = await prisma.task.aggregate({ where: { projectId: task.projectId }, _max: { number: true } });
    await prisma.task.update({ where: { id: holder.id }, data: { number: Math.max(_max.number ?? 0, number) + 1 } });
  }
  await prisma.task.update({ where: { id: task.id }, data: { number } });
  return true;
}

/** Labels of the repositories met during a sync: name (lowercase) → id. */
type LabelCache = Map<string, Map<string, string>>;

/** Milestones of the repositories met during a sync: "owner/name" and title → id. */
type MilestoneCache = Map<string, { nameWithOwner: string; milestones: Map<string, string> }>;

/** Relationships already sent in a sync (each pair is seen from both of its issues). */
type SentRelations = Set<string>;

/**
 * Writes synchronized values on an item.
 * @param {string} token Token.
 * @param {GithubProjectLink} link Board link.
 * @param {RemoteItem} item Item, as read before the change.
 * @param {SyncFields} values Values pushed from the task.
 * @param {object} context Known logins before the change, tags of the task, repository labels.
 * @param {string[]} context.knownBefore Synchronized logins on GitHub before the change.
 * @param {{ label: string }[]} context.tags Tags of the task (labels as written in Ordo).
 * @param {LabelCache} context.labels Labels of the repositories.
 * @param {MilestoneCache} context.milestones Milestones of the repositories.
 * @param {SentRelations} context.sent Relationships already sent in this sync.
 * @param {Map<string, string>} context.taskByContent Tasks by issue (archived or not): other issues are left alone.
 * @param {Map<string, string>} context.issueFields Issue field of the board fields showing one.
 * @returns {Promise<void>}
 */
async function pushValues(
  token: string,
  link: GithubProjectLink,
  item: RemoteItem,
  values: SyncFields,
  {
    knownBefore,
    tags,
    labels,
    milestones,
    sent,
    taskByContent,
    issueFields,
  }: {
    knownBefore: string[];
    tags: { label: string; color?: string }[];
    labels: LabelCache;
    milestones: MilestoneCache;
    sent: SentRelations;
    taskByContent: Map<string, string>;
    issueFields: Map<string, string>;
  },
): Promise<void> {
  // Taken out of the archive first, archived last: the item takes the other values as an active one.
  if (values.archived === false) await setItemArchived(token, link.githubProjectId, item.itemId, false);
  const assignees = values.assignees as string[] | undefined;
  await updateContent(token, item.type, item.contentId, {
    title: 'title' in values ? String(values.title) : undefined,
    body: 'body' in values ? String(values.body ?? '') : undefined,
    closed: 'closed' in values ? (values.closed ? (values.closed === 'NOT_PLANNED' ? 'NOT_PLANNED' : 'COMPLETED') : false) : undefined,
    assignees: assignees && {
      add: assignees.filter((login) => !knownBefore.includes(login)),
      remove: knownBefore.filter((login) => !assignees.includes(login)),
      all: [...item.assignees.filter((login) => !knownBefore.includes(login)), ...assignees],
    },
  });
  if ('labels' in values && item.repositoryId) {
    let repository = labels.get(item.repositoryId);
    if (!repository) {
      repository = new Map((await repositoryLabels(token, item.repositoryId)).map((label) => [nameKey(label.name), label.id]));
      labels.set(item.repositoryId, repository);
    }
    const wanted = values.labels as string[];
    const add: string[] = [];
    for (const key of wanted) {
      if (item.labels.some((label) => nameKey(label.name) === key)) continue;
      let id = repository.get(key);
      if (!id) {
        // A tag without label in the repository: created with the tag's label and color.
        const tag = tags.find((entry) => sameName(entry.label, key));
        id = (await createLabel(token, item.repositoryId, tag?.label ?? key, (tag?.color ?? DEFAULT_LABEL_COLOR).replace('#', ''))).id;
        repository.set(key, id);
      }
      add.push(id);
    }
    const remove = item.labels.filter((label) => !wanted.includes(nameKey(label.name))).map((label) => label.id);
    await setIssueLabels(token, item.contentId, add, remove);
  }
  if ('parent' in values && item.type === 'ISSUE') {
    await setIssueParent(token, item.contentId, (values.parent as string | null) ?? null, item.parentId);
  }
  if ('milestone' in values && item.type === 'ISSUE' && item.repositoryId) {
    const title = values.milestone ? String(values.milestone) : null;
    let milestoneId: string | null = null;
    if (title) {
      let repository = milestones.get(item.repositoryId);
      if (!repository) {
        const found = await repositoryMilestones(token, item.repositoryId);
        repository = { nameWithOwner: found.nameWithOwner, milestones: new Map(found.milestones.map((milestone) => [milestone.title, milestone.id])) };
        milestones.set(item.repositoryId, repository);
      }
      milestoneId = repository.milestones.get(title) ?? null;
      if (!milestoneId) {
        // An Ordo milestone without counterpart in the repository: created with its label.
        milestoneId = (await createMilestone(token, repository.nameWithOwner, title)).id;
        repository.milestones.set(title, milestoneId);
      }
    }
    await setIssueMilestone(token, item.contentId, milestoneId);
  }
  if ('type' in values && link.typeSource === 'ISSUE_TYPE' && item.type === 'ISSUE') {
    await setIssueType(token, item.contentId, (values.type as string | null) ?? null);
  }
  // Only the issues of the board are compared: the others are left alone.
  const relationships: ['blockedBy' | 'relatesTo', string[], typeof setBlockedBy][] = [
    ['blockedBy', item.blockedBy, setBlockedBy],
    ['relatesTo', item.relatesTo, setRelatesTo],
  ];
  for (const [field, before, send] of relationships) {
    if (!(field in values) || item.type !== 'ISSUE') continue;
    const wanted = values[field] as string[];
    const changes = [
      ...wanted.filter((id) => !before.includes(id)).map((id) => [id, true] as const),
      ...before.filter((id) => taskByContent.has(id) && !wanted.includes(id)).map((id) => [id, false] as const),
    ];
    for (const [other, add] of changes) {
      // A relation is symmetric: sent once for its pair.
      const key = field === 'relatesTo' ? `${field}:${[item.contentId, other].sort().join(':')}:${add}` : `${field}:${item.contentId}:${other}:${add}`;
      if (sent.has(key)) continue;
      sent.add(key);
      await send(token, item.contentId, other, add);
    }
  }
  const fields: [keyof SyncFields, string | null, (value: NonNullable<SyncFields[keyof SyncFields]>) => FieldValue][] = [
    ['status', link.statusFieldId, (value) => ({ optionId: String(value) })],
    ['priority', link.priorityFieldId, (value) => ({ optionId: String(value) })],
    ['type', link.typeSource === 'FIELD' ? link.typeFieldId : null, (value) => ({ optionId: String(value) })],
    ['deadline', link.deadlineFieldId, (value) => ({ date: String(value) })],
    ['iteration', link.iterationFieldId, (value) => ({ iterationId: String(value) })],
    ['start', link.startFieldId, (value) => ({ date: String(value) })],
    ['end', link.endFieldId, (value) => ({ date: String(value) })],
    ['effort', link.effortFieldId, (value) => ({ number: Number(value) })],
  ];
  for (const [field, fieldId, toValue] of fields) {
    if (!fieldId || !(field in values)) continue;
    const value = values[field];
    await writeField(token, link, item, fieldId, value === null || value === undefined ? null : toValue(value), issueFields);
  }
  if (values.archived === true) await setItemArchived(token, link.githubProjectId, item.itemId, true);
}

/**
 * Synchronizes the comments of a task and its issue, both ways: new ones on each side are copied, edited ones
 * merged against their last synchronized body (the latest edit wins a conflict), and a comment deleted on
 * GitHub is deleted in Ordo (one deleted in Ordo was deleted on GitHub at once). Every comment on GitHub records its
 * author, the account connected included (a comment published from Ordo records the account it was published with):
 * after the token is replaced by one of another account, a comment whose issue is forgotten is never published again
 * under that other account.
 * @param {string} token Token.
 * @param {string} taskId Task.
 * @param {RemoteItem} item Issue item.
 * @param {string} login Login of the account connected.
 * @returns {Promise<number>} Comments created, changed or deleted.
 */
async function syncComments(token: string, taskId: string, item: RemoteItem, login: string): Promise<number> {
  const local: TaskComment[] = await prisma.taskComment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } });
  const remote = mapById(item.comments);
  let changes = 0;
  for (const comment of local) {
    if (!comment.githubCommentId) {
      // A comment of another account whose issue was forgotten, or whose project was unlinked or linked to another board, stays in Ordo only.
      if (!commentToPublish(comment, login)) continue;
      const id = await addIssueComment(token, item.contentId, comment.body);
      await prisma.taskComment.update({ where: { id: comment.id }, data: { githubCommentId: id, githubBody: comment.body, githubAuthor: login || null } });
      changes += 1;
      continue;
    }
    const theirs = remote.get(comment.githubCommentId);
    remote.delete(comment.githubCommentId);
    if (!theirs) {
      await prisma.taskComment.delete({ where: { id: comment.id } });
      changes += 1;
      continue;
    }
    // A comment synchronized before its author was recorded (the account connected then) takes it from GitHub.
    if (!comment.githubAuthor && theirs.author) await prisma.taskComment.update({ where: { id: comment.id }, data: { githubAuthor: theirs.author } });
    if (comment.body === theirs.body) {
      if (comment.githubBody !== theirs.body) await prisma.taskComment.update({ where: { id: comment.id }, data: { githubBody: theirs.body } });
      continue;
    }
    const pull = comment.body === comment.githubBody || (theirs.body !== comment.githubBody && !changedAfter(comment.updatedAt, theirs.updatedAt));
    if (pull) await prisma.taskComment.update({ where: { id: comment.id }, data: { body: theirs.body, githubBody: theirs.body } });
    else {
      await updateIssueComment(token, theirs.id, comment.body);
      await prisma.taskComment.update({ where: { id: comment.id }, data: { githubBody: comment.body } });
    }
    changes += 1;
  }
  for (const comment of remote.values()) {
    await prisma.taskComment.create({
      data: {
        taskId,
        body: comment.body,
        createdAt: new Date(comment.createdAt),
        githubCommentId: comment.id,
        githubBody: comment.body,
        githubAuthor: comment.author,
      },
    });
    changes += 1;
  }
  return changes;
}

/**
 * Ids of a project and its sub-projects.
 * @param {string} projectId Project.
 * @returns {Promise<string[]>} Ids.
 */
function projectTree(projectId: string): Promise<string[]> {
  return subtreeIds('project', projectId);
}

/**
 * Writes a value in a board field of an item: the item's own value, or the issue's for an issue field (a draft
 * has none: nothing is written).
 * @param {string} token Token.
 * @param {GithubProjectLink} link Board link.
 * @param {RemoteItem} item Item.
 * @param {string} fieldId Board field.
 * @param {FieldValue | null} value Value, or null to clear.
 * @param {Map<string, string>} issueFields Issue field of the board fields showing one.
 * @returns {Promise<void>}
 */
async function writeField(token: string, link: GithubProjectLink, item: RemoteItem, fieldId: string, value: FieldValue | null, issueFields: Map<string, string>): Promise<void> {
  const issueFieldId = issueFields.get(fieldId);
  if (!issueFieldId) return setItemField(token, { projectId: link.githubProjectId, itemId: item.itemId, fieldId }, value);
  if (item.type === 'ISSUE') await setIssueFieldValue(token, item.contentId, issueFieldId, value);
}

/**
 * Writes the tracked time of a task (hours) in the number field of the board chosen for it, when it differs.
 * Ordo → GitHub only: the time comes from the time entries.
 * @param {string} token Token.
 * @param {GithubProjectLink} link Board link.
 * @param {RemoteItem} item Item.
 * @param {SyncedTask} task Task.
 * @param {Map<string, string>} issueFields Issue field of the board fields showing one.
 * @returns {Promise<boolean>} Written.
 */
async function pushTrackedTime(token: string, link: GithubProjectLink, item: RemoteItem, task: SyncedTask, issueFields: Map<string, string>): Promise<boolean> {
  if (!link.timeSpentFieldId || (item.type !== 'ISSUE' && issueFields.has(link.timeSpentFieldId))) return false;
  const hours = trackedHours(task) || null;
  const current = (fieldValue(item.fields[link.timeSpentFieldId]) as number | null) ?? null;
  if (hours === current) return false;
  await writeField(token, link, item, link.timeSpentFieldId, hours === null ? null : { number: hours }, issueFields);
  return true;
}

/** Error of a sync asked for while another one of its link runs. */
const SYNC_RUNNING = 'Une synchronisation de ce projet est déjà en cours.';

/** Syncs running, by link: each one ends (resolved) once its link is free again. */
const running = new Map<string, Promise<void>>();

/**
 * Forgets the issue of a task that cannot get it back on the board: its GitHub content and the links of its comments
 * are cleared (what is given marks what follows: no content left, sent again as a new task; or off the board). The
 * comments of others keep their author: they stay in Ordo only, never published under the account connected.
 * @param {string} taskId Task.
 * @param {Prisma.TaskUpdateInput} mark Content id and type to write.
 * @returns {Promise<void>}
 */
async function forgetIssue(taskId: string, mark: Prisma.TaskUpdateInput): Promise<void> {
  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { ...mark, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull } }),
    prisma.taskComment.updateMany({ where: { taskId }, data: { githubCommentId: null, githubBody: null } }),
  ]);
}

/**
 * Synchronizes one pair, or sends one new task: a failure (a write GitHub refuses…) is logged and counted, and the
 * other tasks go on. What it did not record (the snapshot last) is tried again at the next sync. A failure that would
 * be the same for every task (GitHub out of reach, token refused, rate limit, missing rights) stops the whole sync.
 * @param {SyncSummary} summary Summary of the sync (its failures counted).
 * @param {() => Promise<void>} work Sync of the task.
 * @param {(error: unknown) => void} [failed] Told the failure of the task. Optional.
 * @returns {Promise<void>}
 */
async function isolated(summary: SyncSummary, work: () => Promise<void>, failed?: (error: unknown) => void): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (stopsSync(error)) throw error;
    summary.failed += 1;
    failed?.(error);
    console.warn('Synchronisation GitHub : tâche non synchronisée.', error);
  }
}

/**
 * Synchronizes a project with its GitHub board, both ways: sprints and iterations mirror each other; items new on the board
 * become tasks of the project, tasks new in the project tree become items (draft issues, or issues of the
 * chosen repository); linked pairs are merged field by field against the last sync (labels with tags,
 * sub-issues with sub-tasks, the archive of a task with the archive of its item), then the comments of issues;
 * archived tasks too. A task whose item left the board is kept, unlinked, not sent again, and archived with a
 * comment saying so. Tasks asked for (« Envoyer sur GitHub ») are also sent when not on GitHub, created before the
 * link or removed from the board, the link in automatic or manual sync. One sync at a time per link: refused
 * while another one runs (`sendWhenFree` waits for it).
 * @param {string} projectId Linked project.
 * @param {ReadonlySet<string>} [send] Tasks to send on request. Optional. Default = none.
 * @returns {Promise<{ summary: SyncSummary, failures: Map<string, string> }>} What changed, and why each task that
 * failed did (by task).
 */
async function runGithubSync(projectId: string, send: ReadonlySet<string> = new Set()): Promise<{ summary: SyncSummary; failures: Map<string, string> }> {
  const link = await orNotFound(prisma.githubProjectLink.findUnique({ where: { projectId } }), 'Lien GitHub');
  // Nothing waits between this check and the start: two syncs of a link never run together.
  if (running.has(link.id)) throw clientError('BAD_USER_INPUT', SYNC_RUNNING);
  let finish = () => {};
  running.set(link.id, new Promise<void>((resolve) => (finish = resolve)));
  const failures = new Map<string, string>();
  /**
   * Keeps why a task failed.
   * @param {string} taskId Task.
   * @returns {(error: unknown) => void} Recorder of its failure.
   */
  const failedTask = (taskId: string) => (error: unknown) => failures.set(taskId, errorMessage(error));
  const summary: SyncSummary = { pulledNew: 0, pushedNew: 0, pulled: 0, pushed: 0, unlinked: 0, sprints: 0, sprintsPushed: 0, sprintsSkipped: 0, sprintsBlocked: 0, sprintsUnpaired: 0, renumbered: 0, comments: 0, failed: 0 };
  try {
    const token = await githubToken();
    const login = (await currentGithubConnection())?.login ?? '';
    const board = await boardById(token, link.githubProjectId);
    const tree = await projectTree(projectId);
    const iterations = await syncIterations(token, board, link, tree);
    summary.sprints = iterations.changed;
    summary.sprintsPushed = iterations.pushed;
    summary.sprintsSkipped = iterations.skipped;
    summary.sprintsBlocked = iterations.blocked;
    summary.sprintsUnpaired = iterations.unpaired;
    // Tasks back in the tree whose issue left the board with them (a transfer out of the tree, then its undo or a
    // transfer back), archived or not, whenever they were created (they were on a board already): the same issue is
    // added to the board again and linked, before the items are read, so that it is merged below as a pair, Ordo
    // giving the values the new item carries. A draft, deleted with its item, is sent again as a new task (below).
    const issueFieldIds = new Set(board.fields.filter((field) => field.issueFieldId).map((field) => field.id));
    const back = await prisma.task.findMany({
      where: { projectId: { in: tree }, githubItemId: null, githubContentType: 'ISSUE', githubContentId: { not: null } },
      select: { id: true, githubContentId: true, githubUrl: true, githubSnapshot: true, updatedAt: true },
    });
    const readded = new Set<string>();
    for (const task of back) {
      await isolated(summary, async () => {
        let itemId: string;
        try {
          itemId = await addIssueToBoard(token, link.githubProjectId, task.githubContentId!);
        } catch (error) {
          // Not found: only an issue surely gone (its repository readable, without it) is forgotten, the task sent again
          // as a new one (below); an issue out of reach (repository private, token narrowed) is tried again.
          if (!isGoneOnGithub(error) || !(await issueGone(token, task.githubUrl))) throw error;
          await forgetIssue(task.id, { githubContentId: null });
          return;
        }
        // The issue still had its item, now linked to another task (taken in by a former sync): that pair stays; this
        // task is no longer linked, marked as off the board (not sent again, as a task whose item left the board).
        const holder = await prisma.task.findUnique({ where: { githubItemId: itemId }, select: { id: true } });
        if (holder) {
          console.warn('Synchronisation GitHub : issue déjà liée à une autre tâche.', { taskId: task.id, holderId: holder.id });
          await forgetIssue(task.id, { githubContentId: null, githubContentType: REMOVED_FROM_BOARD });
          await prisma.taskComment.create({ data: { taskId: task.id, body: alreadyLinkedComment(parisToday()) } });
          return;
        }
        // Its own last change kept: linking it again is not a change of the task (the merge compares the dates).
        await prisma.task.update({
          where: { id: task.id },
          data: { githubItemId: itemId, githubSnapshot: toJson(readdedItemSnapshot(task.githubSnapshot as SyncFields | null, link, issueFieldIds)), updatedAt: task.updatedAt },
        });
        readded.add(task.id);
        summary.pushedNew += 1;
      }, failedTask(task.id));
    }
    const items = await boardItems(token, board);
    const itemIds = items.map((item) => item.itemId);

    // Tasks of the tree whose item is gone (removed from the board, or deleted; an item archived on the board is still
    // there): archived (with their active sub-tasks, as any archive; the topmost first, so
    // that the cascade does not depend on their order), then unlinked, marked so that they are not sent back, with a
    // comment saying so. Archived first: a failure leaves them gone, archived again (no change) at the next sync.
    // An issue added again just now may not be read yet: it is not gone.
    const gone = await prisma.task.findMany({ where: { projectId: { in: tree }, githubItemId: { not: null, notIn: itemIds }, id: { notIn: [...readded] } }, select: { id: true } });
    if (gone.length) {
      const goneIds = gone.map((task) => task.id);
      // The topmost first (their sub-tasks archived along), then the others: one under a parent already archived too.
      const roots = await topmostIds('task', goneIds);
      for (const id of [...roots, ...goneIds.filter((id) => !roots.includes(id))]) await setTaskArchived(id, true);
      const body = removedFromBoardComment(parisToday());
      await prisma.$transaction([
        prisma.task.updateMany({
          where: { id: { in: goneIds } },
          data: { githubItemId: null, githubContentId: null, githubContentType: REMOVED_FROM_BOARD, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull },
        }),
        prisma.taskComment.updateMany({ where: { taskId: { in: goneIds } }, data: { githubCommentId: null, githubBody: null } }),
        prisma.taskComment.createMany({ data: goneIds.map((taskId) => ({ taskId, body })) }),
      ]);
      summary.unlinked = gone.length;
    }

    // Items new on the board: tasks of the project (their fields come with the merge below).
    const known = new Set((await prisma.task.findMany({ where: { githubItemId: { in: itemIds } }, select: { githubItemId: true } })).map((task) => task.githubItemId));
    // An item archived on the board that no task knows is left alone (as an archived task never sent is not sent).
    const created = new Set(items.filter((entry) => !known.has(entry.itemId) && !entry.archived).map((entry) => entry.itemId));
    for (const item of items.filter((entry) => created.has(entry.itemId))) {
      const task = await createTask({ label: clipText(item.title) || `Item GitHub ${item.number ?? ''}`.trim(), projectId });
      // Empty snapshot except the title: every GitHub value is new, so it is pulled.
      await prisma.task.update({
        where: { id: task.id },
        data: {
          githubItemId: item.itemId,
          githubContentId: item.contentId,
          githubContentType: item.type,
          githubUrl: item.url,
          githubNumber: item.number,
          githubSnapshot: { title: task.label, body: '', archived: false, assignees: [], labels: [], parent: null, closed: false, status: null, priority: null, iteration: null, start: null, end: null, effort: null },
        },
      });
      summary.pulledNew += 1;
    }

    const statusOption = link.statusOptions as Record<string, string>;
    const priorityOption = link.priorityOptions as Record<string, string>;
    const typeOption = link.typeSource ? (link.typeOptions as Record<string, string>) : {};
    // Only the sprints whose iteration is on the board now: no task sends an iteration that is gone.
    const iterationIds = new Set(board.fields.find((field) => field.id === link.iterationFieldId)?.iterations.map((iteration) => iteration.id) ?? []);
    const sprints = (await prisma.sprint.findMany({ where: { githubIterationId: { not: null } }, select: { id: true, githubIterationId: true } })).filter((sprint) => iterationIds.has(sprint.githubIterationId!));
    const contributors = await prisma.contributor.findMany({ where: { githubLogin: { not: null } }, select: { id: true, githubLogin: true } });
    const milestoneRows = await prisma.milestone.findMany({ select: { id: true, label: true } });
    const linked = await prisma.task.findMany({ where: { githubItemId: { in: itemIds } }, include });
    const maps: Maps = {
      statusOption,
      optionStatus: new Map(
        Object.entries(statusOption)
          .reverse()
          .map(([status, option]) => [option, status]),
      ),
      priorityOption,
      optionPriority: new Map(
        Object.entries(priorityOption)
          .reverse()
          .map(([priority, option]) => [option, priority]),
      ),
      typeOption,
      optionType: new Map(
        Object.entries(typeOption)
          .reverse()
          .map(([type, option]) => [option, type]),
      ),
      sprintIteration: new Map(sprints.map((sprint) => [sprint.id, sprint.githubIterationId!])),
      iterationSprint: new Map(sprints.map((sprint) => [sprint.githubIterationId!, sprint.id])),
      contributorByLogin: new Map(contributors.map((contributor) => [contributor.githubLogin!, contributor.id])),
      loginByContributor: new Map(contributors.map((contributor) => [contributor.id, contributor.githubLogin!])),
      milestoneLabel: new Map(milestoneRows.map((milestone) => [milestone.id, milestone.label])),
      inheritance: await loadTaskInheritance(),
      taskByContent: new Map(linked.map((task) => [task.githubContentId!, task.id])),
      issueFields: new Map(board.fields.filter((field) => field.issueFieldId).map((field) => [field.id, field.issueFieldId!])),
    };
    const labels: LabelCache = new Map();
    const milestones: MilestoneCache = new Map();
    const sent: SentRelations = new Set();
    const tagColors = new Map((await prisma.taskTag.findMany()).map((tag) => [nameKey(tag.label), tag.color]));
    /**
     * What a push of the values of a task needs besides them: its tags, the caches of this sync.
     * @param {SyncedTask} task Task.
     * @param {string[]} knownBefore Assignees of the item before the push.
     * @returns {Parameters<typeof pushValues>[4]} Push context.
     */
    const pushContext = (task: SyncedTask, knownBefore: string[]): Parameters<typeof pushValues>[4] => ({
      knownBefore,
      tags: task.tags.map((tag) => ({ label: tag.label, color: tagColors.get(nameKey(tag.label)) })),
      labels,
      milestones,
      sent,
      taskByContent: maps.taskByContent,
      issueFields: maps.issueFields,
    });
    const byItem = new Map(linked.map((task) => [task.githubItemId!, task]));

    // Parents first: what a parent receives reaches the sub-tasks that inherit it in the same pass.
    const depth = (entry: RemoteItem) => lineageOf(maps.inheritance.tasks, byItem.get(entry.itemId)?.id).length;
    for (const item of items.filter((entry) => byItem.has(entry.itemId)).sort((a, b) => depth(a) - depth(b))) {
      await isolated(summary, async () => {
        // An archived task is synchronized like any other: read only for the users, not for the sync.
        const task = byItem.get(item.itemId)!;
        // Read again: a cascade earlier in this pass (a parent archived or restored) may have changed it.
        task.archivedAt = (await prisma.task.findUnique({ where: { id: task.id }, select: { archivedAt: true } }))?.archivedAt ?? null;
        const local = localFields(task, link, maps, item.type, link.iterationFieldId ? ((fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null) : null);
        const remote = remoteFields(item, link, maps);
        // A snapshot of a former sync: closed without its reason, without archived state. Its issue just added to the
        // board again: what the new item carries (empty, or a default of the board) is no change made on GitHub, the
        // values of the task win.
        // Marked in its snapshot until a whole merge: a sync that failed before still takes it as one.
        const readdedPair = readded.has(task.id) || wasReadded(task.githubSnapshot);
        const stored = upgradedSnapshot(task.githubSnapshot as SyncFields | null);
        const snapshot = readdedPair ? readdedItemSnapshot(stored, link, issueFieldIds, remote) : stored;
        // An iteration of the last sync that is gone from the board (new ids given by GitHub) is no reference: the
        // item lost it, the sprint of the task wins.
        // An iteration on the board without sprint is compared as the item shows it (no counterpart).
        if (snapshot && 'iteration' in snapshot) {
          const iteration = snapshotIterationValue(snapshot.iteration, iterationIds, maps.iterationSprint);
          if (iteration === undefined) delete snapshot.iteration;
          else snapshot.iteration = iteration;
        }
        // Back on the board: compared with the last change of the issue, not with the addition of its new item.
        const result = mergeFields(local, remote, snapshot, changedAfter(task.updatedAt, remoteChangeDate(item, readdedPair)));
        if (Object.keys(result.push).length) {
          await pushValues(token, link, item, result.push, pushContext(task, (remote.assignees as string[]) ?? []));
          summary.pushed += 1;
        }
        if (await pushTrackedTime(token, link, item, task, maps.issueFields)) summary.pushed += Object.keys(result.push).length ? 0 : 1;
        const pulledData = await pullData(acceptedValues(result.pull, task), task, maps, item);
        // A parent pulled but refused by Ordo is not written: nothing follows from it.
        const parentPulled = 'parent' in pulledData;
        await prisma.task.update({
          where: { id: task.id },
          data: { ...pulledData, githubContentId: item.contentId, githubContentType: item.type, githubUrl: item.url, githubNumber: item.number },
        });
        // Archived or restored on the board: archived or restored in Ordo, with the usual cascade, on the lineage the
        // parent pulled just gave it (its sub-tasks follow in this pass, the ancestors it restores at the next sync).
        // Before the snapshot is written: a failure leaves the last one, and the next sync takes the archive again.
        if ('archived' in result.pull) await setTaskArchived(task.id, result.pull.archived === true);
        await prisma.task.update({ where: { id: task.id }, data: { githubSnapshot: toJson(result.snapshot) } });
        // Placed under a parent of another project of the tree: one inheriting its project follows it.
        if (parentPulled) await followParentProjects([task.id]);
        // A value its sub-tasks may inherit changed: they go by the new one when their turn comes.
        if (parentPulled || Object.keys(PULLED_INHERITED).some((key) => key in result.pull)) maps.inheritance = await loadTaskInheritance();
        if (Object.keys(result.pull).some((key) => key !== 'parent' || parentPulled) && !created.has(item.itemId)) summary.pulled += 1;
        // The number of the task follows its issue.
        if (item.type === 'ISSUE' && item.number !== null && (await matchIssueNumber(task.id, item.number))) summary.renumbered += 1;
        if (item.type === 'ISSUE') summary.comments += await syncComments(token, task.id, item, login);
      });
    }

    // New in the project tree: items of the board (an archived task never sent is not sent; one archived once linked
    // stays synchronized above). A task whose draft was deleted when it left the tree, or whose issue no longer exists,
    // back in it, is sent again, archived or not, whenever it was created (it was on a board already).
    const fresh = await prisma.task.findMany({
      where: {
        projectId: { in: tree },
        githubItemId: null,
        OR: [
          { githubContentType: null, archivedAt: null, ...(!link.pushExisting && { createdAt: { gte: link.createdAt } }) },
          { githubContentType: 'DRAFT_ISSUE' },
          { githubContentType: 'ISSUE', githubContentId: null },
          // Asked for: created before the link, or removed from the board (never sent again otherwise), active only.
          ...(send.size ? [{ id: { in: [...send] }, archivedAt: null, OR: [{ githubContentType: null }, { githubContentType: REMOVED_FROM_BOARD }] }] : []),
        ],
      },
      include,
      orderBy: { number: 'asc' },
    });
    for (const task of fresh) {
      await isolated(summary, async () => {
        const type: RemoteItem['type'] = link.repositoryId ? 'ISSUE' : 'DRAFT_ISSUE';
        const created = await createItem(token, {
          projectId: link.githubProjectId,
          repositoryId: link.repositoryId,
          title: task.label,
          body: task.description ?? '',
          assignees: link.syncAssignees ? assigneeLogins(task, maps) : [],
        });
        maps.taskByContent.set(created.contentId, task.id);
        // Linked at once, with what the item has now: a failure of the pushes below leaves the pair to the next sync
        // (merged as a first sync for the values not sent), never an item sent twice.
        const onItem: SyncFields = { title: task.label, body: task.description ?? '', archived: false, ...(link.syncAssignees && { assignees: assigneeLogins(task, maps) }), ...(created.type === 'ISSUE' && { closed: false }) };
        await prisma.task.update({
          where: { id: task.id },
          data: { githubItemId: created.itemId, githubContentId: created.contentId, githubContentType: created.type, githubUrl: created.url, githubNumber: created.number, githubSnapshot: toJson(onItem) },
        });
        // A parent sent in this same run is known now.
        const parent = task.parentId ? await prisma.task.findUnique({ where: { id: task.parentId }, select: { githubContentId: true, githubContentType: true } }) : null;
        const local = localFields({ ...task, parent }, link, maps, type);
        const item: RemoteItem = {
          ...created,
          title: task.label,
          body: task.description ?? '',
          closed: type === 'ISSUE' ? false : null,
          archived: false,
          closeReason: null,
          assignees: (local.assignees as string[]) ?? [],
          labels: [],
          repositoryId: link.repositoryId,
          parentId: null,
          issueTypeId: null,
          milestone: null,
          blockedBy: [],
          relatesTo: [],
          comments: [],
          updatedAt: new Date().toISOString(),
          contentUpdatedAt: new Date().toISOString(),
          fields: {},
        };
        const { title: _title, body: _body, assignees: _assignees, ...fields } = local;
        // A new item is empty: only the values set in Ordo are sent.
        const pushable = Object.fromEntries(Object.entries(fields).filter(([, value]) => !isUnmapped(value, 'ordo') && value !== null && value !== false && !(Array.isArray(value) && !value.length)));
        await pushValues(token, link, item, pushable, pushContext(task, item.assignees));
        await pushTrackedTime(token, link, item, task, maps.issueFields);
        // Values that could not be sent are seen as GitHub's (empty), so they are not sent again.
        const snapshot = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, isUnmapped(value, 'ordo') ? null : value]));
        await prisma.task.update({ where: { id: task.id }, data: { githubSnapshot: toJson(snapshot) } });
        if (created.number !== null && (await matchIssueNumber(task.id, created.number))) summary.renumbered += 1;
        if (type === 'ISSUE') summary.comments += await syncComments(token, task.id, item, login);
        summary.pushedNew += 1;
      }, failedTask(task.id));
    }

    await prisma.githubProjectLink.update({
      where: { id: link.id },
      data: { lastSyncAt: new Date(), lastSyncError: null, lastSyncSummary: toJson(summary), label: board.title, url: board.url },
    });
    return { summary, failures };
  } catch (error) {
    await prisma.githubProjectLink.update({ where: { id: link.id }, data: { lastSyncAt: new Date(), lastSyncError: errorMessage(error) } }).catch(() => undefined);
    throw error;
  } finally {
    running.delete(link.id);
    finish();
  }
}

/**
 * Synchronizes a project with its GitHub board (`runGithubSync`), then applies the rules of the tasks once.
 * @param {string} projectId Linked project.
 * @returns {Promise<SyncSummary>} What changed.
 */
export const syncGithubProject = automated(async function syncGithubProject(projectId: string): Promise<SyncSummary> {
  return (await runGithubSync(projectId)).summary;
});

/** What « Envoyer sur GitHub » did: the tasks now on GitHub, and why each other one is not. */
export interface GithubSendResult {
  sent: number;
  errors: string[];
}

/** Sync of a link sending tasks on request, then the rules of the tasks applied once. */
const syncSending = automated((projectId: string, send: ReadonlySet<string>) => runGithubSync(projectId, send));

/**
 * Sync of a link sending tasks on request, once the sync of the link running (the periodic one, or another request)
 * is over: waited for outside the lock of the workspace taken by the rules of the tasks (a sync running without it
 * may need it for its own writes), then tried again if another one started meanwhile.
 * @param {string} projectId Linked project.
 * @param {ReadonlySet<string>} send Tasks to send on request.
 * @returns {Promise<{ summary: SyncSummary, failures: Map<string, string> }>} What the sync did.
 */
async function sendWhenFree(projectId: string, send: ReadonlySet<string>): Promise<{ summary: SyncSummary; failures: Map<string, string> }> {
  for (;;) {
    const link = await prisma.githubProjectLink.findUnique({ where: { projectId }, select: { id: true } });
    if (link) await running.get(link.id);
    try {
      return await syncSending(projectId, send);
    } catch (error) {
      if (errorMessage(error) !== SYNC_RUNNING) throw error;
    }
  }
}

/**
 * « Envoyer sur GitHub »: sends tasks not on GitHub (never sent, created before the link, or removed from the board) to
 * the board of their project tree, by a sync of each link concerned (`sendWhenFree`, after the one running): each
 * becomes an item as a new task of the sync does (an issue of the repository of the link, or a draft), its mark of
 * removal cleared, then sends its parent, links and comments as any push; a task whose issue is to be added to the
 * board again (back in the tree with it) is by the same sync, as the sync does it. Refused, task by task
 * (`githubSendRefusal`): a task archived, on GitHub already, outside a linked tree, GitHub not connected (a link in
 * manual sync accepted). A sync that fails as a whole (its link deleted or GitHub disconnected while waiting
 * included) gives its error to each task of its link.
 * @param {string[]} ids Tasks.
 * @returns {Promise<GithubSendResult>} Tasks sent, and the errors of the others.
 */
export async function sendTasksToGithub(ids: string[]): Promise<GithubSendResult> {
  const connected = Boolean(await currentGithubConnection());
  const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, projectId: true, archivedAt: true, githubItemId: true, githubContentType: true } });
  const errors: string[] = ids.filter((id) => !tasks.some((task) => task.id === id)).map(() => 'Tâche introuvable.');
  const links = await linksByProject();
  // Tasks accepted, by linked project; among them those the sync sends only on request (never sent, or removed).
  const byProject = new Map<string, { asked: string[]; send: Set<string> }>();
  for (const task of tasks) {
    const link = task.projectId ? (links.get(task.projectId) ?? null) : null;
    const refusal = githubSendRefusal({ archived: task.archivedAt !== null, state: githubTaskState(task, Boolean(link)) }, connected);
    if (refusal || !link) {
      errors.push(refusal ?? GITHUB_SEND_REFUSALS.unlinked);
      continue;
    }
    const entry = byProject.get(link.projectId) ?? { asked: [], send: new Set<string>() };
    entry.asked.push(task.id);
    // An issue to add to the board again is the sync's own (a task whose issue is linked to another task meanwhile is
    // then removed from the board, not sent as a new issue).
    if (task.githubContentType === null || task.githubContentType === REMOVED_FROM_BOARD) entry.send.add(task.id);
    byProject.set(link.projectId, entry);
  }
  let sent = 0;
  for (const [projectId, { asked, send }] of byProject) {
    let failures: Map<string, string>;
    try {
      ({ failures } = await sendWhenFree(projectId, send));
    } catch (error) {
      errors.push(...asked.map(() => errorMessage(error)));
      continue;
    }
    const now = await prisma.task.findMany({ where: { id: { in: asked } }, select: { id: true, githubItemId: true } });
    for (const id of asked) {
      const task = now.find((entry) => entry.id === id);
      if (task?.githubItemId) sent += 1;
      else errors.push(failures.get(id) ?? 'La tâche n’a pas été envoyée sur GitHub : elle a changé pendant la synchronisation (archivée, transférée, supprimée, ou son issue liée à une autre tâche).');
    }
  }
  return { sent, errors };
}

/**
 * Synchronizes every enabled link now, then every ten minutes; failures are kept on the links.
 * @returns {void}
 */
export function scheduleGithubSync(): void {
  schedulePerWorkspace(
    'Synchronisation GitHub',
    async () => {
      if (!(await currentGithubConnection())) return;
      for (const link of await prisma.githubProjectLink.findMany({ where: { enabled: true }, select: { projectId: true } })) {
        await syncGithubProject(link.projectId).catch((error: unknown) => console.warn('Synchronisation GitHub en échec.', error));
      }
    },
    { delay: 30_000, interval: 10 * 60_000 },
  );
}
