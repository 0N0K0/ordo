import { fakerFR as faker } from '@faker-js/faker';
import { addDays, chartConfigSchema, emptyFilter, type ChartConfig } from '@ordo/shared';
import { prisma } from '../../src/db';
import type { Prisma, Project } from '../../src/generated/prisma/client';

/**
 * Chart configuration from the defaults.
 * @param {Partial<ChartConfig>} config Changes.
 * @returns {Prisma.InputJsonValue} Stored configuration.
 */
const chart = (config: Partial<ChartConfig>) => chartConfigSchema.parse({ filter: emptyFilter(), ...config }) as unknown as Prisma.InputJsonValue;

/**
 * Sprints and dashboards: four two-week sprints per active root project (two over, one running, one coming)
 * with tasks of the tree planned in them, a global "KPI" dashboard and a "Sprint" dashboard on the first
 * project (burndown of the running sprint, velocity).
 * @param {{ projects: Project[], today: string }} context Projects and today.
 * @returns {Promise<void>}
 */
export async function seedSprintsAndDashboards({ projects, today }: { projects: Project[]; today: string }): Promise<void> {
  // Archived since the projects were created: read again.
  const archived = new Set((await prisma.project.findMany({ where: { archivedAt: { not: null } }, select: { id: true } })).map((project) => project.id));
  const roots = projects.filter((project) => project.parentId === null && !archived.has(project.id));
  // The running sprint started a week ago.
  const firstStart = addDays(today, -7 - 28);
  let running: string | null = null;
  for (const root of roots) {
    const tree = new Set([root.id]);
    for (let added = true; added; ) {
      added = false;
      for (const project of projects) {
        if (project.parentId && tree.has(project.parentId) && !tree.has(project.id)) {
          tree.add(project.id);
          added = true;
        }
      }
    }
    const tasks = await prisma.task.findMany({ where: { projectId: { in: [...tree] }, archivedAt: null }, select: { id: true, closedAt: true }, orderBy: { number: 'asc' } });
    for (let index = 0; index < 4; index += 1) {
      const start = addDays(firstStart, index * 14);
      const sprint = await prisma.sprint.create({
        data: {
          projectId: root.id,
          name: `Sprint ${index + 1}`,
          goal: index === 2 ? 'Livrer la version bêta et corriger les retours de recette.' : null,
          startDate: new Date(`${start}T00:00:00.000Z`),
          endDate: new Date(`${addDays(start, 13)}T00:00:00.000Z`),
        },
      });
      if (index === 2 && !running) running = sprint.id;
      // Closed tasks in the sprints over or running, open ones in the running and coming sprints.
      const pool = tasks.filter((task) => (index < 2 ? task.closedAt !== null : index === 3 ? task.closedAt === null : true));
      const chosen = faker.helpers.arrayElements(pool, Math.min(pool.length, faker.number.int({ min: 3, max: 8 })));
      await prisma.task.updateMany({ where: { id: { in: chosen.map((task) => task.id) } }, data: { sprintId: sprint.id } });
      for (const task of chosen) tasks.splice(tasks.indexOf(task), 1);
      // Tasks of a sprint over were closed during it.
      if (index < 3) {
        for (const task of chosen.filter((item) => item.closedAt)) {
          const day = addDays(start, faker.number.int({ min: 1, max: index === 2 ? 6 : 13 }));
          await prisma.task.update({ where: { id: task.id }, data: { closedAt: new Date(`${day}T${String(faker.number.int({ min: 9, max: 17 })).padStart(2, '0')}:00:00`) } });
        }
      }
    }
  }

  const global = await prisma.dashboard.create({ data: { name: 'KPI', projectId: null, position: 0 } });
  const charts = [
    { title: 'Tâches fermées par semaine', wide: false, config: chart({ type: 'bar', dimension: 'closedAt', bucket: 'week', period: 'past:91' }) },
    {
      title: 'Vélocité par sprint (effort)',
      wide: true,
      config: chart({ type: 'stackedBar', dimension: 'sprint', measure: 'effort', series: 'state', filter: { ...emptyFilter(), children: [{ type: 'condition', id: 'planned', field: 'sprint', operator: 'isNotEmpty', value: null }] } }),
    },
    {
      title: 'Charge ouverte par assigné',
      wide: false,
      config: chart({ type: 'bar', dimension: 'assignees', measure: 'effort', series: 'priority', filter: { ...emptyFilter(), children: [{ type: 'condition', id: 'open', field: 'closed', operator: 'isFalse', value: null }] } }),
    },
    { title: 'Répartition par statut', wide: false, config: chart({ type: 'donut', dimension: 'status' }) },
    { title: 'Tâches créées (cumul mensuel)', wide: true, config: chart({ type: 'area', dimension: 'createdAt', bucket: 'month', period: 'past:365', cumulative: true, series: 'type' }) },
  ];
  await prisma.dashboardChart.createMany({ data: charts.map((item, position) => ({ ...item, dashboardId: global.id, position })) });

  if (running && roots[0]) {
    const sprintBoard = await prisma.dashboard.create({ data: { name: 'Sprint', projectId: roots[0].id, position: 0 } });
    await prisma.dashboardChart.createMany({
      data: [
        { dashboardId: sprintBoard.id, position: 0, wide: true, title: 'Burndown du sprint en cours', config: chart({ type: 'burndown', dimension: 'createdAt', sprintId: running, measure: 'count' }) },
        {
          dashboardId: sprintBoard.id,
          position: 1,
          wide: false,
          title: 'Tâches par sprint et statut',
          config: chart({ type: 'stackedBar', dimension: 'sprint', series: 'status', filter: { ...emptyFilter(), children: [{ type: 'condition', id: 'planned', field: 'sprint', operator: 'isNotEmpty', value: null }] } }),
        },
        { dashboardId: sprintBoard.id, position: 2, wide: false, title: 'Effort livré (cumul)', config: chart({ type: 'line', dimension: 'closedAt', bucket: 'week', period: 'past:91', measure: 'effort', cumulative: true }) },
      ],
    });
  }
}
