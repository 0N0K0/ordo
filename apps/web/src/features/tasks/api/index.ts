import type { TaskInput } from '@ordo/shared';
import { accountingQueryKey } from '../../accounting/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moveToIndex, patchQuery, useInvalidatingMutation } from '../../../lib/mutation';
import { byPosition, readTaskColumnDefaults, type TaskColumnDefaults, movedTo } from '@ordo/shared';
import { graphql } from '../../../graphql';
import type {
  ContributorFieldsFragment,
  MilestoneFieldsFragment,
  SprintFieldsFragment,
  TaskCommentFieldsFragment,
  TaskFieldsFragment,
  TaskLabelFieldsFragment,
  TasksDataQuery,
  TaskStatusCategory,
  TypedDocumentString,
} from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

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
    position
    archived
    createdAt
    updatedAt
    assigneeIds
    beneficiaryIds
    beneficiaryRelationIds
    tagIds
    blockingIds
    blockedByIds
    relatedIds
    commentCount
    trackedSeconds
    recurrence
    seriesId
    occurrenceDate
    closed
    closedAt
    githubLinked
    githubUrl
    githubNumber
    slotRule
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
  mutation UpdateTask($id: ID!, $input: TaskUpdateInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
`);

const CloneTaskDocument = graphql(`
  mutation CloneTask($id: ID!, $includeSubtasks: Boolean!) {
    cloneTask(id: $id, includeSubtasks: $includeSubtasks) {
      id
      number
    }
  }
`);

const SetTaskRecurrenceDocument = graphql(`
  mutation SetTaskRecurrence($id: ID!, $recurrence: JSON) {
    setTaskRecurrence(id: $id, recurrence: $recurrence) {
      id
    }
  }
`);

/**
 * Makes a task recurring, changes its repetition, or stops it (null).
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTaskRecurrence() {
  return useTasksMutation(async (variables: { id: string; recurrence: unknown }) => (await execute(SetTaskRecurrenceDocument, variables)).setTaskRecurrence);
}

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
  mutation CreateContributor($input: ContributorInput!) {
    createContributor(input: $input) {
      ...ContributorFields
    }
  }
`);

const UpdateContributorDocument = graphql(`
  mutation UpdateContributor($id: ID!, $input: ContributorUpdateInput!) {
    updateContributor(id: $id, input: $input) {
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
  mutation DeleteContributor($id: ID!) {
    deleteContributor(id: $id)
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

const TaskColumnDefaultsDocument = graphql(`
  query TaskColumnDefaults {
    taskColumnDefaults {
      columnOrder
      hiddenColumns
    }
  }
`);

const SetTaskColumnDefaults = graphql(`
  mutation SetTaskColumnDefaults($columnOrder: [String!], $hiddenColumns: [String!]) {
    setTaskColumnDefaults(columnOrder: $columnOrder, hiddenColumns: $hiddenColumns) {
      columnOrder
      hiddenColumns
    }
  }
`);

const taskColumnDefaultsKey = ['task-column-defaults'] as const;

/**
 * Columns new task views of the workspace start with: their order and those hidden.
 * @returns {UseQueryResult<TaskColumnDefaults>} Query state.
 */
export function useTaskColumnDefaults() {
  return useQuery({
    queryKey: taskColumnDefaultsKey,
    queryFn: async () => readTaskColumnDefaults((await execute(TaskColumnDefaultsDocument)).taskColumnDefaults),
  });
}

/**
 * Chooses the columns new task views start with (null: those of the app again).
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTaskColumnDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (columns: TaskColumnDefaults | null) =>
      readTaskColumnDefaults((await execute(SetTaskColumnDefaults, { columnOrder: columns?.columnOrder ?? null, hiddenColumns: columns?.hiddenColumns ?? null })).setTaskColumnDefaults),
    // Shown at once; the server's answer replaces it.
    onMutate: (columns) => queryClient.setQueryData(taskColumnDefaultsKey, readTaskColumnDefaults(columns)),
    onSuccess: (columns) => queryClient.setQueryData(taskColumnDefaultsKey, columns),
    onError: () => queryClient.invalidateQueries({ queryKey: taskColumnDefaultsKey }),
  });
}

export const tasksQueryKey = ['tasks'] as const;

/**
 * Tasks, contributors, statuses, priorities and types.
 * @returns {UseQueryResult<TasksData>} Query state.
 */
export function useTasksData() {
  return useQuery({ queryKey: tasksQueryKey, queryFn: () => execute(TasksDataDocument) });
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

/**
 * Creates a task.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateTask() {
  return useTasksMutation(async (input: TaskInputValues & { label: string }) => (await execute(CreateTaskDocument, { input })).createTask);
}

/**
 * Updates a task (the project changes through a transfer).
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateTask() {
  return useTasksMutation(async ({ id, input }: { id: string; input: Omit<TaskInputValues, 'projectId'> }) => (await execute(UpdateTaskDocument, { id, input })).updateTask);
}

const SetTasksClosedDocument = graphql(`
  mutation SetTasksClosed($ids: [ID!]!, $closed: Boolean!) {
    setTasksClosed(ids: $ids, closed: $closed)
  }
`);

/**
 * Closes (done) or reopens tasks; the cached tasks change right away.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTasksClosed() {
  return useInvalidatingMutation(async (variables: { ids: string[]; closed: boolean }) => (await execute(SetTasksClosedDocument, variables)).setTasksClosed, {
    invalidate: [tasksQueryKey],
    optimistic: (queryClient, { ids, closed }) =>
      patchQuery<TasksData>(queryClient, tasksQueryKey, (data) => ({ ...data, tasks: data.tasks.map((task) => (ids.includes(task.id) ? { ...task, closed } : task)) })),
  });
}

/**
 * Clones a task, optionally with its sub-tasks.
 * @returns {UseMutationResult} Mutation state, with the clone number.
 */
export function useCloneTask() {
  return useTasksMutation(async (variables: { id: string; includeSubtasks: boolean }) => (await execute(CloneTaskDocument, variables)).cloneTask);
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
  return {
    create: useTasksMutation(async (input: { name: string; handle: string; avatar?: File | null; projectIds?: string[] }) => (await execute(CreateContributorDocument, { input })).createContributor),
    update: useTasksMutation(
      async (variables: { id: string; input: { name?: string; handle?: string; avatar?: File | null; removeAvatar?: boolean; projectIds?: string[] } }) =>
        (await execute(UpdateContributorDocument, variables)).updateContributor,
    ),
    // Members and relations (treasury) follow: a relation loses its contributor.
    remove: useInvalidatingMutation(async (variables: { id: string }) => (await execute(DeleteContributorDocument, variables)).deleteContributor, {
      invalidate: [tasksQueryKey, accountingQueryKey],
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
    }
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

const DoableTaskIdsDocument = graphql(`
  query DoableTaskIds($utcOffset: Int!) {
    doableTaskIds(utcOffset: $utcOffset)
  }
`);

/**
 * Open tasks that can be done now (their slot rule, the events of their people), refreshed every minute; asked only
 * when a filter needs it.
 * @param {boolean} enabled Asked.
 * @returns {Set<string> | undefined} Ids.
 */
export function useDoableTaskIds(enabled: boolean) {
  const { data } = useQuery({
    queryKey: [...tasksQueryKey, 'doable'],
    queryFn: async () => new Set((await execute(DoableTaskIdsDocument, { utcOffset: -new Date().getTimezoneOffset() })).doableTaskIds),
    enabled,
    refetchInterval: 60_000,
  });
  return data;
}

export interface BulkChanges {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  milestoneId?: string | null;
  addSprintIds?: string[];
  removeSprintIds?: string[];
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  minDate?: string | null;
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addTagIds?: string[];
  removeTagIds?: string[];
}

/**
 * Bulk changes, transfer, archiving and deletion of selected tasks.
 * @returns {object} Bulk mutations.
 */
export function useBulkTaskMutations() {
  return {
    update: useTasksMutation(
      // `restoring`: an undo, the archived values given back accepted.
      async (variables: { ids: string[]; changes: BulkChanges; restoring?: boolean }) => (await execute(BulkUpdateTasksDocument, variables)).bulkUpdateTasks,
    ),
    transfer: useTasksMutation(async (variables: { ids: string[]; projectId: string | null }) => (await execute(BulkTransferTasksDocument, variables)).bulkTransferTasks),
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
