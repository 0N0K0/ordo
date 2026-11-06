import { fakerFR as faker } from '@faker-js/faker';
import { addDays, chartConfigSchema, documentChartFilterSchema, emptyFilter } from '@ordo/shared';
import type { z } from 'zod';
import { prisma } from '../../src/db';
import type { Prisma, Project } from '../../src/generated/prisma/client';

type DocumentChartFilterInput = z.input<typeof documentChartFilterSchema>;

/**
 * Chart configuration from the defaults.
 * @param {Partial<z.input<typeof chartConfigSchema>>} config Changes (defaults filled by the schema).
 * @returns {Prisma.InputJsonValue} Stored configuration.
 */
const chart = (config: Partial<z.input<typeof chartConfigSchema>>) => chartConfigSchema.parse({ filter: emptyFilter(), ...config }) as unknown as Prisma.InputJsonValue;

/**
 * Sprints and dashboards: four two-week sprints per active root project (two over, one running, one coming)
 * with tasks of the tree planned in them, global "KPI", "Finances", "Facturation" and "Trésorerie" dashboards, and
 * "Sprint" and "Finances du projet" dashboards on the first project. Seeded after the accounting (finance charts
 * filter its accounts and statuses).
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
    let carried: string | null = null;
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
      for (const task of chosen) await prisma.task.update({ where: { id: task.id }, data: { sprints: { connect: { id: sprint.id } } } });
      // An open task of the running sprint goes on in the next one: a task may run over several sprints.
      if (index === 3 && carried) await prisma.task.update({ where: { id: carried }, data: { sprints: { connect: { id: sprint.id } } } });
      carried = index === 2 ? (chosen.find((task) => task.closedAt === null)?.id ?? null) : carried;
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

  const finances = await prisma.dashboard.create({ data: { name: 'Finances', projectId: null, position: 1 } });
  const financeCharts = [
    {
      title: 'Chiffre d’affaires HT par mois',
      wide: true,
      config: chart({ source: 'documents', type: 'bar', dimension: 'issueDate', bucket: 'month', period: 'past:365', measure: 'totalNet', documents: { types: ['INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] } }),
    },
    {
      title: 'Reste à encaisser par client',
      wide: false,
      config: chart({ source: 'documents', type: 'stackedBar', dimension: 'client', measure: 'balance', series: 'payment', documents: { types: ['INVOICE', 'DEPOSIT_INVOICE'] } }),
    },
    { title: 'Devis par statut de suivi', wide: false, config: chart({ source: 'documents', type: 'donut', dimension: 'trackingStatus', measure: 'count', documents: { types: ['QUOTE'] } }) },
    { title: 'Solde de trésorerie', wide: true, config: chart({ source: 'treasury', type: 'line', dimension: 'date', bucket: 'week', period: 'past:182', measure: 'balance' }) },
    { title: 'Entrées et sorties par mois', wide: false, config: chart({ source: 'treasury', type: 'bar', dimension: 'date', bucket: 'month', period: 'past:182', measure: 'amount', series: 'direction' }) },
    { title: 'Dépenses par catégorie', wide: false, config: chart({ source: 'treasury', type: 'donut', dimension: 'category', period: 'past:365', measure: 'expense', treasury: { direction: 'out' } }) },
  ];
  await prisma.dashboardChart.createMany({ data: financeCharts.map((item, position) => ({ ...item, dashboardId: finances.id, position })) });

  const sentQuotes = await prisma.documentStatus.findMany({ where: { scope: 'QUOTE', category: 'SENT' }, select: { id: true } });
  const invoices: DocumentChartFilterInput = { types: ['INVOICE', 'DEPOSIT_INVOICE'] };
  const invoicing = await prisma.dashboard.create({ data: { name: 'Facturation', projectId: null, position: 2 } });
  const invoicingCharts = [
    {
      title: 'Chiffre d’affaires HT cumulé',
      wide: true,
      config: chart({
        source: 'documents',
        type: 'area',
        dimension: 'issueDate',
        bucket: 'month',
        period: 'past:365',
        measure: 'totalNet',
        cumulative: true,
        documents: { types: ['INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] },
      }),
    },
    { title: 'Encaissé par mois', wide: false, config: chart({ source: 'documents', type: 'bar', dimension: 'issueDate', bucket: 'month', period: 'past:365', measure: 'paid', documents: invoices }) },
    {
      title: 'CA par client et paiement',
      wide: false,
      config: chart({ source: 'documents', type: 'stackedBar', dimension: 'client', period: 'past:365', measure: 'totalNet', series: 'payment', documents: { types: ['INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] } }),
    },
    {
      title: 'Reste à encaisser par échéance',
      wide: true,
      config: chart({ source: 'documents', type: 'stackedBar', dimension: 'dueDate', bucket: 'month', period: 'all', measure: 'balance', series: 'client', documents: invoices }),
    },
    { title: 'CA TTC par projet', wide: false, config: chart({ source: 'documents', type: 'donut', dimension: 'project', period: 'past:365', measure: 'totalGross', documents: invoices }) },
    {
      title: 'Devis envoyés par mois',
      wide: false,
      config: chart({ source: 'documents', type: 'stackedBar', dimension: 'sentAt', bucket: 'month', period: 'past:365', measure: 'count', series: 'trackingStatus', documents: { types: ['QUOTE'] } }),
    },
    { title: 'Devis acceptés (montant HT)', wide: false, config: chart({ source: 'documents', type: 'line', dimension: 'acceptedAt', bucket: 'month', period: 'past:365', measure: 'totalNet', documents: { types: ['QUOTE'] } }) },
    {
      title: 'Devis en attente de réponse par client',
      wide: false,
      config: chart({ source: 'documents', type: 'bar', dimension: 'client', measure: 'totalNet', period: 'all', documents: { types: ['QUOTE'], statusIds: sentQuotes.map((status) => status.id) } }),
    },
    { title: 'Documents Ordo / importés', wide: false, config: chart({ source: 'documents', type: 'donut', dimension: 'origin', period: 'all', measure: 'count', series: null }) },
  ];
  await prisma.dashboardChart.createMany({ data: invoicingCharts.map((item, position) => ({ ...item, dashboardId: invoicing.id, position })) });

  const bank = await prisma.treasuryAccount.findFirst({ where: { name: 'Compte courant pro' }, select: { id: true } });
  const treasury = await prisma.dashboard.create({ data: { name: 'Trésorerie', projectId: null, position: 3 } });
  const treasuryCharts = [
    {
      title: 'Solde prévisionnel à 6 mois',
      wide: true,
      config: chart({ source: 'treasury', type: 'line', dimension: 'date', bucket: 'week', period: 'next:182', measure: 'balance', treasury: { includeForecast: true } }),
    },
    {
      title: 'Solde du compte courant',
      wide: false,
      config: chart({ source: 'treasury', type: 'area', dimension: 'date', bucket: 'week', period: 'past:182', measure: 'balance', treasury: { accountIds: bank ? [bank.id] : [] } }),
    },
    { title: 'Flux net cumulé', wide: false, config: chart({ source: 'treasury', type: 'area', dimension: 'date', bucket: 'week', period: 'past:182', measure: 'amount', cumulative: true }) },
    {
      title: 'Sorties par mois et catégorie',
      wide: true,
      config: chart({ source: 'treasury', type: 'stackedBar', dimension: 'date', bucket: 'month', period: 'past:182', measure: 'expense', series: 'category', treasury: { direction: 'out' } }),
    },
    {
      title: 'Entrées et sorties prévues',
      wide: false,
      config: chart({ source: 'treasury', type: 'bar', dimension: 'date', bucket: 'month', period: 'next:182', measure: 'amount', series: 'direction', treasury: { includeForecast: true } }),
    },
    { title: 'Entrées par catégorie', wide: false, config: chart({ source: 'treasury', type: 'donut', dimension: 'category', period: 'past:365', measure: 'income', treasury: { direction: 'in' } }) },
    { title: 'Mouvements par compte', wide: false, config: chart({ source: 'treasury', type: 'bar', dimension: 'account', period: 'past:365', measure: 'count', series: 'direction' }) },
  ];
  await prisma.dashboardChart.createMany({ data: treasuryCharts.map((item, position) => ({ ...item, dashboardId: treasury.id, position })) });

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

  // Charts of a project dashboard keep the documents and movements of its tree.
  if (roots[0]) {
    const projectFinances = await prisma.dashboard.create({ data: { name: 'Finances du projet', projectId: roots[0].id, position: 1 } });
    await prisma.dashboardChart.createMany({
      data: [
        {
          dashboardId: projectFinances.id,
          position: 0,
          wide: true,
          title: 'Facturé par mois',
          config: chart({ source: 'documents', type: 'bar', dimension: 'issueDate', bucket: 'month', period: 'past:365', measure: 'totalNet', series: 'documentType', documents: { types: ['INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] } }),
        },
        { dashboardId: projectFinances.id, position: 1, wide: false, title: 'Paiement des factures', config: chart({ source: 'documents', type: 'donut', dimension: 'payment', period: 'all', measure: 'totalGross', documents: invoices }) },
        { dashboardId: projectFinances.id, position: 2, wide: false, title: 'Devis par statut', config: chart({ source: 'documents', type: 'donut', dimension: 'trackingStatus', period: 'all', measure: 'totalNet', documents: { types: ['QUOTE'] } }) },
        {
          dashboardId: projectFinances.id,
          position: 3,
          wide: true,
          title: 'Entrées et sorties du projet',
          config: chart({ source: 'treasury', type: 'bar', dimension: 'date', bucket: 'month', period: 'past:365', measure: 'amount', series: 'direction', treasury: { includeForecast: true } }),
        },
      ],
    });
  }
}
