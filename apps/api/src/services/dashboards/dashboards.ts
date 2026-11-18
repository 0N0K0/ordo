import { chartConfigSchema, chartLabelSchema, copyName, dashboardLabelSchema } from '@ordo/shared';
import { prisma } from '../../db';
import type { Dashboard, DashboardChart, Prisma } from '../../generated/prisma/client';
import { orNotFound, parseInput } from '../../graphql/errors';
import { BY_POSITION, moveInList, nextPositionIn } from '../core/ordering';
import { assertExists } from '../core/lookup';
import { assertNotArchived } from '../core/archive';

/**
 * Loads a dashboard or throws NOT_FOUND.
 * @param {string} id Dashboard id.
 * @returns {Promise<Dashboard>} Dashboard.
 */
async function findDashboard(id: string): Promise<Dashboard> {
  const dashboard = await orNotFound(prisma.dashboard.findUnique({ where: { id } }), 'Tableau de bord');
  return dashboard;
}

/**
 * Loads a dashboard that can be changed (not archived) or throws.
 * @param {string} id Dashboard id.
 * @returns {Promise<Dashboard>} Dashboard.
 */
async function findWritableDashboard(id: string): Promise<Dashboard> {
  const dashboard = await findDashboard(id);
  await assertNotArchived('dashboard', id);
  return dashboard;
}

/**
 * Loads a chart of a dashboard that can be changed (not archived) or throws.
 * @param {string} id Chart id.
 * @returns {Promise<DashboardChart>} Chart.
 */
async function findWritableChart(id: string): Promise<DashboardChart> {
  const chart = await findChart(id);
  await assertNotArchived('dashboard', chart.dashboardId);
  return chart;
}

/**
 * Loads a chart or throws NOT_FOUND.
 * @param {string} id Chart id.
 * @returns {Promise<DashboardChart>} Chart.
 */
async function findChart(id: string): Promise<DashboardChart> {
  const chart = await orNotFound(prisma.dashboardChart.findUnique({ where: { id } }), 'Diagramme');
  return chart;
}

/**
 * Creates a dashboard, global or of a project, at the end of its list.
 * @param {string} label Label.
 * @param {string | null} projectId Project, or null for a global dashboard.
 * @returns {Promise<Dashboard>} Dashboard.
 */
export async function createDashboard(label: string, projectId: string | null): Promise<Dashboard> {
  await assertExists(prisma.project, projectId, 'Projet');
  const position = await nextPositionIn('dashboard', { projectId });
  return prisma.dashboard.create({ data: { label: parseInput(dashboardLabelSchema, label), projectId, position } });
}

/**
 * Renames a dashboard.
 * @param {string} id Dashboard id.
 * @param {string} label Label.
 * @returns {Promise<Dashboard>} Dashboard.
 */
export async function renameDashboard(id: string, label: string): Promise<Dashboard> {
  await findWritableDashboard(id);
  return prisma.dashboard.update({ where: { id }, data: { label: parseInput(dashboardLabelSchema, label) } });
}

/**
 * Deletes a dashboard with its charts.
 * @param {string} id Dashboard id.
 * @returns {Promise<void>}
 */
export async function deleteDashboard(id: string): Promise<void> {
  await findDashboard(id);
  await prisma.dashboard.delete({ where: { id } });
}

/**
 * Moves a dashboard among those of its scope.
 * @param {string} id Dashboard id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveDashboard(id: string, index: number): Promise<void> {
  const dashboard = await findWritableDashboard(id);
  await moveInList('dashboard', id, index, { projectId: dashboard.projectId });
}

export interface ChartInput {
  label: string;
  /** Validated against the shared chart schema. */
  config?: unknown;
  wide: boolean;
}

/**
 * Validated data of a chart.
 * @param {ChartInput} input Chart.
 * @returns {object} Prisma data.
 */
function chartData(input: ChartInput) {
  return { label: parseInput(chartLabelSchema, input.label), config: parseInput(chartConfigSchema, input.config) as unknown as Prisma.InputJsonValue, wide: input.wide };
}

/**
 * Adds a chart at the end of a dashboard.
 * @param {string} dashboardId Dashboard.
 * @param {ChartInput} input Chart.
 * @returns {Promise<DashboardChart>} Chart.
 */
export async function createChart(dashboardId: string, input: ChartInput): Promise<DashboardChart> {
  await findWritableDashboard(dashboardId);
  const position = await nextPositionIn('dashboardChart', { dashboardId });
  return prisma.dashboardChart.create({ data: { ...chartData(input), dashboardId, position } });
}

/**
 * Updates a chart.
 * @param {string} id Chart id.
 * @param {ChartInput} input Chart.
 * @returns {Promise<DashboardChart>} Chart.
 */
export async function updateChart(id: string, input: ChartInput): Promise<DashboardChart> {
  await findWritableChart(id);
  return prisma.dashboardChart.update({ where: { id }, data: chartData(input) });
}

/**
 * Copies a chart right after it.
 * @param {string} id Chart id.
 * @returns {Promise<DashboardChart>} Copy.
 */
export async function duplicateChart(id: string): Promise<DashboardChart> {
  const chart = await findWritableChart(id);
  const copy = await createChart(chart.dashboardId, { label: copyName(chart.label, 120), config: chart.config, wide: chart.wide });
  const siblings = await prisma.dashboardChart.findMany({ where: { dashboardId: chart.dashboardId }, orderBy: BY_POSITION, select: { id: true } });
  await moveChart(copy.id, siblings.findIndex((item) => item.id === id) + 1);
  return copy;
}

/**
 * Deletes a chart.
 * @param {string} id Chart id.
 * @returns {Promise<void>}
 */
export async function deleteChart(id: string): Promise<void> {
  await findWritableChart(id);
  await prisma.dashboardChart.delete({ where: { id } });
}

/**
 * Moves a chart in its dashboard.
 * @param {string} id Chart id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveChart(id: string, index: number): Promise<void> {
  const chart = await findWritableChart(id);
  await moveInList('dashboardChart', id, index, { dashboardId: chart.dashboardId });
}

/**
 * Moves a chart to the end of another dashboard: a given one, or the first one of a project (or of the general
 * dashboards when no project), created when there is none. Its data then follow the scope of that dashboard.
 * @param {string} id Chart id.
 * @param {{ dashboardId: string | null, projectId: string | null }} target Dashboard, or project of the dashboard.
 * @returns {Promise<Dashboard>} Dashboard the chart is now on.
 */
export async function transferChart(id: string, target: { dashboardId: string | null; projectId: string | null }): Promise<Dashboard> {
  const chart = await findWritableChart(id);
  let dashboard: Dashboard | null;
  if (target.dashboardId) dashboard = await findWritableDashboard(target.dashboardId);
  else {
    await assertExists(prisma.project, target.projectId, 'Projet');
    // An archived dashboard takes no chart.
    dashboard = (await prisma.dashboard.findFirst({ where: { projectId: target.projectId, archivedAt: null }, orderBy: BY_POSITION })) ?? (await createDashboard('Tableau de bord', target.projectId));
  }
  if (dashboard.id === chart.dashboardId) return dashboard;
  const position = await nextPositionIn('dashboardChart', { dashboardId: dashboard.id });
  await prisma.dashboardChart.update({ where: { id }, data: { dashboardId: dashboard.id, position } });
  return dashboard;
}
