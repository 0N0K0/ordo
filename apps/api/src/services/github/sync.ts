import { prisma } from '../../db';
import { Prisma, type GithubProjectLink, type Task } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { createTask } from '../tasks';
import { boardById, boardItems, createItem, setItemField, updateContent, type Board, type FieldValue, type RemoteItem } from './board';
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
}

type TaskWithAssignees = Task & { assignees: { id: string; githubLogin: string | null }[] };

/** What a sync needs to translate values: option and iteration correspondences, known GitHub logins. */
interface Maps {
  statusOption: Record<string, string>;
  optionStatus: Map<string, string>;
  priorityOption: Record<string, string>;
  optionPriority: Map<string, string>;
  sprintIteration: Map<string, string>;
  iterationSprint: Map<string, string>;
  /** Contributor id by GitHub login. */
  contributorByLogin: Map<string, string>;
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
 * Synchronized values of a task.
 * @param {TaskWithAssignees} task Task.
 * @param {GithubProjectLink} link Board link.
 * @param {Maps} maps Correspondences.
 * @param {RemoteItem['type']} type Content of its item (a draft has no open / closed state).
 * @returns {SyncFields} Values.
 */
function localFields(task: TaskWithAssignees, link: GithubProjectLink, maps: Maps, type: RemoteItem['type']): SyncFields {
  const fields: SyncFields = {
    title: task.title,
    body: task.description ?? '',
    assignees: task.assignees.map((assignee) => assignee.githubLogin).filter((login): login is string => Boolean(login)),
  };
  if (type === 'ISSUE') fields.closed = task.closedAt !== null;
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
  if (item.type === 'ISSUE') fields.closed = item.closed;
  if (link.statusFieldId) fields.status = option(link.statusFieldId, maps.optionStatus);
  if (link.priorityFieldId) fields.priority = option(link.priorityFieldId, maps.optionPriority);
  if (link.iterationFieldId) fields.iteration = (fieldValue(item.fields[link.iterationFieldId]) as string | null) ?? null;
  if (link.startFieldId) fields.start = (fieldValue(item.fields[link.startFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (link.endFieldId) fields.end = (fieldValue(item.fields[link.endFieldId]) as string | null)?.slice(0, 10) ?? null;
  if (link.effortFieldId) fields.effort = (fieldValue(item.fields[link.effortFieldId]) as number | null) ?? null;
  return fields;
}

/**
 * Prisma data writing synchronized values on a task.
 * @param {SyncFields} values Values pulled from the item.
 * @param {TaskWithAssignees} task Task.
 * @param {Maps} maps Correspondences.
 * @returns {Prisma.TaskUpdateInput} Data.
 */
function pullData(values: SyncFields, task: TaskWithAssignees, maps: Maps): Prisma.TaskUpdateInput {
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
  return data;
}

/**
 * Writes synchronized values on an item.
 * @param {string} token Token.
 * @param {GithubProjectLink} link Board link.
 * @param {{ itemId: string, contentId: string, type: RemoteItem['type'] }} item Item.
 * @param {SyncFields} values Values pushed from the task.
 * @param {string[]} remoteAssignees All the logins assigned on GitHub (with those without contributor).
 * @param {string[]} knownBefore Synchronized logins on GitHub before the change.
 * @returns {Promise<void>}
 */
async function pushValues(
  token: string,
  link: GithubProjectLink,
  item: { itemId: string; contentId: string; type: RemoteItem['type'] },
  values: SyncFields,
  remoteAssignees: string[],
  knownBefore: string[],
): Promise<void> {
  const assignees = values.assignees as string[] | undefined;
  await updateContent(token, item.type, item.contentId, {
    title: 'title' in values ? String(values.title) : undefined,
    body: 'body' in values ? String(values.body ?? '') : undefined,
    closed: 'closed' in values ? Boolean(values.closed) : undefined,
    assignees: assignees && {
      add: assignees.filter((login) => !knownBefore.includes(login)),
      remove: knownBefore.filter((login) => !assignees.includes(login)),
      all: [...remoteAssignees.filter((login) => !knownBefore.includes(login)), ...assignees],
    },
  });
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

/** Content type of a task whose item was removed from the board: not sent again. */
export const REMOVED = 'REMOVED';

/**
 * Synchronizes a project with its GitHub board, both ways: iterations become sprints; items new on the board
 * become tasks of the project, tasks new in the project tree become items (draft issues, or issues of the
 * chosen repository); linked pairs are merged field by field against the last sync. A task whose item left
 * the board is kept, unlinked, and not sent again.
 * @param {string} projectId Linked project.
 * @returns {Promise<SyncSummary>} What changed.
 */
export async function syncGithubProject(projectId: string): Promise<SyncSummary> {
  const link = await prisma.githubProjectLink.findUnique({ where: { projectId } });
  if (!link) throw notFound('Lien GitHub');
  if (running.has(link.id)) throw clientError('BAD_USER_INPUT', 'Une synchronisation de ce projet est déjà en cours.');
  running.add(link.id);
  const summary: SyncSummary = { pulledNew: 0, pushedNew: 0, pulled: 0, pushed: 0, unlinked: 0, sprints: 0 };
  try {
    const token = await githubToken();
    const board = await boardById(token, link.githubProjectId);
    summary.sprints = await syncIterations(board, link);
    const items = await boardItems(token, link.githubProjectId);

    const statusOption = link.statusOptions as Record<string, string>;
    const priorityOption = link.priorityOptions as Record<string, string>;
    const sprints = await prisma.sprint.findMany({ where: { githubIterationId: { not: null } }, select: { id: true, githubIterationId: true } });
    const contributors = await prisma.contributor.findMany({ where: { githubLogin: { not: null } }, select: { id: true, githubLogin: true } });
    const maps: Maps = {
      statusOption,
      optionStatus: new Map(Object.entries(statusOption).reverse().map(([status, option]) => [option, status])),
      priorityOption,
      optionPriority: new Map(Object.entries(priorityOption).reverse().map(([priority, option]) => [option, priority])),
      sprintIteration: new Map(sprints.map((sprint) => [sprint.id, sprint.githubIterationId!])),
      iterationSprint: new Map(sprints.map((sprint) => [sprint.githubIterationId!, sprint.id])),
      contributorByLogin: new Map(contributors.map((contributor) => [contributor.githubLogin!, contributor.id])),
    };

    const tree = await projectTree(projectId);
    const include = { assignees: { select: { id: true, githubLogin: true } } } as const;
    const linked = await prisma.task.findMany({ where: { githubItemId: { in: items.map((item) => item.itemId) } }, include });
    const byItem = new Map(linked.map((task) => [task.githubItemId!, task]));

    // Tasks of the tree whose item is gone: unlinked, and marked so that they are not sent back.
    const gone = await prisma.task.findMany({
      where: { projectId: { in: tree }, githubItemId: { not: null, notIn: items.map((item) => item.itemId) } },
      select: { id: true },
    });
    if (gone.length) {
      await prisma.task.updateMany({
        where: { id: { in: gone.map((task) => task.id) } },
        data: { githubItemId: null, githubContentId: null, githubContentType: REMOVED, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull },
      });
      summary.unlinked = gone.length;
    }

    for (const item of items) {
      const remote = remoteFields(item, link, maps);
      const task = byItem.get(item.itemId);
      if (!task) {
        // New on the board: a task of the project.
        const created = await createTask({ title: item.title.trim().slice(0, 300) || `Item GitHub ${item.number ?? ''}`.trim(), projectId });
        const fresh = await prisma.task.findUniqueOrThrow({ where: { id: created.id }, include });
        const { title: _title, ...rest } = remote; // eslint-disable-line @typescript-eslint/no-unused-vars
        const pulled = Object.fromEntries(Object.entries(rest).filter(([, value]) => !isUnmapped(value, 'gh')));
        await prisma.task.update({
          where: { id: created.id },
          data: {
            ...pullData(pulled, fresh, maps),
            githubItemId: item.itemId,
            githubContentId: item.contentId,
            githubContentType: item.type,
            githubUrl: item.url,
            githubNumber: item.number,
            githubSnapshot: remote as Prisma.InputJsonValue,
          },
        });
        summary.pulledNew += 1;
        continue;
      }
      const local = localFields(task, link, maps, item.type);
      const result = mergeFields(local, remote, task.githubSnapshot as SyncFields | null, task.updatedAt.toISOString() > item.updatedAt);
      if (Object.keys(result.push).length) {
        await pushValues(token, link, item, result.push, item.assignees, (remote.assignees as string[]) ?? []);
        summary.pushed += 1;
      }
      await prisma.task.update({
        where: { id: task.id },
        data: {
          ...pullData(result.pull, task, maps),
          githubContentId: item.contentId,
          githubContentType: item.type,
          githubUrl: item.url,
          githubNumber: item.number,
          githubSnapshot: result.snapshot as Prisma.InputJsonValue,
        },
      });
      if (Object.keys(result.pull).length) summary.pulled += 1;
    }

    // New in the project tree: items of the board.
    const fresh = await prisma.task.findMany({
      where: { projectId: { in: tree }, githubItemId: null, githubContentType: null, archivedAt: null, ...(!link.pushExisting && { createdAt: { gte: link.createdAt } }) },
      include,
      orderBy: { number: 'asc' },
    });
    for (const task of fresh) {
      const type: RemoteItem['type'] = link.repositoryId ? 'ISSUE' : 'DRAFT_ISSUE';
      const local = localFields(task, link, maps, type);
      const created = await createItem(token, {
        projectId: link.githubProjectId,
        repositoryId: link.repositoryId,
        title: task.title,
        body: task.description ?? '',
        assignees: (local.assignees as string[]) ?? [],
      });
      const { title: _title, body: _body, assignees: _assignees, ...fields } = local; // eslint-disable-line @typescript-eslint/no-unused-vars
      const pushable = Object.fromEntries(Object.entries(fields).filter(([key, value]) => !isUnmapped(value, 'ordo') && !(key === 'closed' && !value)));
      await pushValues(token, link, created, pushable, local.assignees as string[], local.assignees as string[]);
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
