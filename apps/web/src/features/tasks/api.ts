import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
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
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Task = TaskFieldsFragment;
export type TaskComment = TaskCommentFieldsFragment;
export type Contributor = ContributorFieldsFragment;
export type TaskLabel = TaskLabelFieldsFragment;
export type TaskStatus = TasksDataQuery['taskStatuses'][number];
export type Milestone = MilestoneFieldsFragment;
export type Sprint = SprintFieldsFragment;
export type { TaskStatusCategory };
export type TasksData = TasksDataQuery;

graphql(`
  fragment ContributorFields on Contributor {
    id
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
    projectId
    name
    goal
    startDate
    endDate
  }
`);

graphql(`
  fragment MilestoneFields on Milestone {
    id
    projectId
    title
    description
    dueDate
    position
  }
`);

graphql(`
  fragment TaskLabelFields on TaskStatus {
    id
    name
    color
    position
  }
`);

graphql(`
  fragment TaskFields on Task {
    id
    number
    title
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
    sprintId
    position
    archived
    createdAt
    updatedAt
    assigneeIds
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
  }
`);

graphql(`
  fragment TaskCommentFields on TaskComment {
    id
    body
    createdAt
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
      name
      color
      position
    }
    taskTypes {
      id
      name
      color
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
  query TaskComments($number: Int!) {
    task(number: $number) {
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

const SetTaskArchivedDocument = graphql(`
  mutation SetTaskArchived($id: ID!, $archived: Boolean!) {
    setTaskArchived(id: $id, archived: $archived) {
      id
    }
  }
`);

const DeleteTaskDocument = graphql(`
  mutation DeleteTask($id: ID!, $deleteSubtasks: Boolean!) {
    deleteTask(id: $id, deleteSubtasks: $deleteSubtasks)
  }
`);

const TransferTaskDocument = graphql(`
  mutation TransferTask($id: ID!, $projectId: ID!) {
    transferTask(id: $id, projectId: $projectId) {
      removedLinks
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
  return useTasksMutation(
    async (variables: { id: string; recurrence: unknown }) => (await execute(SetTaskRecurrenceDocument, variables)).setTaskRecurrence,
  );
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
    move: graphql(`
      mutation MoveTaskStatus($id: ID!, $index: Int!) {
        moveTaskStatus(id: $id, index: $index)
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
    move: graphql(`
      mutation MoveTaskPriority($id: ID!, $index: Int!) {
        moveTaskPriority(id: $id, index: $index)
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
    move: graphql(`
      mutation MoveTaskType($id: ID!, $index: Int!) {
        moveTaskType(id: $id, index: $index)
      }
    `),
  },
};

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
 * @param {number} number Task number.
 * @returns {UseQueryResult<TaskComment[]>} Query state.
 */
export function useTaskComments(number: number) {
  return useQuery({
    queryKey: [...tasksQueryKey, number, 'comments'],
    queryFn: async () => (await execute(TaskCommentsDocument, { number })).task?.comments ?? [],
  });
}

/**
 * Mutation refreshing the task data afterwards.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult<TResult, Error, TVariables>} Mutation state.
 */
function useTasksMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
  });
}

export interface TaskInputValues {
  title?: string;
  projectId?: string;
  description?: string | null;
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  assigneeIds?: string[];
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  parentId?: string | null;
  milestoneId?: string | null;
  sprintId?: string | null;
}

/**
 * Creates a task.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateTask() {
  return useTasksMutation(
    async (input: TaskInputValues & { title: string; projectId: string }) =>
      (await execute(CreateTaskDocument, { input })).createTask,
  );
}

/**
 * Updates a task (the project changes through a transfer).
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateTask() {
  return useTasksMutation(
    async ({ id, input }: { id: string; input: Omit<TaskInputValues, 'projectId'> }) =>
      (await execute(UpdateTaskDocument, { id, input })).updateTask,
  );
}

/**
 * Archives or restores a task (with its sub-tasks).
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTaskArchived() {
  return useTasksMutation(
    async (variables: { id: string; archived: boolean }) => (await execute(SetTaskArchivedDocument, variables)).setTaskArchived,
  );
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
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, { ids: string[]; closed: boolean }, { previous?: TasksData }>({
    mutationFn: async (variables) => (await execute(SetTasksClosedDocument, variables)).setTasksClosed,
    onMutate: async ({ ids, closed }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = queryClient.getQueryData<TasksData>(tasksQueryKey);
      if (previous) {
        queryClient.setQueryData<TasksData>(tasksQueryKey, {
          ...previous,
          tasks: previous.tasks.map((task) => (ids.includes(task.id) ? { ...task, closed } : task)),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(tasksQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
  });
}

/**
 * Deletes a task, deleting or detaching its sub-tasks.
 * @returns {UseMutationResult} Mutation state.
 */
export function useDeleteTask() {
  return useTasksMutation(
    async (variables: { id: string; deleteSubtasks: boolean }) => (await execute(DeleteTaskDocument, variables)).deleteTask,
  );
}

/**
 * Transfers a task and its sub-tasks to another project.
 * @returns {UseMutationResult} Mutation state, with the number of removed links.
 */
export function useTransferTask() {
  return useTasksMutation(
    async (variables: { id: string; projectId: string }) => (await execute(TransferTaskDocument, variables)).transferTask,
  );
}

/**
 * Clones a task, optionally with its sub-tasks.
 * @returns {UseMutationResult} Mutation state, with the clone number.
 */
export function useCloneTask() {
  return useTasksMutation(
    async (variables: { id: string; includeSubtasks: boolean }) => (await execute(CloneTaskDocument, variables)).cloneTask,
  );
}

/**
 * Moves a task before another one in the manual order (at the end when beforeId is null), and under a new
 * parent when `parentId` is given (null: top-level task).
 * The cached list is reordered right away.
 * @returns {UseMutationResult} Mutation state.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation<
    boolean,
    Error,
    { id: string; beforeId: string | null; parentId?: string | null },
    { previous?: TasksData }
  >({
    mutationFn: async (variables) => (await execute(MoveTaskDocument, variables)).moveTask,
    onMutate: async ({ id, beforeId, parentId }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = queryClient.getQueryData<TasksData>(tasksQueryKey);
      if (previous) {
        const ordered = [...previous.tasks].sort((a, b) => a.position - b.position);
        const moved = ordered.find((task) => task.id === id);
        const others = ordered.filter((task) => task.id !== id);
        const index = beforeId ? others.findIndex((task) => task.id === beforeId) : others.length;
        if (moved && index >= 0) {
          const order = [...others.slice(0, index), parentId === undefined ? moved : { ...moved, parentId }, ...others.slice(index)];
          queryClient.setQueryData<TasksData>(tasksQueryKey, {
            ...previous,
            tasks: order.map((task, position) => ({ ...task, position })),
          });
        }
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(tasksQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
  });
}

/**
 * Adds or removes a "blocks" link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useTaskBlock() {
  return useTasksMutation(async ({ add, ...variables }: { add: boolean; blockerId: string; blockedId: string }) =>
    add
      ? (await execute(AddTaskBlockDocument, variables)).addTaskBlock
      : (await execute(RemoveTaskBlockDocument, variables)).removeTaskBlock,
  );
}

/**
 * Adds or removes a "related to" link.
 * @returns {UseMutationResult} Mutation state.
 */
export function useTaskRelation() {
  return useTasksMutation(async ({ add, ...variables }: { add: boolean; taskId: string; otherId: string }) =>
    add
      ? (await execute(AddTaskRelationDocument, variables)).addTaskRelation
      : (await execute(RemoveTaskRelationDocument, variables)).removeTaskRelation,
  );
}

/**
 * Adds, edits or deletes a comment.
 * @returns {object} Comment mutations.
 */
export function useTaskCommentMutations() {
  return {
    add: useTasksMutation(
      async (variables: { taskId: string; body: string }) => (await execute(AddTaskCommentDocument, variables)).addTaskComment,
    ),
    update: useTasksMutation(
      async (variables: { id: string; body: string }) => (await execute(UpdateTaskCommentDocument, variables)).updateTaskComment,
    ),
    remove: useTasksMutation(
      async (variables: { id: string }) => (await execute(DeleteTaskCommentDocument, variables)).deleteTaskComment,
    ),
  };
}

/**
 * Creates, updates or deletes a contributor.
 * @returns {object} Contributor mutations.
 */
export function useContributorMutations() {
  return {
    create: useTasksMutation(
      async (input: { name: string; handle: string; avatar?: File | null; projectIds?: string[] }) =>
        (await execute(CreateContributorDocument, { input })).createContributor,
    ),
    update: useTasksMutation(
      async (variables: {
        id: string;
        input: { name?: string; handle?: string; avatar?: File | null; removeAvatar?: boolean; projectIds?: string[] };
      }) => (await execute(UpdateContributorDocument, variables)).updateContributor,
    ),
    remove: useTasksMutation(
      async (variables: { id: string }) => (await execute(DeleteContributorDocument, variables)).deleteContributor,
    ),
    setProjectContributors: useTasksMutation(
      async (variables: { projectId: string; contributorIds: string[] }) =>
        (await execute(SetProjectContributorsDocument, variables)).setProjectContributors,
    ),
  };
}

export type TaskLabelKind = keyof typeof LabelDocuments;

/** Label fields; the category only applies to statuses. */
interface LabelInput {
  name: string;
  color: string;
  category?: TaskStatusCategory;
}

/**
 * CRUD and ordering of a task label table (status, priority or type).
 * @param {TaskLabelKind} kind Label table.
 * @returns {object} Label mutations, shaped for the settings label manager.
 */
export function useTaskLabelMutations(kind: TaskLabelKind) {
  // The three tables share their variables; results are not read (the data is refetched).
  const documents = LabelDocuments[kind] as {
    create: TypedDocumentString<unknown, { input: LabelInput }>;
    update: TypedDocumentString<unknown, { id: string; input: Partial<LabelInput> }>;
    remove: TypedDocumentString<unknown, { id: string }>;
    move: TypedDocumentString<unknown, { id: string; index: number }>;
  };
  return {
    create: useTasksMutation(async (input: LabelInput) => execute(documents.create, { input })),
    update: useTasksMutation(async (variables: { id: string; input: Partial<LabelInput> }) =>
      execute(documents.update, variables),
    ),
    remove: useTasksMutation(async (variables: { id: string }) => execute(documents.remove, variables)),
    move: useTasksMutation(async (variables: { id: string; index: number }) => execute(documents.move, variables)),
  };
}

const TaskViewsDocument = graphql(`
  query TaskViews($projectId: ID) {
    taskViews(projectId: $projectId) {
      id
      name
      config
      isDefault
      position
    }
  }
`);

const MatchingTaskIdsDocument = graphql(`
  query MatchingTaskIds($query: TaskQueryInput!) {
    matchingTaskIds(query: $query)
  }
`);

const CreateTaskViewDocument = graphql(`
  mutation CreateTaskView($input: TaskViewInput!) {
    createTaskView(input: $input) {
      id
    }
  }
`);

const UpdateTaskViewDocument = graphql(`
  mutation UpdateTaskView($id: ID!, $input: TaskViewUpdateInput!) {
    updateTaskView(id: $id, input: $input) {
      id
    }
  }
`);

const DuplicateTaskViewDocument = graphql(`
  mutation DuplicateTaskView($id: ID!, $name: String!) {
    duplicateTaskView(id: $id, name: $name) {
      id
    }
  }
`);

const DeleteTaskViewDocument = graphql(`
  mutation DeleteTaskView($id: ID!) {
    deleteTaskView(id: $id)
  }
`);

const SetDefaultTaskViewDocument = graphql(`
  mutation SetDefaultTaskView($id: ID!) {
    setDefaultTaskView(id: $id)
  }
`);

const MoveTaskViewDocument = graphql(`
  mutation MoveTaskView($id: ID!, $index: Int!) {
    moveTaskView(id: $id, index: $index)
  }
`);

const BulkUpdateTasksDocument = graphql(`
  mutation BulkUpdateTasks($ids: [ID!]!, $changes: BulkTaskInput!) {
    bulkUpdateTasks(ids: $ids, changes: $changes)
  }
`);

const BulkTransferTasksDocument = graphql(`
  mutation BulkTransferTasks($ids: [ID!]!, $projectId: ID!) {
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

export interface TaskViewRecord {
  id: string;
  name: string;
  /** Raw configuration, parsed with taskViewConfigSchema. */
  config: unknown;
  isDefault: boolean;
  position: number;
}

export const taskViewsQueryKey = ['taskViews'] as const;

/**
 * Saved task views of a project's task tab (or of the home page), in tab order.
 * @param {string | null} projectId Project, or null for the home page.
 * @returns {UseQueryResult<TaskViewRecord[]>} Query state.
 */
export function useTaskViews(projectId: string | null) {
  return useQuery({
    queryKey: [...taskViewsQueryKey, projectId],
    queryFn: async () => (await execute(TaskViewsDocument, { projectId })).taskViews as TaskViewRecord[],
  });
}

export interface TaskQuery {
  filter: unknown;
  search: string;
  includeArchived: boolean;
  today: string;
  utcOffset: number;
}

/**
 * Ids of the tasks matching a filter (evaluated by the API), in manual order.
 * Refreshed with the task data.
 * @param {TaskQuery | null} query Filter, search and user clock; null while the view is loading.
 * @returns {UseQueryResult<string[]>} Query state; previous ids are kept while a new filter loads.
 */
export function useMatchingTaskIds(query: TaskQuery | null) {
  return useQuery({
    enabled: query !== null,
    queryKey: [...tasksQueryKey, 'matching', query],
    queryFn: async () => (await execute(MatchingTaskIdsDocument, { query: query! })).matchingTaskIds,
    placeholderData: (previous) => previous,
  });
}

/**
 * Mutation refreshing the view list afterwards.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult<TResult, Error, TVariables>} Mutation state.
 */
function useViewMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskViewsQueryKey }),
  });
}

/**
 * Create, save, duplicate, delete, reorder views and choose the default one.
 * @returns {object} View mutations.
 */
export function useTaskViewMutations() {
  return {
    create: useViewMutation(
      async (input: { name: string; config: unknown; projectId: string | null }) =>
        (await execute(CreateTaskViewDocument, { input })).createTaskView,
    ),
    update: useViewMutation(
      async (variables: { id: string; input: { name?: string; config?: unknown } }) =>
        (await execute(UpdateTaskViewDocument, variables)).updateTaskView,
    ),
    duplicate: useViewMutation(
      async (variables: { id: string; name: string }) => (await execute(DuplicateTaskViewDocument, variables)).duplicateTaskView,
    ),
    remove: useViewMutation(async (variables: { id: string }) => (await execute(DeleteTaskViewDocument, variables)).deleteTaskView),
    setDefault: useViewMutation(
      async (variables: { id: string }) => (await execute(SetDefaultTaskViewDocument, variables)).setDefaultTaskView,
    ),
    move: useViewMutation(
      async (variables: { id: string; index: number }) => (await execute(MoveTaskViewDocument, variables)).moveTaskView,
    ),
  };
}

export interface BulkChanges {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  milestoneId?: string | null;
  sprintId?: string | null;
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
}

/**
 * Bulk changes, transfer, archiving and deletion of selected tasks.
 * @returns {object} Bulk mutations.
 */
export function useBulkTaskMutations() {
  return {
    update: useTasksMutation(
      async (variables: { ids: string[]; changes: BulkChanges }) =>
        (await execute(BulkUpdateTasksDocument, variables)).bulkUpdateTasks,
    ),
    transfer: useTasksMutation(
      async (variables: { ids: string[]; projectId: string }) =>
        (await execute(BulkTransferTasksDocument, variables)).bulkTransferTasks,
    ),
    archive: useTasksMutation(
      async (variables: { ids: string[]; archived: boolean }) =>
        (await execute(BulkSetTasksArchivedDocument, variables)).bulkSetTasksArchived,
    ),
    remove: useTasksMutation(
      async (variables: { ids: string[]; deleteSubtasks: boolean }) =>
        (await execute(BulkDeleteTasksDocument, variables)).bulkDeleteTasks,
    ),
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

export interface MilestoneInputValues {
  title: string;
  description: string | null;
  dueDate: string | null;
}

/**
 * Create, update, delete and reorder project milestones.
 * @returns {object} Milestone mutations.
 */
export function useMilestoneMutations() {
  return {
    create: useTasksMutation(
      async (input: MilestoneInputValues & { projectId: string }) =>
        (await execute(CreateMilestoneDocument, { input })).createMilestone,
    ),
    update: useTasksMutation(
      async (variables: { id: string; input: Partial<MilestoneInputValues> }) =>
        (await execute(UpdateMilestoneDocument, variables)).updateMilestone,
    ),
    remove: useTasksMutation(async (variables: { id: string }) => (await execute(DeleteMilestoneDocument, variables)).deleteMilestone),
    move: useTasksMutation(
      async (variables: { id: string; index: number }) => (await execute(MoveMilestoneDocument, variables)).moveMilestone,
    ),
  };
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

export interface SprintInputValues {
  name: string;
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
    create: useTasksMutation(
      async (variables: { projectId: string; input: SprintInputValues }) => (await execute(CreateSprintDocument, variables)).createSprint,
    ),
    update: useTasksMutation(async (variables: { id: string; input: SprintInputValues }) => (await execute(UpdateSprintDocument, variables)).updateSprint),
    remove: useTasksMutation(async (variables: { id: string }) => (await execute(DeleteSprintDocument, variables)).deleteSprint),
  };
}
