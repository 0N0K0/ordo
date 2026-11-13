import { prisma } from '../../db';
import { storeAttachment } from '../../services/attachments';
import * as contributors from '../../services/contributors';
import * as milestones from '../../services/milestones';
import * as sprints from '../../services/sprints';
import { iconUrl } from '../../services/icons';
import type { Label } from '../../services/labels';
import { taskPriorities, taskStatuses, taskTags, taskTypes } from '../../services/task-labels';
import * as taskFilters from '../../services/task-filters';
import * as taskViews from '../../services/task-views';
import * as taskRecurrence from '../../services/task-recurrence';
import * as tasks from '../../services/tasks';
import { TASK_STATUS_CATEGORIES, taskFilterSchema } from '@ordo/shared';
import { z } from 'zod';
import { parseInput } from '../errors';
import * as workspaces from '../../services/workspaces';
import { builder } from '../builder';
import { isMember } from '../../services/treasury-team';

const byManualOrder = [{ position: 'asc' }, { createdAt: 'asc' }] as const;

builder.prismaObject('Contributor', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    handle: t.exposeString('handle'),
    avatarUrl: t.string({ nullable: true, resolve: (contributor) => iconUrl(contributor.iconId) }),
    isMe: t.boolean({
      description: 'Whether this contributor is the app user.',
      select: { user: { select: { id: true } } },
      resolve: (contributor) => contributor.user !== null,
    }),
    teamMember: t.boolean({
      description: 'Member of the team (professional workspace) or household (personal one); the app user always is.',
      resolve: (contributor) => isMember(contributor),
    }),
    projectIds: t.idList({
      description: 'Projects the contributor is directly attached to; their sub-projects inherit it.',
      select: { projects: { select: { id: true } } },
      resolve: (contributor) => contributor.projects.map((project) => project.id),
    }),
  }),
});

builder.prismaObject('Attachment', {
  // Never loads the file content.
  select: { id: true, name: true, size: true, mimeType: true },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    size: t.exposeInt('size'),
    isImage: t.boolean({ description: 'Shown in place in markdown.', resolve: (attachment) => attachment.mimeType.startsWith('image/') }),
    url: t.string({
      // Parentheses are escaped too: the URL goes inside a markdown link.
      resolve: (attachment) =>
        `/api/attachments/${attachment.id}/${encodeURIComponent(attachment.name).replace(/\(/g, '%28').replace(/\)/g, '%29')}`,
    }),
  }),
});

builder.prismaObject('Milestone', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    dueDate: t.expose('dueDate', { type: 'Date', nullable: true }),
    position: t.exposeInt('position'),
  }),
});

const MilestoneInput = builder.inputType('MilestoneInput', {
  fields: (t) => ({
    projectId: t.id({ required: true }),
    title: t.string({ required: true }),
    description: t.string(),
    dueDate: t.field({ type: 'Date' }),
  }),
});

const MilestoneUpdateInput = builder.inputType('MilestoneUpdateInput', {
  description: 'Omitted fields are left unchanged; null clears a field.',
  fields: (t) => ({
    title: t.string(),
    description: t.string(),
    dueDate: t.field({ type: 'Date' }),
  }),
});

const SprintMatchesRef = builder.objectRef<{ sprintId: string; taskIds: string[] }>('SprintMatches').implement({
  description: 'Tasks of a sprint matching a filter at the end of the sprint.',
  fields: (t) => ({ sprintId: t.exposeID('sprintId'), taskIds: t.exposeIDList('taskIds') }),
});

const SprintTaskStatusRef = builder.objectRef<sprints.SprintTaskStatus>('SprintTaskStatus').implement({
  description: 'Status of a task at the end of a sprint.',
  fields: (t) => ({
    sprintId: t.exposeID('sprintId'),
    taskId: t.exposeID('taskId'),
    statusId: t.exposeID('statusId', { nullable: true }),
    closed: t.exposeBoolean('closed'),
  }),
});

builder.prismaObject('Sprint', {
  description: 'Period of a project the tasks of its project tree are planned in.',
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    name: t.exposeString('name'),
    goal: t.exposeString('goal', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date' }),
  }),
});

const SprintInput = builder.inputType('SprintInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    goal: t.string(),
    startDate: t.field({ type: 'Date', required: true }),
    endDate: t.field({ type: 'Date', required: true }),
  }),
});

const TaskStatusCategory = builder.enumType('TaskStatusCategory', {
  description: 'Fixed meaning of a status: open (TODO, IN_PROGRESS) or closed (DONE, CANCELLED).',
  values: TASK_STATUS_CATEGORIES,
});

builder.prismaObject('TaskStatus', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    category: t.expose('category', { type: TaskStatusCategory }),
    position: t.exposeInt('position'),
  }),
});

for (const name of ['TaskPriority', 'TaskType', 'TaskTag'] as const) {
  builder.prismaObject(name as 'TaskPriority', {
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      color: t.exposeString('color'),
      position: t.exposeInt('position'),
    }),
  });
}

const ViewKindEnum = builder.enumType('ViewKind', { values: ['TASKS', 'ROUTINES', 'SHOPPING_LISTS'] as const, description: 'What a saved view lists.' });

builder.prismaObject('TaskView', {
  description: 'Saved view of the tasks or of the routines.',
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.field({ type: ViewKindEnum, resolve: (view) => view.kind }),
    name: t.exposeString('name'),
    config: t.expose('config', { type: 'JSON' }),
    isDefault: t.exposeBoolean('isDefault'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('TaskComment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    githubAuthor: t.exposeString('githubAuthor', { nullable: true, description: 'Author on GitHub, when someone else than the connected account.' }),
  }),
});

builder.prismaObject('Task', {
  fields: (t) => ({
    id: t.exposeID('id'),
    number: t.exposeInt('number', { description: 'Number within its project (#12); links use the id.' }),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    projectId: t.exposeID('projectId'),
    statusId: t.exposeID('statusId', { nullable: true }),
    priorityId: t.exposeID('priorityId', { nullable: true }),
    typeId: t.exposeID('typeId', { nullable: true }),
    effort: t.exposeFloat('effort', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date', nullable: true }),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    deadline: t.expose('deadline', { type: 'Date', nullable: true, description: 'Latest acceptable date ("Date max"): an open task past it is overdue.' }),
    parentId: t.exposeID('parentId', { nullable: true }),
    milestoneId: t.exposeID('milestoneId', { nullable: true }),
    sprintIds: t.idList({
      description: 'Sprints the task is planned in.',
      select: { sprints: { select: { id: true } } },
      resolve: (task) => task.sprints.map((sprint) => sprint.id),
    }),
    githubUrl: t.exposeString('githubUrl', { nullable: true, description: 'Issue on GitHub (null for a draft issue or an unlinked task).' }),
    githubNumber: t.exposeInt('githubNumber', { nullable: true }),
    githubLinked: t.boolean({ description: 'Synchronized with an item of a GitHub board.', resolve: (task) => task.githubItemId !== null }),
    position: t.exposeInt('position'),
    archived: t.boolean({ resolve: (task) => task.archivedAt !== null }),
    closed: t.boolean({ description: 'Closed (done) task.', resolve: (task) => task.closedAt !== null }),
    closedAt: t.expose('closedAt', { type: 'DateTime', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    tagIds: t.idList({
      select: { tags: { select: { id: true } } },
      resolve: (task) => task.tags.map((tag) => tag.id),
    }),
    assigneeIds: t.idList({
      select: { assignees: { select: { id: true } } },
      resolve: (task) => task.assignees.map((assignee) => assignee.id),
    }),
    blockingIds: t.idList({
      description: 'Tasks this task blocks.',
      select: { blocking: { select: { blockedId: true } } },
      resolve: (task) => task.blocking.map((link) => link.blockedId),
    }),
    blockedByIds: t.idList({
      description: 'Tasks blocking this task.',
      select: { blockedBy: { select: { blockerId: true } } },
      resolve: (task) => task.blockedBy.map((link) => link.blockerId),
    }),
    relatedIds: t.idList({
      select: { relationsA: { select: { taskBId: true } }, relationsB: { select: { taskAId: true } } },
      resolve: (task) => [
        ...task.relationsA.map((link) => link.taskBId),
        ...task.relationsB.map((link) => link.taskAId),
      ],
    }),
    commentCount: t.relationCount('comments'),
    recurrence: t.field({
      type: 'JSON',
      nullable: true,
      description: 'Repetition, on the first task of a recurring series.',
      resolve: (task) => task.recurrence ?? null,
    }),
    seriesId: t.exposeID('seriesId', { nullable: true, description: 'First task of the series this task is an occurrence of.' }),
    occurrenceDate: t.expose('occurrenceDate', { type: 'Date', nullable: true }),
    trackedSeconds: t.int({
      description: 'Tracked time in seconds: each finished time entry is shared equally between its tasks.',
      select: { timeEntries: { where: { duration: { not: null } }, select: { duration: true, _count: { select: { tasks: true } } } } },
      resolve: (task) =>
        Math.round(task.timeEntries.reduce((sum, entry) => sum + (entry.duration ?? 0) / Math.max(1, entry._count.tasks), 0)),
    }),
    comments: t.relation('comments', { query: { orderBy: { createdAt: 'asc' } } }),
  }),
});

const TaskInput = builder.inputType('TaskInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    projectId: t.id({ required: true }),
    description: t.string(),
    statusId: t.id(),
    priorityId: t.id(),
    typeId: t.id(),
    assigneeIds: t.idList(),
    tagIds: t.idList(),
    effort: t.float(),
    startDate: t.field({ type: 'Date' }),
    endDate: t.field({ type: 'Date' }),
    deadline: t.field({ type: 'Date' }),
    parentId: t.id(),
    milestoneId: t.id(),
    sprintIds: t.idList(),
  }),
});

const TaskUpdateInput = builder.inputType('TaskUpdateInput', {
  description: 'Omitted fields are left unchanged; null clears a field. Use transferTask to change the project.',
  fields: (t) => ({
    title: t.string(),
    description: t.string(),
    statusId: t.id(),
    priorityId: t.id(),
    typeId: t.id(),
    assigneeIds: t.idList(),
    tagIds: t.idList(),
    effort: t.float(),
    startDate: t.field({ type: 'Date' }),
    endDate: t.field({ type: 'Date' }),
    deadline: t.field({ type: 'Date' }),
    parentId: t.id(),
    milestoneId: t.id(),
    sprintIds: t.idList(),
  }),
});

const ContributorInput = builder.inputType('ContributorInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    projectIds: t.idList({ description: 'Projects the contributor is directly attached to.' }),
    handle: t.string({ required: true }),
    avatar: t.field({ type: 'File' }),
  }),
});

const ContributorUpdateInput = builder.inputType('ContributorUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    projectIds: t.idList({ description: 'Projects the contributor is directly attached to.' }),
    handle: t.string(),
    avatar: t.field({ type: 'File' }),
    removeAvatar: t.boolean(),
  }),
});

const LabelInput = builder.inputType('TaskLabelInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.string({ required: true }),
    category: t.field({ type: TaskStatusCategory, description: 'Statuses only; defaults to TODO.' }),
  }),
});

const LabelUpdateInput = builder.inputType('TaskLabelUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    color: t.string(),
    category: t.field({ type: TaskStatusCategory, description: 'Statuses only.' }),
  }),
});

const TaskQueryInput = builder.inputType('TaskQueryInput', {
  fields: (t) => ({
    filter: t.field({ type: 'JSON', required: true, description: 'Filter tree (and / or groups of conditions).' }),
    search: t.string({ description: 'Quick search: number, title or description.' }),
    includeArchived: t.boolean(),
    today: t.field({ type: 'Date', required: true, description: 'User\'s current day, for relative dates.' }),
    utcOffset: t.int({ required: true, description: 'User\'s offset from UTC, in minutes.' }),
  }),
});

const BulkTaskInput = builder.inputType('BulkTaskInput', {
  description: 'Omitted fields are left unchanged; null clears a field.',
  fields: (t) => ({
    statusId: t.id(),
    priorityId: t.id(),
    typeId: t.id(),
    milestoneId: t.id(),
    addSprintIds: t.idList(),
    removeSprintIds: t.idList(),
    effort: t.float(),
    startDate: t.field({ type: 'Date' }),
    endDate: t.field({ type: 'Date' }),
    deadline: t.field({ type: 'Date' }),
    addAssigneeIds: t.idList(),
    removeAssigneeIds: t.idList(),
    addTagIds: t.idList(),
    removeTagIds: t.idList(),
  }),
});

const TaskViewInput = builder.inputType('TaskViewInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    projectId: t.id({ description: 'Project of the view; omitted or null for the home page.' }),
    kind: t.field({ type: ViewKindEnum, description: 'Tasks (default) or routines.' }),
    config: t.field({ type: 'JSON', required: true }),
  }),
});

const TaskViewUpdateInput = builder.inputType('TaskViewUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    config: t.field({ type: 'JSON' }),
  }),
});

const TransferResult = builder.objectRef<{ removedLinks: number }>('TaskTransferResult').implement({
  fields: (t) => ({
    removedLinks: t.exposeInt('removedLinks', { description: 'Links removed because they left the project tree.' }),
  }),
});

/**
 * Reloads a task with the fields requested by the query.
 * @param {object} query Pothos Prisma selection.
 * @param {string} id Task id.
 * @returns {Promise<object>} Task.
 */
function reloadTask(query: object, id: string) {
  return prisma.task.findUniqueOrThrow({ ...query, where: { id } });
}

const TaskColumnDefaultsRef = builder.objectRef<{ columnOrder: string[]; hiddenColumns: string[] }>('TaskColumnDefaults').implement({
  description: 'Columns new task views of the workspace start with.',
  fields: (t) => ({
    columnOrder: t.exposeStringList('columnOrder'),
    hiddenColumns: t.exposeStringList('hiddenColumns'),
  }),
});

builder.queryFields((t) => ({
  taskColumnDefaults: t.field({
    type: TaskColumnDefaultsRef,
    description: 'Columns new task views of the workspace start with (chosen for it, else the app’s).',
    resolve: () => workspaces.taskColumnDefaults(),
  }),
}));

builder.mutationFields((t) => ({
  setTaskColumnDefaults: t.field({
    type: TaskColumnDefaultsRef,
    description: 'Chooses the columns new task views start with; without columns, gives back the app’s.',
    args: { columnOrder: t.arg.stringList(), hiddenColumns: t.arg.stringList() },
    resolve: (_root, { columnOrder, hiddenColumns }) =>
      workspaces.setTaskColumnDefaults(columnOrder ? ({ columnOrder, hiddenColumns: hiddenColumns ?? [] } as never) : null),
  }),
}));

builder.queryFields((t) => ({
  tasks: t.prismaField({
    type: ['Task'],
    description: 'Every task, archived ones included, in manual order.',
    resolve: (query) => prisma.task.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  task: t.prismaField({
    type: 'Task',
    nullable: true,
    description: 'A task, by its id (its number is only unique in its project).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) => prisma.task.findUnique({ ...query, where: { id } }),
  }),
  matchingTaskIdsBySprint: t.field({
    type: [SprintMatchesRef],
    description:
      'For each sprint ended before the query day: ids of its tasks matching a filter whose status conditions (status, category, closed) use the status the tasks had at the end of the sprint.',
    args: { query: t.arg({ type: TaskQueryInput, required: true }) },
    resolve: async (_root, { query }, ctx) => {
      const { filter } = parseInput(z.object({ filter: taskFilterSchema }), { filter: query.filter });
      const meId = ctx.session ? await workspaces.meContributorId(ctx.session.userId) : null;
      const statuses = await sprints.sprintTaskStatuses(query.today);
      const categoryOf = new Map((await prisma.taskStatus.findMany({ select: { id: true, category: true } })).map((status) => [status.id, status.category]));
      const bySprint = new Map<string, Map<string, { statusId: string | null; closed: boolean }>>();
      for (const item of statuses) {
        const map = bySprint.get(item.sprintId) ?? new Map();
        map.set(item.taskId, { statusId: item.statusId, closed: item.closed });
        bySprint.set(item.sprintId, map);
      }
      const ended = await prisma.sprint.findMany({ where: { endDate: { lt: new Date(`${query.today}T00:00:00Z`) } }, select: { id: true } });
      return Promise.all(
        ended.map(async ({ id }) => {
          const where = await taskFilters.buildTaskWhere({
            filter,
            search: query.search ?? '',
            includeArchived: query.includeArchived ?? false,
            clock: { today: query.today, utcOffset: query.utcOffset },
            user: { contributorId: meId },
            statusAt: { statuses: bySprint.get(id) ?? new Map(), categoryOf },
          });
          const tasks = await prisma.task.findMany({ where: { AND: [where, { sprints: { some: { id } } }] }, select: { id: true } });
          return { sprintId: id, taskIds: tasks.map((task) => task.id) };
        }),
      );
    },
  }),
  matchingTaskIds: t.idList({
    description: 'Ids of the tasks matching a filter, in manual order.',
    args: { query: t.arg({ type: TaskQueryInput, required: true }) },
    resolve: async (_root, { query }, ctx) => {
      const { filter } = parseInput(z.object({ filter: taskFilterSchema }), { filter: query.filter });
      const meId = ctx.session ? await workspaces.meContributorId(ctx.session.userId) : null;
      const where = await taskFilters.buildTaskWhere({
        filter,
        search: query.search ?? '',
        includeArchived: query.includeArchived ?? false,
        clock: { today: query.today, utcOffset: query.utcOffset },
        user: { contributorId: meId },
      });
      const matches = await prisma.task.findMany({ where, orderBy: [...byManualOrder], select: { id: true } });
      return matches.map((task) => task.id);
    },
  }),
  taskViews: t.prismaField({
    type: ['TaskView'],
    description: 'Views of the tasks (or routines, by kind) of a project\'s tab, or of their page when projectId is omitted.',
    args: { projectId: t.arg.id(), kind: t.arg({ type: ViewKindEnum }) },
    resolve: (query, _root, { projectId, kind }) =>
      prisma.taskView.findMany({ ...query, where: { projectId: projectId ?? null, kind: kind ?? 'TASKS' }, orderBy: [...byManualOrder] }),
  }),
  sprintTaskStatuses: t.field({
    type: [SprintTaskStatusRef],
    description: 'Status of the tasks of the sprints ended before a day, at the end of each sprint (tasks with a recorded status).',
    args: { today: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { today }) => sprints.sprintTaskStatuses(today),
  }),
  sprints: t.prismaField({
    type: ['Sprint'],
    description: 'Sprints, by start date.',
    resolve: (query) => prisma.sprint.findMany({ ...query, orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }] }),
  }),
  milestones: t.prismaField({
    type: ['Milestone'],
    resolve: (query) => prisma.milestone.findMany({ ...query, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, ...byManualOrder] }),
  }),
  contributors: t.prismaField({
    type: ['Contributor'],
    resolve: (query) => prisma.contributor.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  taskStatuses: t.prismaField({
    type: ['TaskStatus'],
    resolve: (query) => prisma.taskStatus.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  taskPriorities: t.prismaField({
    type: ['TaskPriority'],
    resolve: (query) => prisma.taskPriority.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  taskTypes: t.prismaField({
    type: ['TaskType'],
    resolve: (query) => prisma.taskType.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  taskTags: t.prismaField({
    type: ['TaskTag'],
    resolve: (query) => prisma.taskTag.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
}));

builder.mutationFields((t) => ({
  createTask: t.prismaField({
    type: 'Task',
    args: { input: t.arg({ type: TaskInput, required: true }) },
    resolve: async (query, _root, { input }) => reloadTask(query, (await tasks.createTask(input)).id),
  }),
  updateTask: t.prismaField({
    type: 'Task',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TaskUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloadTask(query, (await tasks.updateTask(id, input)).id),
  }),
  setTaskArchived: t.prismaField({
    type: 'Task',
    description: 'Archiving cascades to sub-tasks; restoring restores them and the archived parents.',
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, archived }) =>
      reloadTask(query, (await tasks.setTaskArchived(id, archived)).id),
  }),
  deleteTask: t.boolean({
    args: {
      id: t.arg.id({ required: true }),
      deleteSubtasks: t.arg.boolean({ required: true, description: 'false moves the sub-tasks up to the parent.' }),
    },
    resolve: async (_root, { id, deleteSubtasks }) => {
      await tasks.deleteTask(id, deleteSubtasks);
      return true;
    },
  }),
  transferTask: t.field({
    type: TransferResult,
    description: 'Moves the task and its sub-tasks to another project.',
    args: { id: t.arg.id({ required: true }), projectId: t.arg.id({ required: true }) },
    resolve: async (_root, { id, projectId }) => ({ removedLinks: (await tasks.transferTask(id, projectId)).removedLinks }),
  }),
  cloneTask: t.prismaField({
    type: 'Task',
    args: { id: t.arg.id({ required: true }), includeSubtasks: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, includeSubtasks }) =>
      reloadTask(query, (await tasks.cloneTask(id, includeSubtasks)).id),
  }),
  moveTask: t.boolean({
    description:
      'Places a task before another one in the manual order (at the end when beforeId is null), and under ' +
      'parentId when given (null: top-level task; omitted: parent unchanged).',
    args: { id: t.arg.id({ required: true }), beforeId: t.arg.id(), parentId: t.arg.id() },
    resolve: async (_root, { id, beforeId, parentId }) => {
      await tasks.moveTask(id, beforeId ?? null, parentId);
      return true;
    },
  }),
  setTaskRecurrence: t.prismaField({
    type: 'Task',
    description: 'Makes a task recurring, changes its repetition, or stops it (null). On an occurrence, its series is changed.',
    args: { id: t.arg.id({ required: true }), recurrence: t.arg({ type: 'JSON' }) },
    resolve: async (query, _root, { id, recurrence }) => reloadTask(query, (await taskRecurrence.setTaskRecurrence(id, recurrence ?? null)).id),
  }),
  materializeTaskOccurrences: t.int({
    description: 'Creates the occurrences of recurring tasks falling in a displayed period; returns how many were created.',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { from, to }) => taskRecurrence.materializeTaskOccurrences(from, to),
  }),
  setTasksClosed: t.boolean({
    description: 'Closes (done) or reopens tasks; a closed task no longer blocks other tasks.',
    args: { ids: t.arg.idList({ required: true }), closed: t.arg.boolean({ required: true }) },
    resolve: async (_root, { ids, closed }) => {
      await tasks.setTasksClosed(ids, closed);
      return true;
    },
  }),
  bulkUpdateTasks: t.boolean({
    args: { ids: t.arg.idList({ required: true }), changes: t.arg({ type: BulkTaskInput, required: true }) },
    resolve: async (_root, { ids, changes }) => {
      await tasks.bulkUpdateTasks(ids, changes);
      return true;
    },
  }),
  bulkTransferTasks: t.field({
    type: TransferResult,
    description: 'Moves the tasks and their sub-tasks to another project.',
    args: { ids: t.arg.idList({ required: true }), projectId: t.arg.id({ required: true }) },
    resolve: async (_root, { ids, projectId }) => ({ removedLinks: await tasks.bulkTransferTasks(ids, projectId) }),
  }),
  bulkSetTasksArchived: t.boolean({
    args: { ids: t.arg.idList({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (_root, { ids, archived }) => {
      await tasks.bulkSetTasksArchived(ids, archived);
      return true;
    },
  }),
  bulkDeleteTasks: t.boolean({
    args: {
      ids: t.arg.idList({ required: true }),
      deleteSubtasks: t.arg.boolean({ required: true, description: 'false moves unselected sub-tasks up.' }),
    },
    resolve: async (_root, { ids, deleteSubtasks }) => {
      await tasks.bulkDeleteTasks(ids, deleteSubtasks);
      return true;
    },
  }),
  createTaskView: t.prismaField({
    type: 'TaskView',
    args: { input: t.arg({ type: TaskViewInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.taskView.findUniqueOrThrow({
        ...query,
        where: { id: (await taskViews.createView({ name: input.name, config: input.config, projectId: input.projectId, kind: input.kind })).id },
      }),
  }),
  updateTaskView: t.prismaField({
    type: 'TaskView',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TaskViewUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.taskView.findUniqueOrThrow({ ...query, where: { id: (await taskViews.updateView(id, input)).id } }),
  }),
  duplicateTaskView: t.prismaField({
    type: 'TaskView',
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, name }) =>
      prisma.taskView.findUniqueOrThrow({ ...query, where: { id: (await taskViews.duplicateView(id, name)).id } }),
  }),
  deleteTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await taskViews.deleteView(id);
      return true;
    },
  }),
  setDefaultTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await taskViews.setDefaultView(id);
      return true;
    },
  }),
  moveTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await taskViews.moveView(id, index);
      return true;
    },
  }),
  createSprint: t.id({
    args: { projectId: t.arg.id({ required: true }), input: t.arg({ type: SprintInput, required: true }) },
    resolve: async (_root, { projectId, input }) => (await sprints.createSprint(projectId, input)).id,
  }),
  updateSprint: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SprintInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await sprints.updateSprint(id, input);
      return true;
    },
  }),
  deleteSprint: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await sprints.deleteSprint(id);
      return true;
    },
  }),
  createMilestone: t.prismaField({
    type: 'Milestone',
    args: { input: t.arg({ type: MilestoneInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.milestone.findUniqueOrThrow({ ...query, where: { id: (await milestones.createMilestone(input)).id } }),
  }),
  updateMilestone: t.prismaField({
    type: 'Milestone',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MilestoneUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.milestone.findUniqueOrThrow({ ...query, where: { id: (await milestones.updateMilestone(id, input)).id } }),
  }),
  deleteMilestone: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await milestones.deleteMilestone(id);
      return true;
    },
  }),
  moveMilestone: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await milestones.moveMilestone(id, index);
      return true;
    },
  }),
  addTaskBlock: t.boolean({
    description: 'blockerId blocks blockedId.',
    args: { blockerId: t.arg.id({ required: true }), blockedId: t.arg.id({ required: true }) },
    resolve: async (_root, { blockerId, blockedId }) => {
      await tasks.addTaskBlock(blockerId, blockedId);
      return true;
    },
  }),
  removeTaskBlock: t.boolean({
    args: { blockerId: t.arg.id({ required: true }), blockedId: t.arg.id({ required: true }) },
    resolve: async (_root, { blockerId, blockedId }) => {
      await tasks.removeTaskBlock(blockerId, blockedId);
      return true;
    },
  }),
  addTaskRelation: t.boolean({
    args: { taskId: t.arg.id({ required: true }), otherId: t.arg.id({ required: true }) },
    resolve: async (_root, { taskId, otherId }) => {
      await tasks.addTaskRelation(taskId, otherId);
      return true;
    },
  }),
  removeTaskRelation: t.boolean({
    args: { taskId: t.arg.id({ required: true }), otherId: t.arg.id({ required: true }) },
    resolve: async (_root, { taskId, otherId }) => {
      await tasks.removeTaskRelation(taskId, otherId);
      return true;
    },
  }),
  addTaskComment: t.prismaField({
    type: 'TaskComment',
    args: { taskId: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { taskId, body }) =>
      prisma.taskComment.findUniqueOrThrow({ ...query, where: { id: (await tasks.addComment(taskId, body)).id } }),
  }),
  updateTaskComment: t.prismaField({
    type: 'TaskComment',
    args: { id: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, body }) =>
      prisma.taskComment.findUniqueOrThrow({ ...query, where: { id: (await tasks.updateComment(id, body)).id } }),
  }),
  deleteTaskComment: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await tasks.deleteComment(id);
      return true;
    },
  }),

  createContributor: t.prismaField({
    type: 'Contributor',
    args: { input: t.arg({ type: ContributorInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.contributor.findUniqueOrThrow({
        ...query,
        where: { id: (await contributors.createContributor(input)).id },
      }),
  }),
  uploadAttachment: t.prismaField({
    type: 'Attachment',
    description: 'Stores a file to link from a markdown text (10 MB maximum).',
    args: { file: t.arg({ type: 'File', required: true }) },
    resolve: async (query, _root, { file }) =>
      prisma.attachment.findUniqueOrThrow({ ...query, where: { id: (await storeAttachment(file)).id } }),
  }),
  setProjectContributors: t.boolean({
    description: 'Sets the contributors directly attached to a project; tasks keep their assignees.',
    args: { projectId: t.arg.id({ required: true }), contributorIds: t.arg.idList({ required: true }) },
    resolve: async (_root, { projectId, contributorIds }) => {
      await contributors.setProjectContributors(projectId, contributorIds);
      return true;
    },
  }),
  updateContributor: t.prismaField({
    type: 'Contributor',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ContributorUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.contributor.findUniqueOrThrow({
        ...query,
        where: { id: (await contributors.updateContributor(id, input)).id },
      }),
  }),
  deleteContributor: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await contributors.deleteContributor(id);
      return true;
    },
  }),
}));

// Statuses, priorities and types share the same CRUD.
const labelKinds = [
  { type: 'TaskStatus', suffix: 'TaskStatus', service: taskStatuses, model: () => prisma.taskStatus },
  { type: 'TaskPriority', suffix: 'TaskPriority', service: taskPriorities, model: () => prisma.taskPriority },
  { type: 'TaskType', suffix: 'TaskType', service: taskTypes, model: () => prisma.taskType },
  { type: 'TaskTag', suffix: 'TaskTag', service: taskTags, model: () => prisma.taskTag },
] as const;

for (const kind of labelKinds) {
  const type = kind.type as 'TaskStatus';
  const model = kind.model as () => typeof prisma.taskStatus;

  /**
   * Reloads a label with the fields requested by the query.
   * @param {object} query Pothos Prisma selection.
   * @param {Label} label Saved label.
   * @returns {Promise<object>} Label.
   */
  const reload = (query: object, label: Label) => model().findUniqueOrThrow({ ...query, where: { id: label.id } });

  builder.mutationFields((t) => ({
    [`create${kind.suffix}`]: t.prismaField({
      type,
      args: { input: t.arg({ type: LabelInput, required: true }) },
      resolve: async (query, _root, { input }) => reload(query, await kind.service.create(input)),
    }),
    [`update${kind.suffix}`]: t.prismaField({
      type,
      args: { id: t.arg.id({ required: true }), input: t.arg({ type: LabelUpdateInput, required: true }) },
      resolve: async (query, _root, { id, input }) => reload(query, await kind.service.update(id, input)),
    }),
    [`delete${kind.suffix}`]: t.boolean({
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_root, { id }) => {
        await kind.service.remove(id);
        return true;
      },
    }),
    [`move${kind.suffix}`]: t.boolean({
      args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
      resolve: async (_root, { id, index }) => {
        await kind.service.move(id, index);
        return true;
      },
    }),
  }));
}
