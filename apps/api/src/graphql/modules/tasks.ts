import { CONFIRM_LOSS_DESCRIPTION } from '../occurrence-fields';
import { peopleSettler } from '../../services/routines/routines';
import { done } from '../errors';
import { taskDoability, type TaskDoability } from '../../services/tasks/task-doability';
import { prisma } from '../../db';
import { storeAttachment, attachmentUrl } from '../../services/core/attachments';
import * as contributors from '../../services/projects/contributors';
import * as milestones from '../../services/tasks/milestones';
import * as sprints from '../../services/tasks/sprints';
import { iconUrl } from '../../services/core/icons';
import { taskPriorities, taskStatuses, taskTags, taskTypes } from '../../services/tasks/task-labels';
import * as taskViews from '../../services/tasks/task-views';
import * as tasks from '../../services/tasks/tasks';
import { parseOptionalDay, readSlotCondition, readTaskHours, sumOf, TASK_CLOSE_REASONS, TASK_STATUS_CATEGORIES, taskFieldOrigin, VIEW_KINDS, type EffectiveTask, type TaskInheritableField } from '@ordo/shared';
import { effectiveTaskOf, loadTaskInheritance } from '../../services/tasks/task-inheritance';
import { FieldOriginRef, InheritSourceEnum, TaskInheritableFieldEnum } from '../inheritance-fields';
import type { Context } from '../context';
import { perRequest } from '../batch';
import * as workspaces from '../../services/workspaces/workspaces';
import { BY_POSITION } from '../../services/core/ordering';
import { TaskTransferResult, transferResult } from '../removed-links';
import { builder, type InputFields } from '../builder';
import { labelMutations, labelObject } from '../label-inputs';
import { relationIds } from '../relation-fields';
import { linkedDocumentsInputFields } from '../document-fields';
import { isMember } from '../../services/people/members';
import { contributorDetails, CONTRIBUTOR_LINK_SELECT } from '../../services/people/contributor-links';
import { reloaded } from '../reload';
import { locationInputFields } from '../located-fields';
import { ItemLinkInput, ItemLinkRef } from '../link-fields';
import { ReminderInput, ReminderRef } from '../reminder-fields';
import { DeadTimeInput, DeadTimeRef } from '../dead-time-fields';
import { CONTRIBUTOR_LINKS, readDeadTimes, readReminders, TASK_WAIT_REASONS } from '@ordo/shared';
import { BIRTH_DATE_DESCRIPTION } from '../person-fields';
import { readLinks } from '../../services/core/links';

const ContributorLinkKindEnum = builder.enumType('ContributorLinkKind', { values: CONTRIBUTOR_LINKS });

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
    projectIds: t.idList(relationIds('projects', 'Projects the contributor is directly attached to; their sub-projects inherit it.')),
    link: t.field({
      type: ContributorLinkKindEnum,
      description: 'What its details come from: itself as a member (its own), a relation, a contact, or nothing.',
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).link,
    }),
    relationId: t.id({ nullable: true, description: 'Relation it is linked to.', select: CONTRIBUTOR_LINK_SELECT, resolve: (contributor) => contributorDetails(contributor).relationId }),
    contactId: t.id({ nullable: true, description: 'Client contact it is linked to.', select: CONTRIBUTOR_LINK_SELECT, resolve: (contributor) => contributorDetails(contributor).contactId }),
    linkName: t.string({
      nullable: true,
      description: 'Name of the relation, or of the contact with its client (« Prénom Nom · Client »).',
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).linkName,
    }),
    birthDate: t.string({
      nullable: true,
      description: `${BIRTH_DATE_DESCRIPTION} That of what it is linked to: its own as a member, its relation's; none otherwise.`,
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).birthDate,
    }),
    birthdayReminders: t.field({
      type: [ReminderRef],
      description: 'Reminders of its birthday (those of its birth date).',
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).birthdayReminders,
    }),
    emails: t.field({
      type: 'JSON',
      description: "[{ label, address }]: its own as a member, its relation's, its contact's single email; none otherwise.",
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).emails,
    }),
    phones: t.field({
      type: 'JSON',
      description: "[{ label, number }]: its own as a member, its relation's, its contact's; none otherwise.",
      select: CONTRIBUTOR_LINK_SELECT,
      resolve: (contributor) => contributorDetails(contributor).phones,
    }),
  }),
});

const ContributorLinkInput = builder.inputType('ContributorLinkInput', {
  description: 'What the details of a contributor come from, one at most; the link replaces the one it had.',
  fields: (t) => ({
    kind: t.field({ type: ContributorLinkKindEnum, required: true }),
    relationId: t.id({ description: 'Relation (kind RELATION), not linked to another contributor.' }),
    contactId: t.id({ description: 'Client contact (kind CONTACT), not linked to another contributor.' }),
  }),
});

builder.prismaObject('Attachment', {
  // Never loads the file content.
  select: { id: true, filename: true, size: true, mimeType: true },
  fields: (t) => ({
    id: t.exposeID('id'),
    filename: t.exposeString('filename'),
    size: t.exposeInt('size'),
    isImage: t.boolean({ description: 'Shown in place in markdown.', resolve: (attachment) => attachment.mimeType.startsWith('image/') }),
    url: t.string({
      // Parentheses are escaped too: the URL goes inside a markdown link.
      resolve: (attachment) => attachmentUrl(attachment),
    }),
  }),
});

builder.prismaObject('Milestone', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    label: t.exposeString('label'),
    description: t.exposeString('description', { nullable: true }),
    dueDate: t.expose('dueDate', { type: 'Date', nullable: true }),
    position: t.exposeInt('position'),
  }),
});

const MilestoneInput = builder.inputType('MilestoneInput', {
  fields: (t) => ({
    projectId: t.id({ required: true }),
    label: t.string({ required: true }),
    description: t.string(),
    dueDate: t.field({ type: 'Date' }),
  }),
});

const MilestoneUpdateInput = builder.inputType('MilestoneUpdateInput', {
  description: 'Omitted fields are left unchanged; null clears a field.',
  fields: (t) => ({
    label: t.string(),
    description: t.string(),
    dueDate: t.field({ type: 'Date' }),
  }),
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
    label: t.exposeString('label'),
    goal: t.exposeString('goal', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date' }),
  }),
});

const SprintInput = builder.inputType('SprintInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    goal: t.string(),
    startDate: t.field({ type: 'Date', required: true }),
    endDate: t.field({ type: 'Date', required: true }),
  }),
});

const TaskStatusCategory = builder.enumType('TaskStatusCategory', {
  description: 'Fixed meaning of a status, a classification (to do, in progress, done, cancelled): it neither closes nor reopens tasks.',
  values: TASK_STATUS_CATEGORIES,
});

const TaskCloseReasonEnum = builder.enumType('TaskCloseReason', {
  description: 'How a task is closed: done (COMPLETED) or cancelled (NOT_PLANNED, « Annulée »), as the state reason of a GitHub issue.',
  values: TASK_CLOSE_REASONS,
});

builder.prismaObject('TaskStatus', {
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color'),
    category: t.expose('category', { type: TaskStatusCategory }),
    position: t.exposeInt('position'),
  }),
});

for (const name of ['TaskPriority', 'TaskType', 'TaskTag'] as const) labelObject(name);

const ViewKindEnum = builder.enumType('ViewKind', {
  values: VIEW_KINDS,
  description: 'What a saved view lists (TABLE: any other table, named by its key).',
});

builder.prismaObject('TaskView', {
  description: 'Saved view of the tasks or of the routines.',
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.field({ type: ViewKindEnum, resolve: (view) => view.kind }),
    tableKey: t.exposeString('tableKey', { nullable: true, description: 'Table of a view of kind TABLE.' }),
    label: t.exposeString('label'),
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
  }),
});

/** Inheritance of the tasks of the workspace, loaded once per request. */
const inheritanceOf = perRequest(loadTaskInheritance);

/**
 * Task as it goes (`effectiveTask`), the inheritance of the workspace loaded once per request (after its
 * mutation).
 * @param {Context} ctx GraphQL context.
 * @param {string} id Task.
 * @returns {Promise<EffectiveTask>} Effective task.
 */
async function goesBy(ctx: Context, id: string): Promise<EffectiveTask> {
  const task = effectiveTaskOf(await inheritanceOf(ctx), id);
  if (!task) throw new Error(`Task ${id} missing from its workspace.`);
  return task;
}

/** Values a task goes by: its own, or inherited from its parent; its dates also from its milestone, project or sprint. */
const TaskEffectiveRef = builder.objectRef<EffectiveTask>('TaskEffective').implement({
  description: 'Values a task goes by: each inherited field from its parent, live; its dates also from its milestone, project or first sprint. Read for every behaviour; the screens grey the inherited ones (`inheritance`).',
  fields: (t) => ({
    projectId: t.exposeID('projectId', { nullable: true }),
    priorityId: t.exposeID('priorityId', { nullable: true }),
    milestoneId: t.exposeID('milestoneId', { nullable: true }),
    assigneeIds: t.idList({ resolve: (task) => [...task.assigneeIds] }),
    beneficiaryIds: t.idList({ resolve: (task) => [...task.beneficiaryIds] }),
    beneficiaryRelationIds: t.idList({ resolve: (task) => [...task.beneficiaryRelationIds] }),
    slotCondition: t.field({ type: 'JSON', nullable: true, resolve: (task) => readSlotCondition(task.slotCondition) }),
    hours: t.field({ type: 'JSON', description: '« Horaires » it goes by (cases of days and hours; empty: any time).', resolve: (task) => readTaskHours(task.hours) }),
    location: t.exposeString('location', { nullable: true }),
    locationLat: t.exposeFloat('locationLat', { nullable: true }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    minDate: t.field({ type: 'Date', nullable: true, description: '« Ouverture » it goes by.', resolve: (task) => parseOptionalDay(task.minDate) }),
    deadline: t.field({ type: 'Date', nullable: true, description: '« Échéance » it goes by.', resolve: (task) => parseOptionalDay(task.deadline) }),
  }),
});

/**
 * Source of a date of a task (none: its own, or no date).
 * @param {EffectiveTask} task Effective task.
 * @param {TaskInheritableField} field Date.
 * @returns {string | null} Source.
 */
const dateSource = (task: EffectiveTask, field: TaskInheritableField) => {
  const source = taskFieldOrigin(task, field).source;
  return source === 'OWN' ? null : source;
};

builder.prismaObject('Task', {
  fields: (t) => ({
    id: t.exposeID('id'),
    number: t.exposeInt('number', { nullable: true, description: 'Number within its project (#12); none without project. Links use the id.' }),
    label: t.exposeString('label'),
    description: t.exposeString('description', { nullable: true }),
    projectId: t.exposeID('projectId', { nullable: true, description: 'None: a task of no project.' }),
    statusId: t.exposeID('statusId', { nullable: true }),
    priorityId: t.exposeID('priorityId', { nullable: true }),
    typeId: t.exposeID('typeId', { nullable: true }),
    effort: t.exposeFloat('effort', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date', nullable: true }),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    deadline: t.expose('deadline', { type: 'Date', nullable: true, description: 'Latest acceptable date (« Échéance »): an open task past it is overdue.' }),
    minDate: t.expose('minDate', { type: 'Date', nullable: true, description: 'Earliest acceptable date (« Ouverture »): not to be done before.' }),
    effectiveMinDate: t.field({
      type: 'Date',
      nullable: true,
      description: '« Ouverture » the task goes by: its own, else its parent’s, else the « Échéance » of the milestone before its own, the « Ouverture » of its project, the start of its first sprint.',
      resolve: async (task, _args, ctx) => parseOptionalDay((await goesBy(ctx, task.id)).minDate),
    }),
    effectiveDeadline: t.field({
      type: 'Date',
      nullable: true,
      description: '« Échéance » the task goes by (stored or inherited; its real one: `dueDay`): its own, else its parent’s, else its milestone’s, else the end of its first sprint.',
      resolve: async (task, _args, ctx) => parseOptionalDay((await goesBy(ctx, task.id)).deadline),
    }),
    dueDay: t.field({
      type: 'Date',
      nullable: true,
      description: 'Real « Échéance »: the one it goes by (`effectiveDeadline`), moved back to the last day its « Horaires » allow (`taskDueDay`); null without « Échéance », or when no day within a year before it is allowed. What overdue, « Ma journée », the agenda, reminders, sorts and filters read; the stored one stays (GitHub, inheritance).',
      resolve: async (task, _args, ctx) => parseOptionalDay((await goesBy(ctx, task.id)).dueDay),
    }),
    minDateSource: t.field({
      type: InheritSourceEnum,
      nullable: true,
      description: 'Where its « Ouverture » comes from when not its own: PARENT, MILESTONE, PROJECT, SPRINT; null: its own or none.',
      resolve: async (task, _args, ctx) => dateSource(await goesBy(ctx, task.id), 'MIN_DATE'),
    }),
    deadlineSource: t.field({
      type: InheritSourceEnum,
      nullable: true,
      description: 'Where its « Échéance » comes from when not its own: PARENT, MILESTONE, SPRINT; null: its own or none.',
      resolve: async (task, _args, ctx) => dateSource(await goesBy(ctx, task.id), 'DEADLINE'),
    }),
    inheritedFields: t.field({
      type: [TaskInheritableFieldEnum],
      description: 'Fields it takes from its parent, live; none for a top-level task.',
      resolve: (task) => task.inheritedFields as TaskInheritableField[],
    }),
    effective: t.field({ type: TaskEffectiveRef, description: 'Values it goes by.', resolve: (task, _args, ctx) => goesBy(ctx, task.id) }),
    inheritance: t.field({
      type: [FieldOriginRef],
      description: 'State (inherited, own, emptied on purpose) and source of each inherited field.',
      resolve: async (task, _args, ctx) => (await goesBy(ctx, task.id)).origins,
    }),
    cancelled: t.boolean({
      description: 'Closed as cancelled (« Annulée »): shown struck through.',
      resolve: (task) => task.closeReason === 'NOT_PLANNED',
    }),
    slotCondition: t.field({
      type: 'JSON',
      nullable: true,
      description: 'On or out of calendar schedules, or on the free time, in groups combined with and / or (as a routine); null: any time.',
      resolve: (task) => readSlotCondition(task.slotCondition),
    }),
    hours: t.field({
      type: 'JSON',
      description: '« Horaires »: days and hours it can be done, cases shaped as those of a schedule (`taskHoursSchema`); empty: any time. With a slot condition, doable only when both allow it.',
      resolve: (task) => readTaskHours(task.hours),
    }),
    location: t.exposeString('location', { nullable: true, description: 'Where it is done (free text); no travel time: a task has no hours.' }),
    locationLat: t.exposeFloat('locationLat', { nullable: true, description: 'Point of the location; none: unknown.' }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    links: t.field({ type: [ItemLinkRef], description: 'Links, as those of the events.', resolve: (task) => readLinks(task.links) }),
    reminders: t.field({
      type: [ReminderRef],
      description: 'Reminders « À HH:MM » (Paris time), rung every day from « Ouverture » to « Échéance » (its day only without « Ouverture »; never without « Échéance »).',
      resolve: (task) => readReminders(task.reminders),
    }),
    deadTimes: t.field({ type: [DeadTimeRef], description: '« Temps morts »: waits a timer is launched for.', resolve: (task) => readDeadTimes(task.deadTimes) }),
    parentId: t.exposeID('parentId', { nullable: true }),
    milestoneId: t.exposeID('milestoneId', { nullable: true }),
    sprintIds: t.idList(relationIds('sprints', 'Sprints the task is planned in.')),
    githubUrl: t.exposeString('githubUrl', { nullable: true, description: 'Issue on GitHub (null for a draft issue or an unlinked task).' }),
    githubNumber: t.exposeInt('githubNumber', { nullable: true }),
    githubLinked: t.boolean({ description: 'Synchronized with an item of a GitHub board.', resolve: (task) => task.githubItemId !== null }),
    position: t.exposeInt('position'),
    closed: t.boolean({ description: 'Closed task (done or cancelled).', resolve: (task) => task.closedAt !== null }),
    closedAt: t.expose('closedAt', { type: 'DateTime', nullable: true }),
    closeReason: t.expose('closeReason', { type: TaskCloseReasonEnum, nullable: true, description: 'How it was closed (done or cancelled); null while open.' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    tagIds: t.idList(relationIds('tags')),
    assigneeIds: t.idList(relationIds('assignees')),
    beneficiaryIds: t.idList(relationIds('beneficiaries', '« Bénéficiaires »: contributors the task is for.')),
    beneficiaryRelationIds: t.idList(relationIds('beneficiaryRelations', '« Bénéficiaires »: relations the task is for.')),
    libraryDocumentIds: t.idList(relationIds('libraryDocuments', 'Documents of the library linked to it (not inherited).')),
    projectResourceIds: t.idList(relationIds('projectResources', 'Documents of projects linked to it, of its project tree (not inherited).')),
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
      resolve: (task) => [...task.relationsA.map((link) => link.taskBId), ...task.relationsB.map((link) => link.taskAId)],
    }),
    commentCount: t.relationCount('comments'),
    trackedSeconds: t.int({
      description: 'Tracked time in seconds: each finished time entry is shared equally between its tasks.',
      select: { timeEntries: { where: { duration: { not: null } }, select: { duration: true, _count: { select: { tasks: true } } } } },
      resolve: (task) => Math.round(sumOf(task.timeEntries, (entry) => (entry.duration ?? 0) / Math.max(1, entry._count.tasks))),
    }),
    comments: t.relation('comments', { query: { orderBy: { createdAt: 'asc' } } }),
  }),
});

/**
 * Effort and dates of a task, for one task and for several.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const planningFields = (t: InputFields) => ({
  effort: t.float(),
  startDate: t.field({ type: 'Date' }),
  endDate: t.field({ type: 'Date' }),
  deadline: t.field({ type: 'Date' }),
  minDate: t.field({ type: 'Date' }),
});

/**
 * Fields of a task a creation and an update both take (its label and project aside).
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const taskFields = (t: InputFields) => ({
  description: t.string(),
  statusId: t.id(),
  priorityId: t.id(),
  typeId: t.id(),
  assigneeIds: t.idList(),
  beneficiaryIds: t.idList(),
  beneficiaryRelationIds: t.idList(),
  tagIds: t.idList(),
  ...planningFields(t),
  parentId: t.id(),
  milestoneId: t.id(),
  sprintIds: t.idList(),
  slotCondition: t.field({ type: 'JSON', description: 'On or out of calendar schedules, or on the free time, in groups (and / or); null: any time.' }),
  hours: t.field({ type: 'JSON', description: '« Horaires »: cases of days and hours, as those of a schedule (20 at most, no overlapping hours); null or empty: any time.' }),
  ...locationInputFields(t, 'Null: none (its point too).'),
  links: t.field({ type: [ItemLinkInput], description: '20 at most, http or https; null: none.' }),
  ...linkedDocumentsInputFields(t, 'omitted: unchanged'),
  reminders: t.field({ type: [ReminderInput], description: 'Reminders « À HH:MM » only, 10 at most; null: none.' }),
  deadTimes: t.field({ type: [DeadTimeInput], description: '« Temps morts », 20 at most; null: none.' }),
});

const TaskProjectMoveInput = builder.inputType('TaskProjectMoveInput', {
  description: 'Tasks put back in a project by the undo of a transfer.',
  fields: (t) => ({
    ids: t.idList({ required: true }),
    projectId: t.id({ description: 'Project (null: out of any project).' }),
  }),
});

const TaskInput = builder.inputType('TaskInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    projectId: t.id({ description: 'None: a task of no project (no number, sprint, milestone nor GitHub item).' }),
    ...taskFields(t),
    inheritedFields: t.field({
      type: [TaskInheritableFieldEnum],
      description: 'Under a parent: the fields it inherits (their values given are ignored); omitted: every field left out of the input. Ignored without parent.',
    }),
  }),
});

/**
 * Inheritance changes of one task.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const inheritanceChangeFields = (t: InputFields) => ({
  inherit: t.field({ type: [TaskInheritableFieldEnum], description: 'Fields made inherited from its parent again (« Rétablir l’héritage »); a sub-task only.' }),
  clear: t.field({ type: [TaskInheritableFieldEnum], description: 'Fields emptied on purpose (« Vider »): no value, not inherited (PROJECT refused). A field given a value becomes its own.' }),
});

const TaskUpdateInput = builder.inputType('TaskUpdateInput', {
  description: 'Omitted fields are left unchanged; null clears a field (a field given a value, null included, becomes its own). Use bulkTransferTasks to change the project.',
  fields: (t) => ({ label: t.string(), ...taskFields(t), ...inheritanceChangeFields(t) }),
});

const ContributorInput = builder.inputType('ContributorInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    projectIds: t.idList({ description: 'Projects the contributor is directly attached to.' }),
    handle: t.string({ required: true }),
    avatar: t.field({ type: 'File' }),
    link: t.field({ type: ContributorLinkInput, description: 'What its details come from (it has none of its own).' }),
  }),
});

const ContributorUpdateInput = builder.inputType('ContributorUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    projectIds: t.idList({ description: 'Projects the contributor is directly attached to.' }),
    handle: t.string(),
    avatar: t.field({ type: 'File' }),
    removeAvatar: t.boolean(),
    link: t.field({ type: ContributorLinkInput, description: 'What its details come from (it has none of its own).' }),
  }),
});

const LabelInput = builder.inputType('TaskLabelInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    color: t.string({ required: true }),
    category: t.field({ type: TaskStatusCategory, description: 'Statuses only; defaults to TODO.' }),
  }),
});

const LabelUpdateInput = builder.inputType('TaskLabelUpdateInput', {
  fields: (t) => ({
    label: t.string(),
    color: t.string(),
    category: t.field({ type: TaskStatusCategory, description: 'Statuses only.' }),
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
    ...planningFields(t),
    addAssigneeIds: t.idList(),
    removeAssigneeIds: t.idList(),
    addTagIds: t.idList(),
    removeTagIds: t.idList(),
    inheritFields: t.field({ type: [TaskInheritableFieldEnum], description: 'Fields made inherited from their parent again (« Rétablir l’héritage »); tasks without parent unchanged.' }),
    clearFields: t.field({ type: [TaskInheritableFieldEnum], description: 'Fields emptied on purpose (« Vider »; PROJECT refused). A field given a value becomes their own.' }),
  }),
});

const TaskViewInput = builder.inputType('TaskViewInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    projectId: t.id({ description: 'Project of the view; omitted or null for the home page.' }),
    kind: t.field({ type: ViewKindEnum, description: 'Tasks (default), routines, shopping lists or another table.' }),
    tableKey: t.string({ description: 'Table of a view of kind TABLE (required for it).' }),
    config: t.field({ type: 'JSON', required: true }),
  }),
});

const TaskViewUpdateInput = builder.inputType('TaskViewUpdateInput', {
  fields: (t) => ({
    label: t.string(),
    config: t.field({ type: 'JSON' }),
  }),
});

const TaskWaitReasonEnum = builder.enumType('TaskWaitReason', {
  description: 'Why an open task cannot be done now: its « Ouverture » is after today, its hours or its slot condition leave the moment out, a slot « Indisponible » of the workspace holds it, an event keeps its assignees busy.',
  values: TASK_WAIT_REASONS,
});

const TaskDoabilityRef = builder.objectRef<TaskDoability>('TaskDoability').implement({
  description: 'An open task and whether it can be done now.',
  fields: (t) => ({
    id: t.exposeID('id'),
    reason: t.field({ type: TaskWaitReasonEnum, nullable: true, description: 'Why it cannot be done now, null: it can.', resolve: (doability) => doability.reason }),
  }),
});

builder.queryFields((t) => ({
  tasks: t.prismaField({
    type: ['Task'],
    description: 'Every task, archived ones included, in manual order.',
    resolve: (query) => prisma.task.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  task: t.prismaField({
    type: 'Task',
    nullable: true,
    description: 'A task, by its id (its number is only unique in its project).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) => prisma.task.findUnique({ ...query, where: { id } }),
  }),
  doableTasks: t.field({
    type: [TaskDoabilityRef],
    description: 'Open tasks and whether they can be done now (Paris time): opened, allowed by their hours and their slot condition, kept by no event of their people; else why not.',
    // Still accepted so that an app installed before Paris time was read on the server keeps working until it updates.
    args: { utcOffset: t.arg.int({ required: false, deprecationReason: 'Ignored: doability is read in Paris time.' }) },
    resolve: async (_root, _args, ctx) => taskDoability(ctx.session ? await workspaces.meContributorId(ctx.session.userId) : null),
  }),
  taskViews: t.prismaField({
    type: ['TaskView'],
    description: "Views of the tasks (or routines, by kind) of a project's tab, or of their page when projectId is omitted.",
    args: { projectId: t.arg.id(), kind: t.arg({ type: ViewKindEnum }), tableKey: t.arg.string({ description: 'Table of the views of kind TABLE.' }) },
    resolve: (query, _root, { projectId, kind, tableKey }) =>
      prisma.taskView.findMany({ ...query, where: taskViews.viewScope(projectId ?? null, kind ?? 'TASKS', tableKey ?? null), orderBy: BY_POSITION }),
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
    resolve: (query) => prisma.milestone.findMany({ ...query, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, ...BY_POSITION] }),
  }),
  contributors: t.prismaField({
    type: ['Contributor'],
    resolve: (query) => prisma.contributor.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  taskStatuses: t.prismaField({
    type: ['TaskStatus'],
    resolve: (query) => prisma.taskStatus.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  taskPriorities: t.prismaField({
    type: ['TaskPriority'],
    resolve: (query) => prisma.taskPriority.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  taskTypes: t.prismaField({
    type: ['TaskType'],
    resolve: (query) => prisma.taskType.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  taskTags: t.prismaField({
    type: ['TaskTag'],
    resolve: (query) => prisma.taskTag.findMany({ ...query, orderBy: BY_POSITION }),
  }),
}));

builder.mutationFields((t) => ({
  createTask: t.prismaField({
    type: 'Task',
    args: { input: t.arg({ type: TaskInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.task, query, tasks.createTask(input)),
  }),
  updateTask: t.prismaField({
    type: 'Task',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: TaskUpdateInput, required: true }),
      restoring: t.arg.boolean({ description: 'Undo: archived values given back are accepted (only that check is skipped).' }),
    },
    resolve: async (query, _root, { id, input, restoring }) => reloaded(prisma.task, query, tasks.updateTask(id, input, restoring ?? false)),
  }),
  duplicateTask: t.prismaField({
    type: 'Task',
    description: 'Duplicates a task, named « … (copie) », with its sub-tasks when asked; not its comments.',
    args: { id: t.arg.id({ required: true }), includeSubtasks: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, includeSubtasks }) => reloaded(prisma.task, query, tasks.duplicateTask(id, includeSubtasks)),
  }),
  moveTask: t.boolean({
    description: 'Places a task before another one in the manual order (at the end when beforeId is null), and under ' + 'parentId when given (null: top-level task; omitted: parent unchanged).',
    args: { id: t.arg.id({ required: true }), beforeId: t.arg.id(), parentId: t.arg.id() },
    resolve: (_root, { id, beforeId, parentId }) => done(tasks.moveTask(id, beforeId ?? null, parentId)),
  }),
  setTasksClosed: t.boolean({
    description: 'Closes tasks as done (reason omitted) or as cancelled (NOT_PLANNED), or reopens them; a closed task no longer blocks other tasks. A task already closed keeps its closing date and takes the new reason.',
    args: {
      ids: t.arg.idList({ required: true }),
      closed: t.arg.boolean({ required: true }),
      reason: t.arg({ type: TaskCloseReasonEnum }),
      restoring: t.arg.boolean({ description: 'Undo: tasks archived since are accepted (only that check is skipped).' }),
    },
    resolve: (_root, { ids, closed, reason, restoring }) => done(tasks.setTasksClosed(ids, closed, restoring ?? false, reason ?? 'COMPLETED')),
  }),
  bulkUpdateTasks: t.boolean({
    args: {
      ids: t.arg.idList({ required: true }),
      changes: t.arg({ type: BulkTaskInput, required: true }),
      restoring: t.arg.boolean({ description: 'Undo: archived values given back are accepted (only that check is skipped).' }),
    },
    resolve: (_root, { ids, changes, restoring }) => done(tasks.bulkUpdateTasks(ids, changes, restoring ?? false)),
  }),
  bulkTransferTasks: t.field({
    type: TaskTransferResult,
    description: 'Moves the tasks and their sub-tasks to another project, or out of any (projectId null).',
    args: { ids: t.arg.idList({ required: true }), projectId: t.arg.id() },
    resolve: (_root, { ids, projectId }) => transferResult(tasks.bulkTransferTasks(ids, projectId ?? null)),
  }),
  undoTaskTransfer: t.boolean({
    description:
      'Undo of a transfer, in one transaction (all or nothing): the tasks go back to their project group after group (archived tasks and projects accepted), then the links it removed (its lost result) come back. Archived values are accepted; tasks deleted since are passed over.',
    args: { moves: t.arg({ type: [TaskProjectMoveInput], required: true }), links: t.arg({ type: 'JSON', required: true }) },
    resolve: (_root, { moves, links }) => done(tasks.undoTaskTransfer(moves.map((move) => ({ ids: move.ids, projectId: move.projectId ?? null })), links)),
  }),
  bulkSetTasksArchived: t.boolean({
    description: 'Archiving cascades to sub-tasks; restoring restores them and the archived parents.',
    args: { ids: t.arg.idList({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, archived }) => done(tasks.bulkSetTasksArchived(ids, archived)),
  }),
  bulkDeleteTasks: t.boolean({
    args: {
      ids: t.arg.idList({ required: true }),
      deleteSubtasks: t.arg.boolean({ required: true, description: 'false moves unselected sub-tasks up.' }),
    },
    resolve: (_root, { ids, deleteSubtasks }) => done(tasks.bulkDeleteTasks(ids, deleteSubtasks)),
  }),
  createTaskView: t.prismaField({
    type: 'TaskView',
    args: { input: t.arg({ type: TaskViewInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      reloaded(prisma.taskView, query, taskViews.createView({ label: input.label, config: input.config, projectId: input.projectId, kind: input.kind, tableKey: input.tableKey })),
  }),
  updateTaskView: t.prismaField({
    type: 'TaskView',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TaskViewUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.taskView, query, taskViews.updateView(id, input)),
  }),
  duplicateTaskView: t.prismaField({
    type: 'TaskView',
    args: { id: t.arg.id({ required: true }), label: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, label }) => reloaded(prisma.taskView, query, taskViews.duplicateView(id, label)),
  }),
  deleteTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(taskViews.deleteView(id)),
  }),
  setDefaultTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(taskViews.setDefaultView(id)),
  }),
  moveTaskView: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(taskViews.moveView(id, index)),
  }),
  createSprint: t.id({
    args: { projectId: t.arg.id({ required: true }), input: t.arg({ type: SprintInput, required: true }) },
    resolve: async (_root, { projectId, input }) => (await sprints.createSprint(projectId, input)).id,
  }),
  updateSprint: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SprintInput, required: true }) },
    resolve: (_root, { id, input }) => done(sprints.updateSprint(id, input)),
  }),
  deleteSprint: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(sprints.deleteSprint(id)),
  }),
  createMilestone: t.prismaField({
    type: 'Milestone',
    args: { input: t.arg({ type: MilestoneInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.milestone, query, milestones.createMilestone(input)),
  }),
  updateMilestone: t.prismaField({
    type: 'Milestone',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MilestoneUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.milestone, query, milestones.updateMilestone(id, input)),
  }),
  deleteMilestone: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(milestones.deleteMilestone(id)),
  }),
  moveMilestone: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(milestones.moveMilestone(id, index)),
  }),
  addTaskBlock: t.boolean({
    description: 'blockerId blocks blockedId.',
    args: { blockerId: t.arg.id({ required: true }), blockedId: t.arg.id({ required: true }) },
    resolve: (_root, { blockerId, blockedId }) => done(tasks.addTaskBlock(blockerId, blockedId)),
  }),
  removeTaskBlock: t.boolean({
    args: { blockerId: t.arg.id({ required: true }), blockedId: t.arg.id({ required: true }) },
    resolve: (_root, { blockerId, blockedId }) => done(tasks.removeTaskBlock(blockerId, blockedId)),
  }),
  addTaskRelation: t.boolean({
    args: { taskId: t.arg.id({ required: true }), otherId: t.arg.id({ required: true }) },
    resolve: (_root, { taskId, otherId }) => done(tasks.addTaskRelation(taskId, otherId)),
  }),
  removeTaskRelation: t.boolean({
    args: { taskId: t.arg.id({ required: true }), otherId: t.arg.id({ required: true }) },
    resolve: (_root, { taskId, otherId }) => done(tasks.removeTaskRelation(taskId, otherId)),
  }),
  addTaskComment: t.prismaField({
    type: 'TaskComment',
    args: { taskId: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { taskId, body }) => reloaded(prisma.taskComment, query, tasks.addComment(taskId, body)),
  }),
  updateTaskComment: t.prismaField({
    type: 'TaskComment',
    args: { id: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, body }) => reloaded(prisma.taskComment, query, tasks.updateComment(id, body)),
  }),
  deleteTaskComment: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(tasks.deleteComment(id)),
  }),

  createContributor: t.prismaField({
    type: 'Contributor',
    args: { input: t.arg({ type: ContributorInput, required: true }), confirmLoss: t.arg.boolean({ description: `${CONFIRM_LOSS_DESCRIPTION} Its birthday (slot conditions).` }) },
    resolve: async (query, _root, { input, confirmLoss }) =>
      reloaded(prisma.contributor, query, contributors.createContributor(input, peopleSettler(confirmLoss))),
  }),
  uploadAttachment: t.prismaField({
    type: 'Attachment',
    description: 'Stores a file to link from a markdown text (10 MB maximum).',
    args: { file: t.arg({ type: 'File', required: true }) },
    resolve: async (query, _root, { file }) => reloaded(prisma.attachment, query, storeAttachment(file)),
  }),
  setProjectContributors: t.boolean({
    description: 'Sets the contributors directly attached to a project; tasks keep their assignees.',
    args: { projectId: t.arg.id({ required: true }), contributorIds: t.arg.idList({ required: true }) },
    resolve: (_root, { projectId, contributorIds }) => done(contributors.setProjectContributors(projectId, contributorIds)),
  }),
  updateContributor: t.prismaField({
    type: 'Contributor',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: ContributorUpdateInput, required: true }),
      confirmLoss: t.arg.boolean({ description: `${CONFIRM_LOSS_DESCRIPTION} Its birthday moved or gone (slot conditions).` }),
    },
    resolve: async (query, _root, { id, input, confirmLoss }) =>
      reloaded(prisma.contributor, query, contributors.updateContributor(id, input, peopleSettler(confirmLoss))),
  }),
  deleteContributor: t.boolean({
    args: { id: t.arg.id({ required: true }), confirmLoss: t.arg.boolean({ description: `${CONFIRM_LOSS_DESCRIPTION} Its birthday gone (slot conditions).` }) },
    resolve: (_root, { id, confirmLoss }) => done(contributors.deleteContributor(id, peopleSettler(confirmLoss))),
  }),
}));

// Statuses, priorities, types and tags share the same CRUD.
const labelInputs = { create: LabelInput, update: LabelUpdateInput };
labelMutations('TaskStatus', taskStatuses, labelInputs);
labelMutations('TaskPriority', taskPriorities, labelInputs);
labelMutations('TaskType', taskTypes, labelInputs);
labelMutations('TaskTag', taskTags, labelInputs);
