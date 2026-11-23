import { tasksQueryKey, doableTasksKey } from '../../../lib/query-keys';
import type { ContributorLinkValues, TaskBulkChanges, TaskCloseReason, TaskInput, TaskLinksLost, TaskWaitReason } from '@ordo/shared';
import { accountingQueryKey } from '../../accounting/api';
import { useQuery } from '@tanstack/react-query';
import { moveToIndex, patchQuery, useInvalidatingMutation } from '../../../lib/mutation';
import { byPosition, movedTo } from '@ordo/shared';
import { graphql } from '../../../graphql';
import type {
  ContributorFieldsFragment,
  MilestoneFieldsFragment,
  SprintFieldsFragment,
  TaskCommentFieldsFragment,
  TaskFieldsFragment,
  TaskLabelFieldsFragment,
  DoableTasksQuery,
  TasksDataQuery,
  TaskStatusCategory,
  TypedDocumentString,
} from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { withLossConfirmation } from '../../time/lib/confirm-loss';
import { routinesKey } from '../../routines/api';
import { taskRow } from '../lib/task-inheritance';

export type Task = TaskFieldsFragment;
export type TaskComment = TaskCommentFieldsFragment;
export type Contributor = ContributorFieldsFragment;
export type TaskLabel = TaskLabelFieldsFragment;
export type TaskStatus = TasksDataQuery['taskStatuses'][number];
export type Milestone = MilestoneFieldsFragment;
export type Sprint = SprintFieldsFragment;
export type { TaskStatusCategory };
type TasksData = TasksDataQuery;

graphql(`
  fragment ContributorFields on Contributor {
    id
    archived
    name
    handle
    avatarUrl
    isMe
    projectIds
    link
    relationId
    contactId
    linkName
    birthDate
    birthdayReminders {
      ...ReminderFields
    }
    emails
    phones
  }
`);

graphql(`
  fragment SprintFields on Sprint {
    id
    archived
    projectId
    label
    goal
    startDate
    endDate
  }
`);

graphql(`
  fragment MilestoneFields on Milestone {
    id
    archived
    projectId
    label
    description
    dueDate
    position
  }
`);

graphql(`
  fragment TaskLabelFields on TaskStatus {
    id
    archived
    label
    color
    iconUrl
    position
  }
`);

graphql(`
  fragment FieldOriginFields on FieldOrigin {
    field
    state
    source
    sourceId
  }
`);

graphql(`
  fragment TaskFields on Task {
    id
    number
    label
    description
    projectId
    statusId
    priorityId
    typeId
    effort
    startDate
    endDate
    parentId
    milestoneId
    sprintIds
    deadline
    minDate
    effectiveDeadline
    effectiveMinDate
    deadlineSource
    minDateSource
    inheritedFields
    inheritance {
      ...FieldOriginFields
    }
    effective {
      projectId
      priorityId
      milestoneId
      assigneeIds
      beneficiaryIds
      beneficiaryRelationIds
      slotCondition
      hours
      location
      locationLat
      locationLon
      minDate
      deadline
    }
    cancelled
    position
    archived
    createdAt
    updatedAt
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    libraryDocumentIds
    projectResourceIds
    tagIds
    blockingIds
    blockedByIds
    relatedIds
    commentCount
    trackedSeconds
    closed
    closedAt
    closeReason
    githubLinked
    githubUrl
    githubNumber
    slotCondition
    hours
    location
    locationLat
    locationLon
    links {
      url
      label
    }
    reminders {
      ...ReminderFields
    }
    deadTimes {
      ...DeadTimeFields
    }
    savedCountdownIds
  }
`);

graphql(`
  fragment TaskCommentFields on TaskComment {
    id
    body
    createdAt
    githubAuthor
  }
`);

const TasksDataDocument = graphql(`
  query TasksData {
    tasks {
      ...TaskFields
    }
    contributors {
      ...ContributorFields
    }
    taskStatuses {
      ...TaskLabelFields
      category
    }
    taskPriorities {
      id
      archived
      label
      color
      iconUrl
      position
    }
    taskTypes {
      id
      archived
      label
      color
      iconUrl
      position
    }
    taskTags {
      id
      archived
      label
      color
      iconUrl
      position
    }
    milestones {
      ...MilestoneFields
    }
    sprints {
      ...SprintFields
    }
  }
`);

const TaskCommentsDocument = graphql(`
  query TaskComments($id: ID!) {
    task(id: $id) {
      id
      comments {
        ...TaskCommentFields
      }
    }
  }
`);

const CreateTaskDocument = graphql(`
  mutation CreateTask($input: TaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
`);

const UpdateTaskDocument = graphql(`
  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!, $restoring: Boolean) {
    updateTask(id: $id, input: $input, restoring: $restoring) {
      ...TaskFields
    }
  }
`);

const DuplicateTaskDocument = graphql(`
  mutation DuplicateTask($id: ID!, $includeSubtasks: Boolean!) {
    duplicateTask(id: $id, includeSubtasks: $includeSubtasks) {
      id
      number
    }
  }
`);

const MoveTaskDocument = graphql(`
  mutation MoveTask($id: ID!, $beforeId: ID, $parentId: ID) {
    moveTask(id: $id, beforeId: $beforeId, parentId: $parentId)
  }
`);

const AddTaskBlockDocument = graphql(`
  mutation AddTaskBlock($blockerId: ID!, $blockedId: ID!) {
    addTaskBlock(blockerId: $blockerId, blockedId: $blockedId)
  }
`);

const RemoveTaskBlockDocument = graphql(`
  mutation RemoveTaskBlock($blockerId: ID!, $blockedId: ID!) {
    removeTaskBlock(blockerId: $blockerId, blockedId: $blockedId)
  }
`);

const AddTaskRelationDocument = graphql(`
  mutation AddTaskRelation($taskId: ID!, $otherId: ID!) {
    addTaskRelation(taskId: $taskId, otherId: $otherId)
  }
`);

const RemoveTaskRelationDocument = graphql(`
  mutation RemoveTaskRelation($taskId: ID!, $otherId: ID!) {
    removeTaskRelation(taskId: $taskId, otherId: $otherId)
  }
`);

const AddTaskCommentDocument = graphql(`
  mutation AddTaskComment($taskId: ID!, $body: String!) {
    addTaskComment(taskId: $taskId, body: $body) {
      ...TaskCommentFields
    }
  }
`);

const UpdateTaskCommentDocument = graphql(`
  mutation UpdateTaskComment($id: ID!, $body: String!) {
    updateTaskComment(id: $id, body: $body) {
      ...TaskCommentFields
    }
  }
`);

const DeleteTaskCommentDocument = graphql(`
  mutation DeleteTaskComment($id: ID!) {
    deleteTaskComment(id: $id)
  }
`);

const CreateContributorDocument = graphql(`
  mutation CreateContributor($input: ContributorInput!, $confirmLoss: Boolean) {
    createContributor(input: $input, confirmLoss: $confirmLoss) {
      ...ContributorFields
    }
  }
`);

const UpdateContributorDocument = graphql(`
  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!, $confirmLoss: Boolean) {
    updateContributor(id: $id, input: $input, confirmLoss: $confirmLoss) {
      ...ContributorFields
    }
  }
`);

const SetProjectContributorsDocument = graphql(`
  mutation SetProjectContributors($projectId: ID!, $contributorIds: [ID!]!) {
    setProjectContributors(projectId: $projectId, contributorIds: $contributorIds)
  }
`);

const DeleteContributorDocument = graphql(`
  mutation DeleteContributor($id: ID!, $confirmLoss: Boolean) {
    deleteContributor(id: $id, confirmLoss: $confirmLoss)
  }
`);

const LabelDocuments = {
  status: {
    create: graphql(`
      mutation CreateTaskStatus($input: TaskLabelInput!) {
        createTaskStatus(input: $input) {
          id
        }
      }
    `),
    update: graphql(`
      mutation UpdateTaskStatus($id: ID!, $input: TaskLabelUpdateInput!) {
        updateTaskStatus(id: $id, input: $input) {
          id
        }
      }
    `),
    remove: graphql(`
      mutation DeleteTaskStatus($id: ID!) {
        deleteTaskStatus(id: $id)
      }
    `),
  },
  priority: {
    create: graphql(`
      mutation CreateTaskPriority($input: TaskLabelInput!) {
        createTaskPriority(input: $input) {
          id
        }
      }
    `),
    update: graphql(`
      mutation UpdateTaskPriority($id: ID!, $input: TaskLabelUpdateInput!) {
        updateTaskPriority(id: $id, input: $input) {
          id
        }
      }
    `),
    remove: graphql(`
      mutation DeleteTaskPriority($id: ID!) {
        deleteTaskPriority(id: $id)
      }
    `),
  },
  type: {
    create: graphql(`
      mutation CreateTaskType($input: TaskLabelInput!) {
        createTaskType(input: $input) {
          id
        }
      }
    `),
    update: graphql(`
      mutation UpdateTaskType($id: ID!, $input: TaskLabelUpdateInput!) {
        updateTaskType(id: $id, input: $input) {
          id
        }
      }
    `),
    remove: graphql(`
      mutation DeleteTaskType($id: ID!) {
        deleteTaskType(id: $id)
      }
    `),
  },
  tag: {
    create: graphql(`
      mutation CreateTaskTag($input: TaskLabelInput!) {
        createTaskTag(input: $input) {
          id
        }
      }
    `),
    update: graphql(`
      mutation UpdateTaskTag($id: ID!, $input: TaskLabelUpdateInput!) {
        updateTaskTag(id: $id, input: $input) {
          id
        }
      }
    `),
    remove: graphql(`
      mutation DeleteTaskTag($id: ID!) {
        deleteTaskTag(id: $id)
      }
    `),
  },
};

export { tasksQueryKey };

/**
 * Task data with each task as the screens read it (`taskRow`: its inherited fields with the values it follows).
 * @param {TasksData} data Data as the API gives it.
 * @returns {TasksData} Data.
 */
const withTaskRows = (data: TasksData): TasksData => ({ ...data, tasks: data.tasks.map(taskRow) });

/**
 * Tasks, contributors, statuses, priorities and types.
 * @returns {UseQueryResult<TasksData>} Query state.
 */
export function useTasksData() {
  // Each task as it goes: its inherited fields with the values it follows.
  return useQuery({ queryKey: tasksQueryKey, queryFn: async () => withTaskRows(await execute(TasksDataDocument)) });
}

/**
 * Comments of a task.
 * @param {string} id Task id.
 * @returns {UseQueryResult<TaskComment[]>} Query state.
 */
export function useTaskComments(id: string) {
  return useQuery({
    queryKey: [...tasksQueryKey, id, 'comments'],
    queryFn: async () => (await execute(TaskCommentsDocument, { id })).task?.comments ?? [],
  });
}

/**
 * Mutation refreshing the task data afterwards.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult<TResult, Error, TVariables>} Mutation state.
 */
function useTasksMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return useInvalidatingMutation(mutationFn, { invalidate: [tasksQueryKey] });
}

/** Fields of a task sent on a creation or an update (the shared input of the API). */
export type TaskInputValues = TaskInput;

/** Saves a change of a task now, from its panel (a section edited in place: its description, its links). */
export type TaskSave = (input: Omit<TaskInputValues, 'projectId'>) => Promise<unknown>;

/**
 * Creates a task.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateTask() {
  return useTasksMutation(async (input: TaskInputValues & { label: string }) => (await execute(CreateTaskDocument, { input })).createTask);
}

/**
 * Updates a task (the project changes through a transfer: a project given only makes it its own, not inherited).
 * `restoring`: undo, archived values given back accepted.
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateTask() {
  return useTasksMutation(async ({ id, input, restoring }: { id: string; input: TaskInputValues; restoring?: boolean }) => (await execute(UpdateTaskDocument, { id, input, restoring })).updateTask);
}

const SetTasksClosedDocument = graphql(`
  mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!, $reason: TaskCloseReason, $restoring: Boolean) {
    setTasksClosed(ids: $ids, closed: $closed, reason: $reason, restoring: $restoring)
  }
`);

/**
 * Closes tasks as done (no reason) or as cancelled (`NOT_PLANNED`), or reopens them; the cached tasks change right away
 * (a cancelled one struck through). `restoring`: undo, tasks archived since accepted.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTasksClosed() {
  return useInvalidatingMutation(async (variables: { ids: string[]; closed: boolean; reason?: TaskCloseReason; restoring?: boolean }) => (await execute(SetTasksClosedDocument, variables)).setTasksClosed, {
    invalidate: [tasksQueryKey],
    optimistic: (queryClient, { ids, closed, reason = 'COMPLETED' }) =>
      patchQuery<TasksData>(queryClient, tasksQueryKey, (data) => ({
        ...data,
        tasks: data.tasks.map((task) => (ids.includes(task.id) ? { ...task, closed, closeReason: closed ? reason : null, cancelled: closed && reason === 'NOT_PLANNED' } : task)),
      })),
  });
}

/**
 * Duplicates a task (« … (copie) »), optionally with its sub-tasks.
 * @returns {UseMutationResult} Mutation state, with the id and number of the copy.
 */
export function useDuplicateTask() {
  return useTasksMutation(async (variables: { id: string; includeSubtasks: boolean }) => (await execute(DuplicateTaskDocument, variables)).duplicateTask);
}

/**
 * Moves a task before another one in the manual order (at the end when beforeId is null), and under a new
 * parent when `parentId` is given (null: top-level task).
 * The cached list is reordered right away.
 * @returns {UseMutationResult} Mutation state.
 */
export function useMoveTask() {
  return useInvalidatingMutation(async (variables: { id: string; beforeId: string | null; parentId?: string | null }) => (await execute(MoveTaskDocument, variables)).moveTask, {
    invalidate: [tasksQueryKey],
    optimistic: (queryClient, { id, beforeId, parentId }) =>
      patchQuery<TasksData>(queryClient, tasksQueryKey, (data) => {
        const ordered = [...data.tasks].sort(byPosition);
        const moved = ordered.find((task) => task.id === id);
        const others = ordered.filter((task) => task.id !== id);
        const index = beforeId ? others.findIndex((task) => task.id === beforeId) : others.length;
        if (!moved || index < 0) return data;
        const order = movedTo(others, parentId === undefined ? moved : { ...moved, parentId }, index);
        return { ...data, tasks: order.map((task, position) => ({ ...task, position })) };
      }),
  });
}

/**
 * Adds or removes a "blocks" link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useTaskBlock() {
  return useTasksMutation(async ({ add, ...variables }: { add: boolean; blockerId: string; blockedId: string }) =>
    add ? (await execute(AddTaskBlockDocument, variables)).addTaskBlock : (await execute(RemoveTaskBlockDocument, variables)).removeTaskBlock,
  );
}

/**
 * Adds or removes a "related to" link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useTaskRelation() {
  return useTasksMutation(async ({ add, ...variables }: { add: boolean; taskId: string; otherId: string }) =>
    add ? (await execute(AddTaskRelationDocument, variables)).addTaskRelation : (await execute(RemoveTaskRelationDocument, variables)).removeTaskRelation,
  );
}

/**
 * Adds, edits or deletes a comment.
 * @returns {object} Comment mutations.
 */
export function useTaskCommentMutations() {
  return {
    add: useTasksMutation(async (variables: { taskId: string; body: string }) => (await execute(AddTaskCommentDocument, variables)).addTaskComment),
    update: useTasksMutation(async (variables: { id: string; body: string }) => (await execute(UpdateTaskCommentDocument, variables)).updateTaskComment),
    remove: useTasksMutation(async (variables: { id: string }) => (await execute(DeleteTaskCommentDocument, variables)).deleteTaskComment),
  };
}

/**
 * Creates, updates or deletes a contributor.
 * @returns {object} Contributor mutations.
 */
export function useContributorMutations() {
  // Its birthday added, moved or gone (its link: a membership, a relation): the occurrences of routines lost are
  // confirmed first, as for a change of schedule, and the routines refreshed with the tasks (the birthdays and the
  // tasks doable now are under them), the members and relations (treasury) with them.
  const people = { invalidate: [tasksQueryKey, routinesKey, accountingQueryKey] };
  return {
    create: useInvalidatingMutation(
      async (input: { name: string; handle: string; avatar?: File | null; projectIds?: string[]; link?: ContributorLinkValues }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(CreateContributorDocument, { input, confirmLoss })).createContributor),
      people,
    ),
    update: useInvalidatingMutation(
      async (variables: { id: string; input: { name?: string; handle?: string; avatar?: File | null; removeAvatar?: boolean; projectIds?: string[]; link?: ContributorLinkValues } }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(UpdateContributorDocument, { ...variables, confirmLoss })).updateContributor),
      people,
    ),
    // Members and relations (treasury) follow: a relation loses its contributor.
    remove: useInvalidatingMutation(async (variables: { id: string }) => withLossConfirmation(async (confirmLoss) => (await execute(DeleteContributorDocument, { ...variables, confirmLoss })).deleteContributor), {
      invalidate: people.invalidate,
    }),
    setProjectContributors: useTasksMutation(async (variables: { projectId: string; contributorIds: string[] }) => (await execute(SetProjectContributorsDocument, variables)).setProjectContributors),
  };
}

export type TaskLabelKind = keyof typeof LabelDocuments;

/** Label fields; the category only applies to statuses. */
interface LabelInput {
  label: string;
  color: string;
  category?: TaskStatusCategory;
}

/**
 * CRUD and ordering of a task label table (status, priority, type or tag).
 * @param {TaskLabelKind} kind Label table.
 * @returns {object} Label mutations, shaped for the settings label manager.
 */
export function useTaskLabelMutations(kind: TaskLabelKind) {
  // The three tables share their variables; results are not read (the data is refetched).
  const documents = LabelDocuments[kind] as {
    create: TypedDocumentString<unknown, { input: LabelInput }>;
    update: TypedDocumentString<unknown, { id: string; input: Partial<LabelInput> }>;
    remove: TypedDocumentString<unknown, { id: string }>;
  };
  return {
    create: useTasksMutation(async (input: LabelInput) => execute(documents.create, { input })),
    update: useTasksMutation(async (variables: { id: string; input: Partial<LabelInput> }) => execute(documents.update, variables)),
    remove: useTasksMutation(async (variables: { id: string }) => execute(documents.remove, variables)),
  };
}

const BulkUpdateTasksDocument = graphql(`
  mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!, $restoring: Boolean) {
    bulkUpdateTasks(ids: $ids, changes: $changes, restoring: $restoring)
  }
`);

const BulkTransferTasksDocument = graphql(`
  mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID) {
    bulkTransferTasks(ids: $ids, projectId: $projectId) {
      removedLinks
      lost
    }
  }
`);

const UndoTaskTransferDocument = graphql(`
  mutation UndoTaskTransfer($moves: [TaskProjectMoveInput!]!, $links: JSON!) {
    undoTaskTransfer(moves: $moves, links: $links)
  }
`);

const BulkSetTasksArchivedDocument = graphql(`
  mutation BulkSetTasksArchived($ids: [ID!]!, $archived: Boolean!) {
    bulkSetTasksArchived(ids: $ids, archived: $archived)
  }
`);

const BulkDeleteTasksDocument = graphql(`
  mutation BulkDeleteTasks($ids: [ID!]!, $deleteSubtasks: Boolean!) {
    bulkDeleteTasks(ids: $ids, deleteSubtasks: $deleteSubtasks)
  }
`);

const DoableTasksDocument = graphql(`
  query DoableTasks {
    doableTasks {
      id
      reason
    }
  }
`);

export { doableTasksKey };

/** Open tasks that cannot be done now, and why. */
export type TaskWaitReasons = ReadonlyMap<string, TaskWaitReason>;

/**
 * Ids of the open tasks that can be done now.
 * @param {DoableTasksQuery['doableTasks']} tasks Open tasks and why they cannot be done now.
 * @returns {Set<string>} Ids.
 */
const doableIdsOf = (tasks: DoableTasksQuery['doableTasks']) => new Set(tasks.filter((task) => !task.reason).map((task) => task.id));

/**
 * Open tasks that cannot be done now, with why.
 * @param {DoableTasksQuery['doableTasks']} tasks Open tasks and why they cannot be done now.
 * @returns {TaskWaitReasons} Reason by task id.
 */
const waitReasonsOf = (tasks: DoableTasksQuery['doableTasks']): TaskWaitReasons => new Map(tasks.flatMap((task) => (task.reason ? [[task.id, task.reason] as const] : [])));

/**
 * Open tasks and why they cannot be done now (their « Ouverture », their hours, their slot rule, the events of their
 * people), one query refreshed every minute, read by `useDoableTaskIds` and `useTaskWaitReasons`.
 * @param {boolean} enabled Asked.
 * @param {(tasks: DoableTasksQuery['doableTasks']) => T} select What is read from it.
 * @returns {T | undefined} What is read, undefined while loading.
 */
function useDoableTasks<T>(enabled: boolean, select: (tasks: DoableTasksQuery['doableTasks']) => T) {
  const { data } = useQuery({
    queryKey: doableTasksKey,
    queryFn: async () => (await execute(DoableTasksDocument)).doableTasks,
    select,
    enabled,
    refetchInterval: 60_000,
  });
  return data;
}

/**
 * Open tasks that can be done now, refreshed every minute; asked only when a filter needs it.
 * @param {boolean} enabled Asked.
 * @returns {Set<string> | undefined} Ids.
 */
export function useDoableTaskIds(enabled: boolean) {
  return useDoableTasks(enabled, doableIdsOf);
}

/**
 * Open tasks that cannot be done now, with why (the first reason, in the order they are told); the same query as
 * `useDoableTaskIds`.
 * @param {boolean} enabled Asked.
 * @returns {TaskWaitReasons | undefined} Reason by task id, undefined while loading.
 */
export function useTaskWaitReasons(enabled: boolean) {
  return useDoableTasks(enabled, waitReasonsOf);
}

/** Same changes made to several tasks. */
export type BulkChanges = TaskBulkChanges;

/**
 * Bulk changes, transfer (and the links it removed put back), archiving and deletion of selected tasks.
 * @returns {object} Bulk mutations.
 */
export function useBulkTaskMutations() {
  return {
    update: useTasksMutation(
      // `restoring`: an undo, the archived values given back accepted.
      async (variables: { ids: string[]; changes: BulkChanges; restoring?: boolean }) => (await execute(BulkUpdateTasksDocument, variables)).bulkUpdateTasks,
    ),
    transfer: useTasksMutation(async (variables: { ids: string[]; projectId: string | null }) => {
      const { removedLinks, lost } = (await execute(BulkTransferTasksDocument, variables)).bulkTransferTasks;
      return { removedLinks, lost: lost as TaskLinksLost };
    }),
    // Undo of a transfer, all or nothing: the tasks back in their project group after group, then the links it removed.
    undoTransfer: useTasksMutation(
      async (variables: { moves: { ids: string[]; projectId: string | null }[]; links: TaskLinksLost }) => (await execute(UndoTaskTransferDocument, variables)).undoTaskTransfer,
    ),
    archive: useTasksMutation(async (variables: { ids: string[]; archived: boolean }) => (await execute(BulkSetTasksArchivedDocument, variables)).bulkSetTasksArchived),
    remove: useTasksMutation(async (variables: { ids: string[]; deleteSubtasks: boolean }) => (await execute(BulkDeleteTasksDocument, variables)).bulkDeleteTasks),
  };
}

const CreateMilestoneDocument = graphql(`
  mutation CreateMilestone($input: MilestoneInput!) {
    createMilestone(input: $input) {
      id
    }
  }
`);

const UpdateMilestoneDocument = graphql(`
  mutation UpdateMilestone($id: ID!, $input: MilestoneUpdateInput!) {
    updateMilestone(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteMilestoneDocument = graphql(`
  mutation DeleteMilestone($id: ID!) {
    deleteMilestone(id: $id)
  }
`);

const MoveMilestoneDocument = graphql(`
  mutation MoveMilestone($id: ID!, $index: Int!) {
    moveMilestone(id: $id, index: $index)
  }
`);

interface MilestoneInputValues {
  label: string;
  description: string | null;
  dueDate: string | null;
}

/**
 * Create, update, delete and reorder project milestones.
 * @returns {object} Milestone mutations.
 */
export function useMilestoneMutations() {
  return {
    create: useTasksMutation(async (input: MilestoneInputValues & { projectId: string }) => (await execute(CreateMilestoneDocument, { input })).createMilestone),
    update: useTasksMutation(async (variables: { id: string; input: Partial<MilestoneInputValues> }) => (await execute(UpdateMilestoneDocument, variables)).updateMilestone),
    remove: useTasksMutation(async (variables: { id: string }) => (await execute(DeleteMilestoneDocument, variables)).deleteMilestone),
    move: useMoveMilestone(),
  };
}

/**
 * Moves a milestone to an index among those of its project, updating the cache at once (drag and drop).
 * @returns {UseMutationResult} Mutation state.
 */
function useMoveMilestone() {
  return useInvalidatingMutation(async (variables: { id: string; index: number }) => (await execute(MoveMilestoneDocument, variables)).moveMilestone, {
    invalidate: [tasksQueryKey],
    optimistic: (queryClient, { id, index }) =>
      patchQuery<TasksData>(queryClient, tasksQueryKey, (data) => {
        const moved = data.milestones.find((milestone) => milestone.id === id);
        if (!moved) return data;
        const siblings = data.milestones.filter((milestone) => milestone.projectId === moved.projectId).sort(byPosition);
        const positions = new Map((moveToIndex(siblings, id, index) ?? []).map((milestone, position) => [milestone.id, position]));
        return { ...data, milestones: data.milestones.map((milestone) => ({ ...milestone, position: positions.get(milestone.id) ?? milestone.position })) };
      }),
  });
}

const CreateSprintDocument = graphql(`
  mutation CreateSprint($projectId: ID!, $input: SprintInput!) {
    createSprint(projectId: $projectId, input: $input)
  }
`);

const UpdateSprintDocument = graphql(`
  mutation UpdateSprint($id: ID!, $input: SprintInput!) {
    updateSprint(id: $id, input: $input)
  }
`);

const DeleteSprintDocument = graphql(`
  mutation DeleteSprint($id: ID!) {
    deleteSprint(id: $id)
  }
`);

interface SprintInputValues {
  label: string;
  goal: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Create, update and delete project sprints.
 * @returns {object} Sprint mutations.
 */
export function useSprintMutations() {
  return {
    create: useTasksMutation(async (variables: { projectId: string; input: SprintInputValues }) => (await execute(CreateSprintDocument, variables)).createSprint),
    update: useTasksMutation(async (variables: { id: string; input: SprintInputValues }) => (await execute(UpdateSprintDocument, variables)).updateSprint),
    remove: useTasksMutation(async (variables: { id: string }) => (await execute(DeleteSprintDocument, variables)).deleteSprint),
  };
}
