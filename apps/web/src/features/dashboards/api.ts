import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { DashboardsQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Dashboard = DashboardsQuery['dashboards'][number];
export type DashboardChart = Dashboard['charts'][number];

const dashboardsKey = ['dashboards'] as const;

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
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardsKey }) });
}

export interface ChartValues {
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
    move: useDashboardMutation(async (variables: { id: string; index: number }) => (await execute(MoveDashboard, variables)).moveDashboard),
    createChart: useDashboardMutation(async (variables: { dashboardId: string; input: ChartValues }) => (await execute(CreateChart, variables)).createDashboardChart),
    updateChart: useDashboardMutation(async (variables: { id: string; input: ChartValues }) => (await execute(UpdateChart, variables)).updateDashboardChart),
    duplicateChart: useDashboardMutation(async (id: string) => (await execute(DuplicateChart, { id })).duplicateDashboardChart),
    transferChart: useDashboardMutation(async (variables: { id: string; dashboardId: string | null; projectId: string | null }) => (await execute(TransferChart, variables)).transferDashboardChart),
    removeChart: useDashboardMutation(async (id: string) => (await execute(DeleteChart, { id })).deleteDashboardChart),
    moveChart: useMoveChart(),
  };
}

/**
 * Moves a chart in its dashboard, reordering the cached dashboards at once (drag and drop).
 * @returns {UseMutationResult} Mutation state.
 */
function useMoveChart() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, { id: string; index: number }, { previous: [readonly unknown[], Dashboard[] | undefined][] }>({
    mutationFn: async (variables) => (await execute(MoveChart, variables)).moveDashboardChart,
    onMutate: async ({ id, index }) => {
      await queryClient.cancelQueries({ queryKey: dashboardsKey });
      const previous = queryClient.getQueriesData<Dashboard[]>({ queryKey: dashboardsKey });
      queryClient.setQueriesData<Dashboard[]>({ queryKey: dashboardsKey }, (dashboards) =>
        dashboards?.map((dashboard) => {
          const moved = dashboard.charts.find((chart) => chart.id === id);
          if (!moved) return dashboard;
          const others = dashboard.charts.filter((chart) => chart.id !== id);
          return { ...dashboard, charts: [...others.slice(0, index), moved, ...others.slice(index)] };
        }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardsKey }),
  });
}
