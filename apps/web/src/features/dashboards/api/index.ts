import { tasksQueryKey } from '../../tasks/api';
import { useQuery } from '@tanstack/react-query';
import { moveToIndex, useInvalidatingMutation } from '../../../lib/mutation';
import { graphql } from '../../../graphql';
import type { DashboardsQuery, SprintTaskStatusesQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type Dashboard = DashboardsQuery['dashboards'][number];
export type DashboardChart = Dashboard['charts'][number];

const dashboardsKey = ['dashboards'] as const;

export type SprintTaskStatus = SprintTaskStatusesQuery['sprintTaskStatuses'][number];

const SprintTaskStatusesDocument = graphql(`
  query SprintTaskStatuses($today: Date!) {
    sprintTaskStatuses(today: $today) {
      sprintId
      taskId
      statusId
      closed
    }
  }
`);

/**
 * Status of the tasks of the ended sprints at the end of each sprint, by "sprint|task".
 * @param {string} today User's day.
 * @param {boolean} enabled Loaded (charts by sprint or filtered on it).
 * @returns {UseQueryResult<Map<string, SprintTaskStatus>>} Query state.
 */
export function useSprintTaskStatuses(today: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...tasksQueryKey, 'sprint-statuses', today],
    queryFn: async () => new Map((await execute(SprintTaskStatusesDocument, { today })).sprintTaskStatuses.map((item) => [`${item.sprintId}|${item.taskId}`, item])),
  });
}

const DashboardsDocument = graphql(`
  query Dashboards($projectId: ID) {
    dashboards(projectId: $projectId) {
      id
      projectId
      name
      position
      charts {
        id
        dashboardId
        title
        config
        wide
        position
      }
    }
  }
`);

const CreateDashboard = graphql(`
  mutation CreateDashboard($name: String!, $projectId: ID) {
    createDashboard(name: $name, projectId: $projectId)
  }
`);
const RenameDashboard = graphql(`
  mutation RenameDashboard($id: ID!, $name: String!) {
    renameDashboard(id: $id, name: $name)
  }
`);
const DeleteDashboard = graphql(`
  mutation DeleteDashboard($id: ID!) {
    deleteDashboard(id: $id)
  }
`);
const MoveDashboard = graphql(`
  mutation MoveDashboard($id: ID!, $index: Int!) {
    moveDashboard(id: $id, index: $index)
  }
`);
const CreateChart = graphql(`
  mutation CreateDashboardChart($dashboardId: ID!, $input: DashboardChartInput!) {
    createDashboardChart(dashboardId: $dashboardId, input: $input)
  }
`);
const UpdateChart = graphql(`
  mutation UpdateDashboardChart($id: ID!, $input: DashboardChartInput!) {
    updateDashboardChart(id: $id, input: $input)
  }
`);
const DuplicateChart = graphql(`
  mutation DuplicateDashboardChart($id: ID!) {
    duplicateDashboardChart(id: $id)
  }
`);
const TransferChart = graphql(`
  mutation TransferDashboardChart($id: ID!, $dashboardId: ID, $projectId: ID) {
    transferDashboardChart(id: $id, dashboardId: $dashboardId, projectId: $projectId)
  }
`);
const DeleteChart = graphql(`
  mutation DeleteDashboardChart($id: ID!) {
    deleteDashboardChart(id: $id)
  }
`);
const MoveChart = graphql(`
  mutation MoveDashboardChart($id: ID!, $index: Int!) {
    moveDashboardChart(id: $id, index: $index)
  }
`);

/**
 * Dashboards of a project, or the global ones, with their charts.
 * @param {string | null} projectId Project, or null.
 * @returns {UseQueryResult} Query state.
 */
export function useDashboards(projectId: string | null) {
  return useQuery({ queryKey: [...dashboardsKey, projectId], queryFn: async () => (await execute(DashboardsDocument, { projectId })).dashboards });
}

/**
 * Mutation refreshing the dashboards once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useDashboardMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  return useInvalidatingMutation(mutationFn, { invalidate: [dashboardsKey] });
}

interface ChartValues {
  title: string;
  config: unknown;
  wide: boolean;
}

/**
 * Dashboards and charts edition.
 * @returns {object} Mutations.
 */
export function useDashboardMutations() {
  return {
    create: useDashboardMutation(async (variables: { name: string; projectId: string | null }) => (await execute(CreateDashboard, variables)).createDashboard),
    rename: useDashboardMutation(async (variables: { id: string; name: string }) => (await execute(RenameDashboard, variables)).renameDashboard),
    remove: useDashboardMutation(async (id: string) => (await execute(DeleteDashboard, { id })).deleteDashboard),
    move: useMoveDashboard(),
    createChart: useDashboardMutation(async (variables: { dashboardId: string; input: ChartValues }) => (await execute(CreateChart, variables)).createDashboardChart),
    updateChart: useDashboardMutation(async (variables: { id: string; input: ChartValues }) => (await execute(UpdateChart, variables)).updateDashboardChart),
    duplicateChart: useDashboardMutation(async (id: string) => (await execute(DuplicateChart, { id })).duplicateDashboardChart),
    transferChart: useDashboardMutation(async (variables: { id: string; dashboardId: string | null; projectId: string | null }) => (await execute(TransferChart, variables)).transferDashboardChart),
    removeChart: useDashboardMutation(async (id: string) => (await execute(DeleteChart, { id })).deleteDashboardChart),
    moveChart: useMoveChart(),
  };
}

/**
 * Moves a dashboard among those of its scope, reordering the cached dashboards at once (drag and drop of its tab).
 * @returns {UseMutationResult} Mutation state.
 */
function useMoveDashboard() {
  return useInvalidatingMutation(async (variables: { id: string; index: number }) => (await execute(MoveDashboard, variables)).moveDashboard, {
    invalidate: [dashboardsKey],
    optimistic: (queryClient, { id, index }) => queryClient.setQueriesData<Dashboard[]>({ queryKey: dashboardsKey }, (dashboards) => (dashboards && moveToIndex(dashboards, id, index)) ?? dashboards),
  });
}

/**
 * Moves a chart in its dashboard, reordering the cached dashboards at once (drag and drop).
 * @returns {UseMutationResult} Mutation state.
 */
function useMoveChart() {
  return useInvalidatingMutation(async (variables: { id: string; index: number }) => (await execute(MoveChart, variables)).moveDashboardChart, {
    invalidate: [dashboardsKey],
    optimistic: (queryClient, { id, index }) =>
      queryClient.setQueriesData<Dashboard[]>({ queryKey: dashboardsKey }, (dashboards) =>
        dashboards?.map((dashboard) => {
          const charts = moveToIndex(dashboard.charts, id, index);
          return charts ? { ...dashboard, charts } : dashboard;
        }),
      ),
  });
}
