import { prisma } from '../../db';
import { Prisma, type GithubProjectLink, type Task, type TaskComment } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { addTaskBlock, addTaskRelation, createTask, removeTaskBlock, removeTaskRelation } from '../tasks';
import {
  addIssueComment,
  boardById,
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
  setItemField,
  setRelatesTo,
  updateContent,
  updateIssueComment,
  type Board,
  type FieldValue,
  type RemoteItem,
} from './board';
import { githubToken } from './client';
import { isUnmapped, mergeFields, type SyncFields } from './merge';
import { currentWorkspaceId } from '../../workspace-context';
import { forEachWorkspace } from '../workspaces';

export interface SyncSummary {
  /** Tasks created from items, and items created from tasks. */
  pulledNew: number;
  pushedNew: number;
  /** Tasks and items updated. */
  pulled: number;
  pushed: number;
  /** Tasks whose item left the board (kept, unlinked). */
  unlinked: number;
  /** Sprints created or updated from the iterations. */
  sprints: number;
  /** Ordo sprints without iteration: to be created on GitHub (the API cannot give an iteration its dates). */
  sprintsSkipped: number;
  /** Tasks renumbered after their issue. */
  renumbered: number;
  /** Comments created, changed or deleted, on either side. */
  comments: number;
}

const linkedTask = { select: { id: true, githubContentId: true, githubContentType: true } } as const;
const include = {
  assignees: { select: { id: true, githubLogin: true } },
  tags: { select: { id: true, name: true } },
  sprints: { select: { id: true, startDate: true, githubIterationId: true } },
  parent: { select: { githubContentId: true, githubContentType: true } },
  milestone: { select: { title: true } },
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
  tags: { id: string; name: string }[];
  sprints: { id: string; startDate: Date; githubIterationId: string | null }[];
  parent: { githubContentId: string | null; githubContentType: string | null } | null;
  milestone: { title: string } | null;
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
  /** Contributor id by GitHub login. */
  contributorByLogin: Map<string, string>;
  /** Task id by GitHub issue or draft id. */
  taskByContent: Map<string, string>;
  /** Issue field of each board field showing one (issues only: drafts have none). */
  issueFields: Map<string, string>;
}

/** Content type of a task whose item was removed from the board: not sent again. */
export const REMOVED = 'REMOVED';

/**
 * Field value of an item as a synchronized value.
 * @param {FieldValue | undefined} value Field value.
 * @returns {string | number | null} Option, iteration, date or number.
 */
function fieldValue(value: FieldValue | undefined): string | number | null {
  return value?.optionId ?? value?.iterationId ?? value?.date ?? value?.number ?? null;
}

/**
 * Label names compared without case.
 * @param {string[]} names Names.
 * @returns {string[]} Folded, sorted names.
 */
const labelKeys = (names: string[]) => [...new Set(names.map((name) => name.trim().toLowerCase()))].sort();

/**
 * Issues of linked tasks (tasks without issue have no counterpart and are left alone on both sides).
 * @param {LinkedTask[]} tasks Tasks.
 * @returns {string[]} Issue node ids, sorted.
 */
const issuesOf = (tasks: LinkedTask[]) =>
  [...new Set(tasks.filter((task) => task.githubContentType === 'ISSUE' && task.githubContentId).map((task) => task.githubContentId!))].sort();

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
const trackedHours = (task: SyncedTask) =>
  Math.round((task.timeEntries.reduce((sum, entry) => sum + (entry.duration ?? 0) / Math.max(1, entry._count.tasks), 0) / 3600) * 100) / 100;

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

/**
 * Synchronized values of a task.
 * @param {SyncedTask} task Task.
 * @param {GithubProjectLink} link Board link.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem['type']} type Content of its item (a draft has no state, labels or parent).
 * @param {string | null} [currentIteration] Iteration of the item now. Optional.
 * @returns {SyncFields} Values.
 */
function localFields(task: SyncedTask, link: GithubProjectLink, maps: Maps, type: RemoteItem['type'], currentIteration: string | null = null): SyncFields {
  const fields: SyncFields = { title: task.title, body: task.description ?? '' };
  if (link.syncAssignees) fields.assignees = task.assignees.map((assignee) => assignee.githubLogin).filter((login): login is string => Boolean(login));
  if (type === 'ISSUE') {
    fields.closed = task.closedAt !== null;
    if (link.syncLabels) fields.labels = labelKeys(task.tags.map((tag) => tag.name));
    // The parent is an issue of the board, or has no counterpart.
    fields.parent = task.parentId ? (task.parent?.githubContentType === 'ISSUE' && task.parent.githubContentId ? task.parent.githubContentId : `ordo:${task.parentId}`) : null;
    fields.milestone = task.milestone?.title ?? null;
    fields.blockedBy = issuesOf(task.blockedBy.map((block) => block.blocker));
    fields.relatesTo = issuesOf(relatedOf(task));
  }
  if (usable(link.statusFieldId, maps, type)) fields.status = task.statusId ? (maps.statusOption[task.statusId] ?? `ordo:${task.statusId}`) : null;
  if (usable(link.priorityFieldId, maps, type)) fields.priority = task.priorityId ? (maps.priorityOption[task.priorityId] ?? `ordo:${task.priorityId}`) : null;
  if (syncsType(link, type) && (link.typeSource !== 'FIELD' || usable(link.typeFieldId, maps, type))) fields.type = task.typeId ? (maps.typeOption[task.typeId] ?? `ordo:${task.typeId}`) : null;
  if (link.iterationFieldId) {
    // A board item has one iteration, a task several sprints: the iteration of the item when it is one of them,
    // otherwise the latest sprint of the task.
    const current = currentIteration ? maps.iterationSprint.get(currentIteration) : undefined;
    const latest = [...task.sprints].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    fields.iteration =
      current && task.sprints.some((sprint) => sprint.id === current) ? currentIteration : latest ? (maps.sprintIteration.get(latest.id) ?? `ordo:${latest.id}`) : null;
  }
  if (usable(link.startFieldId, maps, type)) fields.start = task.startDate ? task.startDate.toISOString().slice(0, 10) : null;
  if (usable(link.endFieldId, maps, type)) fields.end = task.endDate ? task.endDate.toISOString().slice(0, 10) : null;
  if (usable(link.deadlineFieldId, maps, type)) fields.deadline = task.deadline ? task.deadline.toISOString().slice(0, 10) : null;
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
  // Issues without task (outside the board) are left alone on both sides.
  const known = (ids: string[]) => [...new Set(ids.filter((id) => maps.taskByContent.has(id)))].sort();
  const fields: SyncFields = { title: item.title, body: item.body };
  // Logins without contributor are left alone on both sides.
  if (link.syncAssignees) fields.assignees = item.assignees.filter((login) => maps.contributorByLogin.has(login));
  if (item.type === 'ISSUE') {
    fields.closed = item.closed;
    if (link.syncLabels) fields.labels = labelKeys(item.labels.map((label) => label.name));
    fields.parent = item.parentId ? (maps.taskByContent.has(item.parentId) ? item.parentId : `gh:${item.parentId}`) : null;
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
  if (link.iterationFieldId) fields.iteration = (fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null;
  if (usable(link.startFieldId, maps, item.type)) fields.start = (fieldValue(item.fields[link.startFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (usable(link.endFieldId, maps, item.type)) fields.end = (fieldValue(item.fields[link.endFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (usable(link.deadlineFieldId, maps, item.type)) fields.deadline = (fieldValue(item.fields[link.deadlineFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (usable(link.effortFieldId, maps, item.type)) fields.effort = (fieldValue(item.fields[link.effortFieldId]) as number | null) ?? null;
  return fields;
}

/**
 * Ids of a task and its descendants.
 * @param {string} taskId Task.
 * @returns {Promise<Set<string>>} Ids.
 */
async function subtree(taskId: string): Promise<Set<string>> {
  const ids = new Set([taskId]);
  for (let frontier = [taskId]; frontier.length; ) {
    const children = await prisma.task.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((child) => child.id).filter((id) => !ids.has(id));
    for (const id of frontier) ids.add(id);
  }
  return ids;
}

/**
 * Prisma data writing synchronized values on a task (tags missing in Ordo are created).
 * @param {SyncFields} values Values pulled from the item.
 * @param {SyncedTask} task Task.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem} item Item (label names and colors).
 * @returns {Promise<Prisma.TaskUpdateInput>} Data.
 */
async function pullData(values: SyncFields, task: SyncedTask, maps: Maps, item: RemoteItem): Promise<Prisma.TaskUpdateInput> {
  const data: Prisma.TaskUpdateInput = {};
  const day = (value: unknown) => (value ? new Date(`${String(value)}T00:00:00.000Z`) : null);
  if ('title' in values) data.title = String(values.title).trim().slice(0, 300) || task.title;
  if ('body' in values) data.description = values.body ? String(values.body) : null;
  if ('closed' in values) data.closedAt = values.closed ? (task.closedAt ?? new Date()) : null;
  if ('status' in values) data.status = values.status ? { connect: { id: maps.optionStatus.get(String(values.status))! } } : { disconnect: true };
  if ('priority' in values) data.priority = values.priority ? { connect: { id: maps.optionPriority.get(String(values.priority))! } } : { disconnect: true };
  if ('type' in values) data.type = values.type ? { connect: { id: maps.optionType.get(String(values.type))! } } : { disconnect: true };
  if ('deadline' in values) data.deadline = day(values.deadline);
  if ('milestone' in values) data.milestone = values.milestone ? { connect: { id: await milestoneOf(task.projectId, String(values.milestone)) } } : { disconnect: true };
  if ('blockedBy' in values) {
    const wanted = new Set((values.blockedBy as string[]).map((id) => maps.taskByContent.get(id)).filter((id): id is string => Boolean(id)));
    const current = task.blockedBy.map((block) => block.blocker).filter((blocker) => blocker.githubContentType === 'ISSUE' && blocker.githubContentId);
    for (const blocker of current) if (!wanted.has(blocker.id)) await removeTaskBlock(blocker.id, task.id);
    // A dependency Ordo refuses (circular, other project tree) is left out.
    for (const id of wanted) if (!current.some((blocker) => blocker.id === id)) await addTaskBlock(id, task.id).catch(() => undefined);
  }
  if ('relatesTo' in values) {
    const wanted = new Set((values.relatesTo as string[]).map((id) => maps.taskByContent.get(id)).filter((id): id is string => Boolean(id)));
    const current = relatedOf(task).filter((other) => other.githubContentType === 'ISSUE' && other.githubContentId);
    for (const other of current) if (!wanted.has(other.id)) await removeTaskRelation(task.id, other.id);
    for (const id of wanted) if (!current.some((other) => other.id === id)) await addTaskRelation(task.id, id).catch(() => undefined);
  }
  if ('iteration' in values) {
    // The sprint of the iteration is added: a task may be in several sprints, none is taken away from GitHub.
    const sprintId = values.iteration ? maps.iterationSprint.get(String(values.iteration)) : undefined;
    if (sprintId && !task.sprints.some((sprint) => sprint.id === sprintId)) data.sprints = { connect: [{ id: sprintId }] };
  }
  if ('start' in values) data.startDate = day(values.start);
  if ('end' in values) data.endDate = day(values.end);
  if ('effort' in values) data.effort = typeof values.effort === 'number' ? values.effort : null;
  if ('assignees' in values) {
    // Assignees without GitHub login stay.
    const kept = task.assignees.filter((assignee) => !assignee.githubLogin).map((assignee) => assignee.id);
    const synced = (values.assignees as string[]).map((login) => maps.contributorByLogin.get(login)).filter((id): id is string => Boolean(id));
    data.assignees = { set: [...new Set([...kept, ...synced])].map((id) => ({ id })) };
  }
  if ('labels' in values) {
    const tags = await prisma.taskTag.findMany();
    const ids: string[] = [];
    for (const key of values.labels as string[]) {
      let tag = tags.find((item) => item.name.toLowerCase() === key);
      if (!tag) {
        const label = item.labels.find((entry) => entry.name.toLowerCase() === key);
        const { _max } = await prisma.taskTag.aggregate({ _max: { position: true } });
        tag = await prisma.taskTag.create({ data: { name: (label?.name ?? key).slice(0, 60), color: '#868e96', position: (_max.position ?? -1) + 1 } });
        tags.push(tag);
      }
      ids.push(tag.id);
    }
    data.tags = { set: ids.map((id) => ({ id })) };
  }
  if ('parent' in values) {
    const parentId = values.parent ? maps.taskByContent.get(String(values.parent)) : null;
    // A task cannot go under itself or one of its sub-tasks.
    if (!parentId || !(await subtree(task.id)).has(parentId)) data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
  }
  return data;
}

/**
 * Milestone of a project with this title, created when there is none.
 * @param {string} projectId Project of the task.
 * @param {string} title Milestone title on GitHub.
 * @returns {Promise<string>} Milestone id.
 */
async function milestoneOf(projectId: string, title: string): Promise<string> {
  const found = await prisma.milestone.findFirst({ where: { projectId, title }, select: { id: true } });
  if (found) return found.id;
  const { _max } = await prisma.milestone.aggregate({ where: { projectId }, _max: { position: true } });
  return (await prisma.milestone.create({ data: { projectId, title: title.slice(0, 200), position: (_max.position ?? -1) + 1 }, select: { id: true } })).id;
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
 * @param {{ name: string }[]} context.tags Tags of the task (names as written in Ordo).
 * @param {LabelCache} context.labels Labels of the repositories.
 * @param {MilestoneCache} context.milestones Milestones of the repositories.
 * @param {SentRelations} context.sent Relationships already sent in this sync.
 * @param {Map<string, string>} context.taskByContent Tasks by issue: other issues are left alone.
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
    tags: { name: string; color?: string }[];
    labels: LabelCache;
    milestones: MilestoneCache;
    sent: SentRelations;
    taskByContent: Map<string, string>;
    issueFields: Map<string, string>;
  },
): Promise<void> {
  const assignees = values.assignees as string[] | undefined;
  await updateContent(token, item.type, item.contentId, {
    title: 'title' in values ? String(values.title) : undefined,
    body: 'body' in values ? String(values.body ?? '') : undefined,
    closed: 'closed' in values ? Boolean(values.closed) : undefined,
    assignees: assignees && {
      add: assignees.filter((login) => !knownBefore.includes(login)),
      remove: knownBefore.filter((login) => !assignees.includes(login)),
      all: [...item.assignees.filter((login) => !knownBefore.includes(login)), ...assignees],
    },
  });
  if ('labels' in values && item.repositoryId) {
    let repository = labels.get(item.repositoryId);
    if (!repository) {
      repository = new Map((await repositoryLabels(token, item.repositoryId)).map((label) => [label.name.toLowerCase(), label.id]));
      labels.set(item.repositoryId, repository);
    }
    const wanted = values.labels as string[];
    const add: string[] = [];
    for (const key of wanted) {
      if (item.labels.some((label) => label.name.toLowerCase() === key)) continue;
      let id = repository.get(key);
      if (!id) {
        // A tag without label in the repository: created with the tag's name and color.
        const tag = tags.find((entry) => entry.name.toLowerCase() === key);
        id = (await createLabel(token, item.repositoryId, tag?.name ?? key, (tag?.color ?? '#868e96').replace('#', ''))).id;
        repository.set(key, id);
      }
      add.push(id);
    }
    const remove = item.labels.filter((label) => !wanted.includes(label.name.toLowerCase())).map((label) => label.id);
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
        // An Ordo milestone without counterpart in the repository: created with its title.
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
}

/**
 * Synchronizes the comments of a task and its issue, both ways: new ones on each side are copied, edited ones
 * merged against their last synchronized body (the latest edit wins a conflict), and a comment deleted on
 * GitHub is deleted in Ordo (one deleted in Ordo was deleted on GitHub at once).
 * @param {string} token Token.
 * @param {string} taskId Task.
 * @param {RemoteItem} item Issue item.
 * @param {string} login Login of the connected account (its comments show no author).
 * @returns {Promise<number>} Comments created, changed or deleted.
 */
async function syncComments(token: string, taskId: string, item: RemoteItem, login: string): Promise<number> {
  const local: TaskComment[] = await prisma.taskComment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } });
  const remote = new Map(item.comments.map((comment) => [comment.id, comment]));
  let changes = 0;
  for (const comment of local) {
    if (!comment.githubCommentId) {
      const id = await addIssueComment(token, item.contentId, comment.body);
      await prisma.taskComment.update({ where: { id: comment.id }, data: { githubCommentId: id, githubBody: comment.body } });
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
    if (comment.body === theirs.body) {
      if (comment.githubBody !== theirs.body) await prisma.taskComment.update({ where: { id: comment.id }, data: { githubBody: theirs.body } });
      continue;
    }
    const pull = comment.body === comment.githubBody || (theirs.body !== comment.githubBody && theirs.updatedAt > comment.updatedAt.toISOString());
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
        githubAuthor: comment.author && comment.author !== login ? comment.author : null,
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
async function projectTree(projectId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const ids = [projectId];
  for (let index = 0; index < ids.length; index += 1) ids.push(...projects.filter((project) => project.parentId === ids[index]).map((project) => project.id));
  return ids;
}

/**
 * Sprint name compared without case or accents.
 * @param {string} name Name.
 * @returns {string} Folded name.
 */
const foldName = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Pairs the iterations of the board with the sprints of the project tree, without losing anything. An iteration
 * without sprint takes the Ordo sprint of the same name (a sprint created from it by an earlier sync gives that
 * sprint its tasks and is deleted), or becomes a new sprint with its dates. Ordo is the reference for the name and
 * dates of a paired sprint. Iterations are never written: the API lays the iterations of a field end to end, one
 * period of the field's duration each, whatever dates are asked, so the sprints without iteration are only
 * counted (to be created on GitHub, where they will be paired by name). A sprint whose iteration is gone is
 * unpaired.
 * @param {Board} board Board.
 * @param {GithubProjectLink} link Board link.
 * @param {string[]} tree Projects of the tree.
 * @returns {Promise<{ changed: number, unpaired: number }>} Sprints created or paired; sprints without iteration.
 */
async function syncIterations(board: Board, link: GithubProjectLink, tree: string[]): Promise<{ changed: number; unpaired: number }> {
  const field = board.fields.find((item) => item.id === link.iterationFieldId);
  if (!field) return { changed: 0, unpaired: 0 };
  let changed = 0;
  const sprints = await prisma.sprint.findMany({ where: { projectId: { in: tree } }, orderBy: { createdAt: 'asc' } });
  const iterationIds = new Set(field.iterations.map((iteration) => iteration.id));

  // Iterations gone from the board: their sprints can be paired again.
  for (const sprint of sprints.filter((item) => item.githubIterationId && !iterationIds.has(item.githubIterationId))) {
    await prisma.sprint.update({ where: { id: sprint.id }, data: { githubIterationId: null } });
    sprint.githubIterationId = null;
  }

  for (const iteration of field.iterations) {
    let sprint = sprints.find((item) => item.githubIterationId === iteration.id);
    const twin = sprints.find((item) => !item.githubIterationId && item !== sprint && foldName(item.name) === foldName(iteration.title));
    if (twin) {
      if (sprint) {
        // A sprint created from the iteration by an earlier sync: its tasks join the Ordo sprint, which replaces it.
        const tasks = await prisma.task.findMany({ where: { sprints: { some: { id: sprint.id } } }, select: { id: true } });
        if (tasks.length) await prisma.sprint.update({ where: { id: twin.id }, data: { tasks: { connect: tasks } } });
        await prisma.sprint.delete({ where: { id: sprint.id } });
        sprints.splice(sprints.indexOf(sprint), 1);
      }
      await prisma.sprint.update({ where: { id: twin.id }, data: { githubIterationId: iteration.id } });
      twin.githubIterationId = iteration.id;
      sprint = twin;
      changed += 1;
    }
    if (!sprint) {
      const startDate = new Date(`${iteration.startDate}T00:00:00.000Z`);
      const endDate = new Date(startDate.getTime() + (iteration.duration - 1) * 86_400_000);
      sprints.push(await prisma.sprint.create({ data: { projectId: link.projectId, name: iteration.title.slice(0, 120), startDate, endDate, githubIterationId: iteration.id } }));
      changed += 1;
    }
  }
  return { changed, unpaired: sprints.filter((item) => !item.githubIterationId).length };
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

const running = new Set<string>();

/**
 * Synchronizes a project with its GitHub board, both ways: iterations become sprints; items new on the board
 * become tasks of the project, tasks new in the project tree become items (draft issues, or issues of the
 * chosen repository); linked pairs are merged field by field against the last sync (labels with tags,
 * sub-issues with sub-tasks), then the comments of issues. A task whose item left the board is kept,
 * unlinked, and not sent again.
 * @param {string} projectId Linked project.
 * @returns {Promise<SyncSummary>} What changed.
 */
export async function syncGithubProject(projectId: string): Promise<SyncSummary> {
  const link = await prisma.githubProjectLink.findUnique({ where: { projectId } });
  if (!link) throw notFound('Lien GitHub');
  if (running.has(link.id)) throw clientError('BAD_USER_INPUT', 'Une synchronisation de ce projet est déjà en cours.');
  running.add(link.id);
  const summary: SyncSummary = { pulledNew: 0, pushedNew: 0, pulled: 0, pushed: 0, unlinked: 0, sprints: 0, sprintsSkipped: 0, renumbered: 0, comments: 0 };
  try {
    const token = await githubToken();
    const login = (await prisma.githubConnection.findUnique({ where: { workspaceId: currentWorkspaceId() } }))?.login ?? '';
    const board = await boardById(token, link.githubProjectId);
    const tree = await projectTree(projectId);
    const iterations = await syncIterations(board, link, tree);
    summary.sprints = iterations.changed;
    summary.sprintsSkipped = iterations.unpaired;
    const items = await boardItems(token, board);
    const itemIds = items.map((item) => item.itemId);

    // Tasks of the tree whose item is gone: unlinked, and marked so that they are not sent back.
    const gone = await prisma.task.findMany({ where: { projectId: { in: tree }, githubItemId: { not: null, notIn: itemIds } }, select: { id: true } });
    if (gone.length) {
      await prisma.task.updateMany({
        where: { id: { in: gone.map((task) => task.id) } },
        data: { githubItemId: null, githubContentId: null, githubContentType: REMOVED, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull },
      });
      await prisma.taskComment.updateMany({ where: { taskId: { in: gone.map((task) => task.id) } }, data: { githubCommentId: null, githubBody: null } });
      summary.unlinked = gone.length;
    }

    // Items new on the board: tasks of the project (their fields come with the merge below).
    const known = new Set((await prisma.task.findMany({ where: { githubItemId: { in: itemIds } }, select: { githubItemId: true } })).map((task) => task.githubItemId));
    const created = new Set(items.filter((entry) => !known.has(entry.itemId)).map((entry) => entry.itemId));
    for (const item of items.filter((entry) => created.has(entry.itemId))) {
      const task = await createTask({ title: item.title.trim().slice(0, 300) || `Item GitHub ${item.number ?? ''}`.trim(), projectId });
      // Empty snapshot except the title: every GitHub value is new, so it is pulled.
      await prisma.task.update({
        where: { id: task.id },
        data: {
          githubItemId: item.itemId,
          githubContentId: item.contentId,
          githubContentType: item.type,
          githubUrl: item.url,
          githubNumber: item.number,
          githubSnapshot: { title: task.title, body: '', assignees: [], labels: [], parent: null, closed: false, status: null, priority: null, iteration: null, start: null, end: null, effort: null },
        },
      });
      summary.pulledNew += 1;
    }

    const statusOption = link.statusOptions as Record<string, string>;
    const priorityOption = link.priorityOptions as Record<string, string>;
    const typeOption = link.typeSource ? (link.typeOptions as Record<string, string>) : {};
    const sprints = await prisma.sprint.findMany({ where: { githubIterationId: { not: null } }, select: { id: true, githubIterationId: true } });
    const contributors = await prisma.contributor.findMany({ where: { githubLogin: { not: null } }, select: { id: true, githubLogin: true } });
    const linked = await prisma.task.findMany({ where: { githubItemId: { in: itemIds } }, include });
    const maps: Maps = {
      statusOption,
      optionStatus: new Map(Object.entries(statusOption).reverse().map(([status, option]) => [option, status])),
      priorityOption,
      optionPriority: new Map(Object.entries(priorityOption).reverse().map(([priority, option]) => [option, priority])),
      typeOption,
      optionType: new Map(Object.entries(typeOption).reverse().map(([type, option]) => [option, type])),
      sprintIteration: new Map(sprints.map((sprint) => [sprint.id, sprint.githubIterationId!])),
      iterationSprint: new Map(sprints.map((sprint) => [sprint.githubIterationId!, sprint.id])),
      contributorByLogin: new Map(contributors.map((contributor) => [contributor.githubLogin!, contributor.id])),
      taskByContent: new Map(linked.map((task) => [task.githubContentId!, task.id])),
      issueFields: new Map(board.fields.filter((field) => field.issueFieldId).map((field) => [field.id, field.issueFieldId!])),
    };
    const labels: LabelCache = new Map();
    const milestones: MilestoneCache = new Map();
    const sent: SentRelations = new Set();
    const tagColors = new Map((await prisma.taskTag.findMany()).map((tag) => [tag.name.toLowerCase(), tag.color]));
    const byItem = new Map(linked.map((task) => [task.githubItemId!, task]));
    const iterationIds = new Set(board.fields.find((field) => field.id === link.iterationFieldId)?.iterations.map((iteration) => iteration.id) ?? []);

    for (const item of items) {
      const task = byItem.get(item.itemId)!;
      const local = localFields(task, link, maps, item.type, link.iterationFieldId ? ((fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null) : null);
      const remote = remoteFields(item, link, maps);
      // An iteration of the last sync that is gone from the board (new ids given by GitHub) is no reference: the
      // item lost it, the sprint of the task wins.
      const snapshot = task.githubSnapshot ? { ...(task.githubSnapshot as SyncFields) } : null;
      if (snapshot && typeof snapshot.iteration === 'string' && !iterationIds.has(snapshot.iteration)) delete snapshot.iteration;
      const result = mergeFields(local, remote, snapshot, task.updatedAt.toISOString() > item.updatedAt);
      if (Object.keys(result.push).length) {
        await pushValues(token, link, item, result.push, {
          knownBefore: (remote.assignees as string[]) ?? [],
          tags: task.tags.map((tag) => ({ name: tag.name, color: tagColors.get(tag.name.toLowerCase()) })),
          labels,
          milestones,
          sent,
          taskByContent: maps.taskByContent,
          issueFields: maps.issueFields,
        });
        summary.pushed += 1;
      }
      if (await pushTrackedTime(token, link, item, task, maps.issueFields)) summary.pushed += Object.keys(result.push).length ? 0 : 1;
      await prisma.task.update({
        where: { id: task.id },
        data: {
          ...(await pullData(result.pull, task, maps, item)),
          githubContentId: item.contentId,
          githubContentType: item.type,
          githubUrl: item.url,
          githubNumber: item.number,
          githubSnapshot: result.snapshot as Prisma.InputJsonValue,
        },
      });
      if (Object.keys(result.pull).length && !created.has(item.itemId)) summary.pulled += 1;
      // The number of the task follows its issue.
      if (item.type === 'ISSUE' && item.number !== null && (await matchIssueNumber(task.id, item.number))) summary.renumbered += 1;
      if (item.type === 'ISSUE') summary.comments += await syncComments(token, task.id, item, login);
    }

    // New in the project tree: items of the board.
    const fresh = await prisma.task.findMany({
      where: { projectId: { in: tree }, githubItemId: null, githubContentType: null, archivedAt: null, ...(!link.pushExisting && { createdAt: { gte: link.createdAt } }) },
      include,
      orderBy: { number: 'asc' },
    });
    for (const task of fresh) {
      const type: RemoteItem['type'] = link.repositoryId ? 'ISSUE' : 'DRAFT_ISSUE';
      const created = await createItem(token, {
        projectId: link.githubProjectId,
        repositoryId: link.repositoryId,
        title: task.title,
        body: task.description ?? '',
        assignees: link.syncAssignees ? task.assignees.map((assignee) => assignee.githubLogin).filter((login): login is string => Boolean(login)) : [],
      });
      maps.taskByContent.set(created.contentId, task.id);
      // A parent sent in this same run is known now.
      const parent = task.parentId ? await prisma.task.findUnique({ where: { id: task.parentId }, select: { githubContentId: true, githubContentType: true } }) : null;
      const local = localFields({ ...task, parent }, link, maps, type);
      const item: RemoteItem = {
        ...created,
        title: task.title,
        body: task.description ?? '',
        closed: type === 'ISSUE' ? false : null,
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
        fields: {},
      };
      const { title: _title, body: _body, assignees: _assignees, ...fields } = local; // eslint-disable-line @typescript-eslint/no-unused-vars
      // A new item is empty: only the values set in Ordo are sent.
      const pushable = Object.fromEntries(Object.entries(fields).filter(([, value]) => !isUnmapped(value, 'ordo') && value !== null && value !== false && !(Array.isArray(value) && !value.length)));
      await pushValues(token, link, item, pushable, {
        knownBefore: item.assignees,
        tags: task.tags.map((tag) => ({ name: tag.name, color: tagColors.get(tag.name.toLowerCase()) })),
        labels,
        milestones,
        sent,
        taskByContent: maps.taskByContent,
        issueFields: maps.issueFields,
      });
      await pushTrackedTime(token, link, item, task, maps.issueFields);
      // Values that could not be sent are seen as GitHub's (empty), so they are not sent again.
      const snapshot = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, isUnmapped(value, 'ordo') ? null : value]));
      await prisma.task.update({
        where: { id: task.id },
        data: {
          githubItemId: created.itemId,
          githubContentId: created.contentId,
          githubContentType: created.type,
          githubUrl: created.url,
          githubNumber: created.number,
          githubSnapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      if (created.number !== null && (await matchIssueNumber(task.id, created.number))) summary.renumbered += 1;
      if (type === 'ISSUE') summary.comments += await syncComments(token, task.id, item, login);
      summary.pushedNew += 1;
    }

    await prisma.githubProjectLink.update({
      where: { id: link.id },
      data: { lastSyncAt: new Date(), lastSyncError: null, lastSyncSummary: summary as unknown as Prisma.InputJsonValue, title: board.title, url: board.url },
    });
    return summary;
  } catch (error) {
    await prisma.githubProjectLink
      .update({ where: { id: link.id }, data: { lastSyncAt: new Date(), lastSyncError: error instanceof Error ? error.message : String(error) } })
      .catch(() => undefined);
    throw error;
  } finally {
    running.delete(link.id);
  }
}

/**
 * Synchronizes every enabled link now, then every ten minutes; failures are kept on the links.
 * @returns {void}
 */
export function scheduleGithubSync(): void {
  const run = () =>
    forEachWorkspace(async () => {
      if (!(await prisma.githubConnection.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { id: true } }))) return;
      for (const link of await prisma.githubProjectLink.findMany({ where: { enabled: true }, select: { projectId: true } })) {
        await syncGithubProject(link.projectId).catch((error: unknown) => console.warn('Synchronisation GitHub en échec.', error));
      }
    });
  setTimeout(() => void run(), 30_000);
  setInterval(() => void run(), 10 * 60_000);
}
