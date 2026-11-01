import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type {
  ContributorFieldsFragment,
  TaskCommentFieldsFragment,
  TaskFieldsFragment,
  TaskLabelFieldsFragment,
  TasksDataQuery,
  TypedDocumentString,
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Task = TaskFieldsFragment;
export type TaskComment = TaskCommentFieldsFragment;
export type Contributor = ContributorFieldsFragment;
export type TaskLabel = TaskLabelFieldsFragment;
export type TasksData = TasksDataQuery;

graphql(`
  fragment ContributorFields on Contributor {
    id
    name
    handle
    avatarUrl
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
    position
    archived
    createdAt
    updatedAt
    assigneeIds
    blockingIds
    blockedByIds
    relatedIds
    commentCount
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
      async (input: { name: string; handle: string; avatar?: File | null }) =>
        (await execute(CreateContributorDocument, { input })).createContributor,
    ),
    update: useTasksMutation(
      async (variables: {
        id: string;
        input: { name?: string; handle?: string; avatar?: File | null; removeAvatar?: boolean };
      }) => (await execute(UpdateContributorDocument, variables)).updateContributor,
    ),
    remove: useTasksMutation(
      async (variables: { id: string }) => (await execute(DeleteContributorDocument, variables)).deleteContributor,
    ),
  };
}

export type TaskLabelKind = keyof typeof LabelDocuments;

/**
 * CRUD and ordering of a task label table (status, priority or type).
 * @param {TaskLabelKind} kind Label table.
 * @returns {object} Label mutations, shaped for the settings label manager.
 */
export function useTaskLabelMutations(kind: TaskLabelKind) {
  // The three tables share their variables; results are not read (the data is refetched).
  const documents = LabelDocuments[kind] as {
    create: TypedDocumentString<unknown, { input: { name: string; color: string } }>;
    update: TypedDocumentString<unknown, { id: string; input: { name?: string; color?: string } }>;
    remove: TypedDocumentString<unknown, { id: string }>;
    move: TypedDocumentString<unknown, { id: string; index: number }>;
  };
  return {
    create: useTasksMutation(async (input: { name: string; color: string }) => execute(documents.create, { input })),
    update: useTasksMutation(async (variables: { id: string; input: { name?: string; color?: string } }) =>
      execute(documents.update, variables),
    ),
    remove: useTasksMutation(async (variables: { id: string }) => execute(documents.remove, variables)),
    move: useTasksMutation(async (variables: { id: string; index: number }) => execute(documents.move, variables)),
  };
}
