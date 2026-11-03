import { prisma } from '../../db';
import { Prisma, type GithubProjectLink, type Task, type TaskComment } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { createTask } from '../tasks';
import {
  addIssueComment,
  boardById,
  boardItems,
  createItem,
  createLabel,
  repositoryLabels,
  setIssueLabels,
  setIssueParent,
  setItemField,
  updateContent,
  updateIssueComment,
  type Board,
  type FieldValue,
  type RemoteItem,
} from './board';
import { githubToken } from './client';
import { isUnmapped, mergeFields, type SyncFields } from './merge';

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
  /** Comments created, changed or deleted, on either side. */
  comments: number;
}

const include = {
  assignees: { select: { id: true, githubLogin: true } },
  tags: { select: { id: true, name: true } },
  parent: { select: { githubContentId: true, githubContentType: true } },
} as const;
type SyncedTask = Task & {
  assignees: { id: string; githubLogin: string | null }[];
  tags: { id: string; name: string }[];
  parent: { githubContentId: string | null; githubContentType: string | null } | null;
};

/** What a sync needs to translate values between both sides. */
interface Maps {
  statusOption: Record<string, string>;
  optionStatus: Map<string, string>;
  priorityOption: Record<string, string>;
  optionPriority: Map<string, string>;
  sprintIteration: Map<string, string>;
  iterationSprint: Map<string, string>;
  /** Contributor id by GitHub login. */
  contributorByLogin: Map<string, string>;
  /** Task id by GitHub issue or draft id. */
  taskByContent: Map<string, string>;
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
 * Synchronized values of a task.
 * @param {SyncedTask} task Task.
 * @param {GithubProjectLink} link Board link.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem['type']} type Content of its item (a draft has no state, labels or parent).
 * @returns {SyncFields} Values.
 */
function localFields(task: SyncedTask, link: GithubProjectLink, maps: Maps, type: RemoteItem['type']): SyncFields {
  const fields: SyncFields = {
    title: task.title,
    body: task.description ?? '',
    assignees: task.assignees.map((assignee) => assignee.githubLogin).filter((login): login is string => Boolean(login)),
  };
  if (type === 'ISSUE') {
    fields.closed = task.closedAt !== null;
    fields.labels = labelKeys(task.tags.map((tag) => tag.name));
    // The parent is an issue of the board, or has no counterpart.
    fields.parent = task.parentId ? (task.parent?.githubContentType === 'ISSUE' && task.parent.githubContentId ? task.parent.githubContentId : `ordo:${task.parentId}`) : null;
  }
  if (link.statusFieldId) fields.status = task.statusId ? (maps.statusOption[task.statusId] ?? `ordo:${task.statusId}`) : null;
  if (link.priorityFieldId) fields.priority = task.priorityId ? (maps.priorityOption[task.priorityId] ?? `ordo:${task.priorityId}`) : null;
  if (link.iterationFieldId) fields.iteration = task.sprintId ? (maps.sprintIteration.get(task.sprintId) ?? `ordo:${task.sprintId}`) : null;
  if (link.startFieldId) fields.start = task.startDate ? task.startDate.toISOString().slice(0, 10) : null;
  if (link.endFieldId) fields.end = task.endDate ? task.endDate.toISOString().slice(0, 10) : null;
  if (link.effortFieldId) fields.effort = task.effort;
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
  const fields: SyncFields = {
    title: item.title,
    body: item.body,
    // Logins without contributor are left alone on both sides.
    assignees: item.assignees.filter((login) => maps.contributorByLogin.has(login)),
  };
  if (item.type === 'ISSUE') {
    fields.closed = item.closed;
    fields.labels = labelKeys(item.labels.map((label) => label.name));
    fields.parent = item.parentId ? (maps.taskByContent.has(item.parentId) ? item.parentId : `gh:${item.parentId}`) : null;
  }
  if (link.statusFieldId) fields.status = option(link.statusFieldId, maps.optionStatus);
  if (link.priorityFieldId) fields.priority = option(link.priorityFieldId, maps.optionPriority);
  if (link.iterationFieldId) fields.iteration = (fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null;
  if (link.startFieldId) fields.start = (fieldValue(item.fields[link.startFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (link.endFieldId) fields.end = (fieldValue(item.fields[link.endFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (link.effortFieldId) fields.effort = (fieldValue(item.fields[link.effortFieldId]) as number | null) ?? null;
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
  if ('iteration' in values) {
    const sprintId = values.iteration ? maps.iterationSprint.get(String(values.iteration)) : undefined;
    data.sprint = sprintId ? { connect: { id: sprintId } } : { disconnect: true };
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

/** Labels of the repositories met during a sync: name (lowercase) → id. */
type LabelCache = Map<string, Map<string, string>>;

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
 * @returns {Promise<void>}
 */
async function pushValues(
  token: string,
  link: GithubProjectLink,
  item: RemoteItem,
  values: SyncFields,
  { knownBefore, tags, labels }: { knownBefore: string[]; tags: { name: string; color?: string }[]; labels: LabelCache },
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
  const target = (fieldId: string) => ({ projectId: link.githubProjectId, itemId: item.itemId, fieldId });
  const fields: [keyof SyncFields, string | null, (value: NonNullable<SyncFields[keyof SyncFields]>) => FieldValue][] = [
    ['status', link.statusFieldId, (value) => ({ optionId: String(value) })],
    ['priority', link.priorityFieldId, (value) => ({ optionId: String(value) })],
    ['iteration', link.iterationFieldId, (value) => ({ iterationId: String(value) })],
    ['start', link.startFieldId, (value) => ({ date: String(value) })],
    ['end', link.endFieldId, (value) => ({ date: String(value) })],
    ['effort', link.effortFieldId, (value) => ({ number: Number(value) })],
  ];
  for (const [field, fieldId, toValue] of fields) {
    if (!fieldId || !(field in values)) continue;
    const value = values[field];
    await setItemField(token, target(fieldId), value === null || value === undefined ? null : toValue(value));
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
 * Mirrors the iterations of the board as sprints of the project (created, renamed, dates updated).
 * @param {Board} board Board.
 * @param {GithubProjectLink} link Board link.
 * @returns {Promise<number>} Sprints created or updated.
 */
async function syncIterations(board: Board, link: GithubProjectLink): Promise<number> {
  const field = board.fields.find((item) => item.id === link.iterationFieldId);
  if (!field) return 0;
  let changed = 0;
  for (const iteration of field.iterations) {
    const startDate = new Date(`${iteration.startDate}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + (iteration.duration - 1) * 86_400_000);
    const sprint = await prisma.sprint.findUnique({ where: { githubIterationId: iteration.id } });
    if (!sprint) {
      await prisma.sprint.create({ data: { projectId: link.projectId, name: iteration.title.slice(0, 120), startDate, endDate, githubIterationId: iteration.id } });
      changed += 1;
    } else if (sprint.name !== iteration.title || sprint.startDate.getTime() !== startDate.getTime() || sprint.endDate.getTime() !== endDate.getTime()) {
      await prisma.sprint.update({ where: { id: sprint.id }, data: { name: iteration.title.slice(0, 120), startDate, endDate } });
      changed += 1;
    }
  }
  return changed;
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
  const summary: SyncSummary = { pulledNew: 0, pushedNew: 0, pulled: 0, pushed: 0, unlinked: 0, sprints: 0, comments: 0 };
  try {
    const token = await githubToken();
    const login = (await prisma.githubConnection.findUnique({ where: { id: 'github' } }))?.login ?? '';
    const board = await boardById(token, link.githubProjectId);
    summary.sprints = await syncIterations(board, link);
    const items = await boardItems(token, link.githubProjectId);
    const itemIds = items.map((item) => item.itemId);
    const tree = await projectTree(projectId);

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
    const sprints = await prisma.sprint.findMany({ where: { githubIterationId: { not: null } }, select: { id: true, githubIterationId: true } });
    const contributors = await prisma.contributor.findMany({ where: { githubLogin: { not: null } }, select: { id: true, githubLogin: true } });
    const linked = await prisma.task.findMany({ where: { githubItemId: { in: itemIds } }, include });
    const maps: Maps = {
      statusOption,
      optionStatus: new Map(Object.entries(statusOption).reverse().map(([status, option]) => [option, status])),
      priorityOption,
      optionPriority: new Map(Object.entries(priorityOption).reverse().map(([priority, option]) => [option, priority])),
      sprintIteration: new Map(sprints.map((sprint) => [sprint.id, sprint.githubIterationId!])),
      iterationSprint: new Map(sprints.map((sprint) => [sprint.githubIterationId!, sprint.id])),
      contributorByLogin: new Map(contributors.map((contributor) => [contributor.githubLogin!, contributor.id])),
      taskByContent: new Map(linked.map((task) => [task.githubContentId!, task.id])),
    };
    const labels: LabelCache = new Map();
    const tagColors = new Map((await prisma.taskTag.findMany()).map((tag) => [tag.name.toLowerCase(), tag.color]));
    const byItem = new Map(linked.map((task) => [task.githubItemId!, task]));

    for (const item of items) {
      const task = byItem.get(item.itemId)!;
      const local = localFields(task, link, maps, item.type);
      const remote = remoteFields(item, link, maps);
      const result = mergeFields(local, remote, task.githubSnapshot as SyncFields | null, task.updatedAt.toISOString() > item.updatedAt);
      if (Object.keys(result.push).length) {
        await pushValues(token, link, item, result.push, {
          knownBefore: (remote.assignees as string[]) ?? [],
          tags: task.tags.map((tag) => ({ name: tag.name, color: tagColors.get(tag.name.toLowerCase()) })),
          labels,
        });
        summary.pushed += 1;
      }
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
        assignees: task.assignees.map((assignee) => assignee.githubLogin).filter((login): login is string => Boolean(login)),
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
        comments: [],
        updatedAt: new Date().toISOString(),
        fields: {},
      };
      const { title: _title, body: _body, assignees: _assignees, ...fields } = local; // eslint-disable-line @typescript-eslint/no-unused-vars
      const pushable = Object.fromEntries(
        Object.entries(fields).filter(([key, value]) => !isUnmapped(value, 'ordo') && !(key === 'closed' && !value) && !(key === 'labels' && !(value as string[]).length) && !(key === 'parent' && !value)),
      );
      await pushValues(token, link, item, pushable, { knownBefore: item.assignees, tags: task.tags.map((tag) => ({ name: tag.name, color: tagColors.get(tag.name.toLowerCase()) })), labels });
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
  const run = async () => {
    if (!(await prisma.githubConnection.findUnique({ where: { id: 'github' }, select: { id: true } }))) return;
    for (const link of await prisma.githubProjectLink.findMany({ where: { enabled: true }, select: { projectId: true } })) {
      await syncGithubProject(link.projectId).catch((error: unknown) => console.warn('Synchronisation GitHub en échec.', error));
    }
  };
  setTimeout(() => void run(), 30_000);
  setInterval(() => void run(), 10 * 60_000);
}
