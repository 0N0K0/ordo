import { chartConfigSchema, chartTitleSchema, dashboardNameSchema } from '@ordo/shared';
import { prisma } from '../db';
import type { Dashboard, DashboardChart, Prisma } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

/**
 * Loads a dashboard or throws NOT_FOUND.
 * @param {string} id Dashboard id.
 * @returns {Promise<Dashboard>} Dashboard.
 */
async function findDashboard(id: string): Promise<Dashboard> {
  const dashboard = await prisma.dashboard.findUnique({ where: { id } });
  if (!dashboard) throw notFound('Tableau de bord');
  return dashboard;
}

/**
 * Loads a chart or throws NOT_FOUND.
 * @param {string} id Chart id.
 * @returns {Promise<DashboardChart>} Chart.
 */
async function findChart(id: string): Promise<DashboardChart> {
  const chart = await prisma.dashboardChart.findUnique({ where: { id } });
  if (!chart) throw notFound('Diagramme');
  return chart;
}

/**
 * Creates a dashboard, global or of a project, at the end of its list.
 * @param {string} name Name.
 * @param {string | null} projectId Project, or null for a global dashboard.
 * @returns {Promise<Dashboard>} Dashboard.
 */
export async function createDashboard(name: string, projectId: string | null): Promise<Dashboard> {
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw notFound('Projet');
  const { _max } = await prisma.dashboard.aggregate({ where: { projectId }, _max: { position: true } });
  return prisma.dashboard.create({ data: { name: parseInput(dashboardNameSchema, name), projectId, position: (_max.position ?? -1) + 1 } });
}

/**
 * Renames a dashboard.
 * @param {string} id Dashboard id.
 * @param {string} name Name.
 * @returns {Promise<Dashboard>} Dashboard.
 */
export async function renameDashboard(id: string, name: string): Promise<Dashboard> {
  await findDashboard(id);
  return prisma.dashboard.update({ where: { id }, data: { name: parseInput(dashboardNameSchema, name) } });
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
  const dashboard = await findDashboard(id);
  const siblings = await prisma.dashboard.findMany({ where: { projectId: dashboard.projectId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveInOrder(
    siblings.map((item) => item.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((dashboardId, position) => prisma.dashboard.update({ where: { id: dashboardId }, data: { position } })));
}

export interface ChartInput {
  title: string;
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
  return { title: parseInput(chartTitleSchema, input.title), config: parseInput(chartConfigSchema, input.config) as unknown as Prisma.InputJsonValue, wide: input.wide };
}

/**
 * Adds a chart at the end of a dashboard.
 * @param {string} dashboardId Dashboard.
 * @param {ChartInput} input Chart.
 * @returns {Promise<DashboardChart>} Chart.
 */
export async function createChart(dashboardId: string, input: ChartInput): Promise<DashboardChart> {
  await findDashboard(dashboardId);
  const { _max } = await prisma.dashboardChart.aggregate({ where: { dashboardId }, _max: { position: true } });
  return prisma.dashboardChart.create({ data: { ...chartData(input), dashboardId, position: (_max.position ?? -1) + 1 } });
}

/**
 * Updates a chart.
 * @param {string} id Chart id.
 * @param {ChartInput} input Chart.
 * @returns {Promise<DashboardChart>} Chart.
 */
export async function updateChart(id: string, input: ChartInput): Promise<DashboardChart> {
  await findChart(id);
  return prisma.dashboardChart.update({ where: { id }, data: chartData(input) });
}

/**
 * Copies a chart right after it.
 * @param {string} id Chart id.
 * @returns {Promise<DashboardChart>} Copy.
 */
export async function duplicateChart(id: string): Promise<DashboardChart> {
  const chart = await findChart(id);
  const copy = await createChart(chart.dashboardId, { title: `${chart.title} (copie)`.slice(0, 120), config: chart.config, wide: chart.wide });
  const siblings = await prisma.dashboardChart.findMany({ where: { dashboardId: chart.dashboardId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  await moveChart(copy.id, siblings.findIndex((item) => item.id === id) + 1);
  return copy;
}

/**
 * Deletes a chart.
 * @param {string} id Chart id.
 * @returns {Promise<void>}
 */
export async function deleteChart(id: string): Promise<void> {
  await findChart(id);
  await prisma.dashboardChart.delete({ where: { id } });
}

/**
 * Moves a chart in its dashboard.
 * @param {string} id Chart id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveChart(id: string, index: number): Promise<void> {
  const chart = await findChart(id);
  const siblings = await prisma.dashboardChart.findMany({ where: { dashboardId: chart.dashboardId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveInOrder(
    siblings.map((item) => item.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((chartId, position) => prisma.dashboardChart.update({ where: { id: chartId }, data: { position } })));
}
