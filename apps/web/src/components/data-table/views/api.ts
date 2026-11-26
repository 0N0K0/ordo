import { readTableColumnDefaults, type TableColumnDefaults } from '@ordo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { ViewKind } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { moveToIndex, useInvalidatingMutation } from '../../../lib/mutation';

export type { ViewKind };

const TaskViewsDocument = graphql(`
  query TaskViews($projectId: ID, $kind: ViewKind, $tableKey: String) {
    taskViews(projectId: $projectId, kind: $kind, tableKey: $tableKey) {
      id
      label
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
  mutation DuplicateTaskView($id: ID!, $label: String!) {
    duplicateTaskView(id: $id, label: $label) {
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
  label: string;
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
    queryFn: () => fetchTaskViews(projectId, kind, tableKey),
  });
}

/**
 * Saved views of a scope, read from the API (`useTaskViews` keeps them in the cache).
 * @param {string | null} projectId Project, or null for the page.
 * @param {ViewKind} kind Kind of views.
 * @param {string | null} tableKey Table of the views of kind TABLE.
 * @returns {Promise<TaskViewRecord[]>} Views.
 */
export async function fetchTaskViews(projectId: string | null, kind: ViewKind, tableKey: string | null): Promise<TaskViewRecord[]> {
  return (await execute(TaskViewsDocument, { projectId, kind, tableKey })).taskViews as TaskViewRecord[];
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
      async (input: { label: string; config: unknown; projectId: string | null; kind?: ViewKind; tableKey?: string | null }) => (await execute(CreateTaskViewDocument, { input })).createTaskView,
    ),
    update: useViewMutation(async (variables: { id: string; input: { label?: string; config?: unknown } }) => (await execute(UpdateTaskViewDocument, variables)).updateTaskView),
    duplicate: useViewMutation(async (variables: { id: string; label: string }) => (await execute(DuplicateTaskViewDocument, variables)).duplicateTaskView),
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

const TableColumnDefaultsDocument = graphql(`
  query TableColumnDefaults($tableKey: String!) {
    tableColumnDefaults(tableKey: $tableKey) {
      columnOrder
      hiddenColumns
    }
  }
`);

const SetTableColumnDefaultsDocument = graphql(`
  mutation SetTableColumnDefaults($tableKey: String!, $layout: TableColumnLayoutInput) {
    setTableColumnDefaults(tableKey: $tableKey, layout: $layout) {
      columnOrder
      hiddenColumns
    }
  }
`);

/**
 * Cache key of the default columns of a table.
 * @param {string} tableKey Table.
 * @returns {readonly string[]} Query key.
 */
const tableColumnDefaultsKey = (tableKey: string) => ['table-column-defaults', tableKey] as const;

/**
 * Columns new views of a table of the workspace start with: their order and those hidden.
 * @param {string} tableKey Table.
 * @returns {UseQueryResult<TableColumnDefaults>} Query state.
 */
export function useTableColumnDefaults(tableKey: string) {
  return useQuery({
    queryKey: tableColumnDefaultsKey(tableKey),
    queryFn: async () => readTableColumnDefaults((await execute(TableColumnDefaultsDocument, { tableKey })).tableColumnDefaults, tableKey),
  });
}

/**
 * Chooses the columns new views of a table start with (null: those of the app again).
 * @param {string} tableKey Table.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetTableColumnDefaults(tableKey: string) {
  const queryClient = useQueryClient();
  const key = tableColumnDefaultsKey(tableKey);
  return useMutation({
    mutationFn: async (columns: TableColumnDefaults | null) =>
      readTableColumnDefaults((await execute(SetTableColumnDefaultsDocument, { tableKey, layout: columns })).setTableColumnDefaults, tableKey),
    // Shown at once; the server's answer replaces it.
    onMutate: (columns) => queryClient.setQueryData(key, readTableColumnDefaults(columns, tableKey)),
    onSuccess: (columns) => queryClient.setQueryData(key, columns),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
