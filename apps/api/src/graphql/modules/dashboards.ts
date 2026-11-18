import { done } from '../errors';
import { prisma } from '../../db';
import * as dashboards from '../../services/dashboards/dashboards';
import { BY_POSITION } from '../../services/core/ordering';
import { builder } from '../builder';

builder.prismaObject('Dashboard', {
  description: 'Dashboard of charts on the tasks, global or of a project tree.',
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId', { nullable: true }),
    label: t.exposeString('label'),
    position: t.exposeInt('position'),
    charts: t.relation('charts', { query: { orderBy: BY_POSITION } }),
  }),
});

builder.prismaObject('DashboardChart', {
  fields: (t) => ({
    id: t.exposeID('id'),
    dashboardId: t.exposeID('dashboardId'),
    label: t.exposeString('label'),
    config: t.field({ type: 'JSON', description: 'Chart configuration (shared chartConfigSchema).', resolve: (chart) => chart.config }),
    wide: t.exposeBoolean('wide'),
    position: t.exposeInt('position'),
  }),
});

const ChartInput = builder.inputType('DashboardChartInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    config: t.field({ type: 'JSON', required: true }),
    wide: t.boolean({ required: true }),
  }),
});

builder.queryFields((t) => ({
  dashboards: t.prismaField({
    type: ['Dashboard'],
    description: 'Dashboards of a project, or the global ones.',
    args: { projectId: t.arg.id() },
    resolve: (query, _root, { projectId }) => prisma.dashboard.findMany({ ...query, where: { projectId: projectId ?? null }, orderBy: BY_POSITION }),
  }),
}));

builder.mutationFields((t) => ({
  createDashboard: t.id({
    args: { label: t.arg.string({ required: true }), projectId: t.arg.id() },
    resolve: async (_root, { label, projectId }) => (await dashboards.createDashboard(label, projectId ?? null)).id,
  }),
  renameDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }), label: t.arg.string({ required: true }) },
    resolve: (_root, { id, label }) => done(dashboards.renameDashboard(id, label)),
  }),
  deleteDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(dashboards.deleteDashboard(id)),
  }),
  moveDashboard: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(dashboards.moveDashboard(id, index)),
  }),
  createDashboardChart: t.id({
    args: { dashboardId: t.arg.id({ required: true }), input: t.arg({ type: ChartInput, required: true }) },
    resolve: async (_root, { dashboardId, input }) => (await dashboards.createChart(dashboardId, input)).id,
  }),
  updateDashboardChart: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ChartInput, required: true }) },
    resolve: (_root, { id, input }) => done(dashboards.updateChart(id, input)),
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
    resolve: (_root, { id }) => done(dashboards.deleteChart(id)),
  }),
  moveDashboardChart: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(dashboards.moveChart(id, index)),
  }),
}));
