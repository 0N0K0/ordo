import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { ViewKind } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { moveToIndex, useInvalidatingMutation } from '../../../lib/mutation';

export type { ViewKind };

const TaskViewsDocument = graphql(`
  query TaskViews($projectId: ID, $kind: ViewKind, $tableKey: String) {
    taskViews(projectId: $projectId, kind: $kind, tableKey: $tableKey) {
      id
      name
      config
      isDefault
      position
    }
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

export interface TaskViewRecord {
  id: string;
  name: string;
  /** Raw configuration (of a table view: parsed with tableViewConfigSchema). */
  config: unknown;
  isDefault: boolean;
  position: number;
}

const taskViewsQueryKey = ['taskViews'] as const;

/**
 * Saved views of the tasks (or of the routines) of a project's tab (or of their page), in tab order.
 * @param {string | null} projectId Project, or null for the page.
 * @param {ViewKind} [kind] Tasks, routines, shopping lists or another table. Optional. Default = 'TASKS'.
 * @param {string | null} [tableKey] Table of the views of kind TABLE. Optional.
 * @returns {UseQueryResult<TaskViewRecord[]>} Query state.
 */
export function useTaskViews(projectId: string | null, kind: ViewKind = 'TASKS', tableKey: string | null = null) {
  return useQuery({
    queryKey: [...taskViewsQueryKey, kind, tableKey, projectId],
    queryFn: async () => (await execute(TaskViewsDocument, { projectId, kind, tableKey })).taskViews as TaskViewRecord[],
  });
}

/**
 * Mutation refreshing the view list afterwards.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult<TResult, Error, TVariables>} Mutation state.
 */
function useViewMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return useInvalidatingMutation(mutationFn, { invalidate: [taskViewsQueryKey] });
}

/**
 * Create, save, duplicate, delete, reorder views and choose the default one.
 * @returns {object} View mutations.
 */
export function useTaskViewMutations() {
  return {
    create: useViewMutation(
      async (input: { name: string; config: unknown; projectId: string | null; kind?: ViewKind; tableKey?: string | null }) => (await execute(CreateTaskViewDocument, { input })).createTaskView,
    ),
    update: useViewMutation(async (variables: { id: string; input: { name?: string; config?: unknown } }) => (await execute(UpdateTaskViewDocument, variables)).updateTaskView),
    duplicate: useViewMutation(async (variables: { id: string; name: string }) => (await execute(DuplicateTaskViewDocument, variables)).duplicateTaskView),
    remove: useViewMutation(async (variables: { id: string }) => (await execute(DeleteTaskViewDocument, variables)).deleteTaskView),
    setDefault: useViewMutation(async (variables: { id: string }) => (await execute(SetDefaultTaskViewDocument, variables)).setDefaultTaskView),
    move: useInvalidatingMutation(async (variables: { id: string; index: number }) => (await execute(MoveTaskViewDocument, variables)).moveTaskView, {
      invalidate: [taskViewsQueryKey],
      // The tab stays where it was dropped while the server reorders.
      optimistic: (queryClient, { id, index }) => {
        for (const [key, views] of queryClient.getQueriesData<TaskViewRecord[]>({ queryKey: taskViewsQueryKey })) {
          const order = views && moveToIndex(views, id, index);
          if (order) queryClient.setQueryData(key, order);
        }
      },
    }),
  };
}
