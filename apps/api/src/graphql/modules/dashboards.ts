import { prisma } from '../../db';
import * as dashboards from '../../services/dashboards';
import { builder } from '../builder';

builder.prismaObject('Dashboard', {
  description: 'Dashboard of charts on the tasks, global or of a project tree.',
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId', { nullable: true }),
    name: t.exposeString('name'),
    position: t.exposeInt('position'),
    charts: t.relation('charts', { query: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } }),
  }),
});

builder.prismaObject('DashboardChart', {
  fields: (t) => ({
    id: t.exposeID('id'),
    dashboardId: t.exposeID('dashboardId'),
    title: t.exposeString('title'),
    config: t.field({ type: 'JSON', description: 'Chart configuration (shared chartConfigSchema).', resolve: (chart) => chart.config }),
    wide: t.exposeBoolean('wide'),
    position: t.exposeInt('position'),
  }),
});

const ChartInput = builder.inputType('DashboardChartInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    config: t.field({ type: 'JSON', required: true }),
    wide: t.boolean({ required: true }),
  }),
});

builder.queryFields((t) => ({
  dashboards: t.prismaField({
    type: ['Dashboard'],
    description: 'Dashboards of a project, or the global ones.',
    args: { projectId: t.arg.id() },
    resolve: (query, _root, { projectId }) =>
      prisma.dashboard.findMany({ ...query, where: { projectId: projectId ?? null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  createDashboard: t.id({
    args: { name: t.arg.string({ required: true }), projectId: t.arg.id() },
    resolve: async (_root, { name, projectId }) => (await dashboards.createDashboard(name, projectId ?? null)).id,
  }),
  renameDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: async (_root, { id, name }) => {
      await dashboards.renameDashboard(id, name);
      return true;
    },
  }),
  deleteDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await dashboards.deleteDashboard(id);
      return true;
    },
  }),
  moveDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await dashboards.moveDashboard(id, index);
      return true;
    },
  }),
  createDashboardChart: t.id({
    args: { dashboardId: t.arg.id({ required: true }), input: t.arg({ type: ChartInput, required: true }) },
    resolve: async (_root, { dashboardId, input }) => (await dashboards.createChart(dashboardId, input)).id,
  }),
  updateDashboardChart: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ChartInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await dashboards.updateChart(id, input);
      return true;
    },
  }),
  duplicateDashboardChart: t.id({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => (await dashboards.duplicateChart(id)).id,
  }),
  transferDashboardChart: t.id({
    description: 'Moves a chart to another dashboard (or to the first one of a project, created if needed); returns that dashboard.',
    args: { id: t.arg.id({ required: true }), dashboardId: t.arg.id(), projectId: t.arg.id() },
    resolve: async (_root, { id, dashboardId, projectId }) => (await dashboards.transferChart(id, { dashboardId: dashboardId ?? null, projectId: projectId ?? null })).id,
  }),
  deleteDashboardChart: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await dashboards.deleteChart(id);
      return true;
    },
  }),
  moveDashboardChart: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await dashboards.moveChart(id, index);
      return true;
    },
  }),
}));
