import { fakerFR as faker } from '@faker-js/faker';
import { confirm } from '@inquirer/prompts';
import { prisma, unscopedPrisma } from '../src/db';
import { ensureMeContributor, meContributorId } from '../src/services/workspaces';
import { enterWorkspace } from '../src/workspace-context';
import type { Project, TaskStatusCategory } from '../src/generated/prisma/client';
import {
  clientFactory,
  COLORS,
  commentFactory,
  contributorFactory,
  maybe,
  milestoneFactory,
  PHASES,
  projectFactory,
  taskFactory,
  timeEntryFactory,
  calendarEventFactory,
  clock,
  localDate,
  TIME_ZONE,
} from './fixtures/factories';
import { addDays, DEFAULT_RECURRENCE, type Recurrence } from '@ordo/shared';
import { DEMO_COMPANY, seedAccounting } from './fixtures/accounting';
import { seedSprintsAndDashboards } from './fixtures/dashboards';
import { seedMailbox } from './fixtures/mail';

// Fake data for development: purges the business data (clients, projects, tasks, labels, contributors, tracked
// time, calendar, sprints, dashboards, accounting, treasury), keeps the user account, the mail accounts and the alarms, then fills the
// database, with a demo mailbox on GreenMail (recreated on each run). `npm run db:seed -- --force` skips the confirmation.

if (process.env.NODE_ENV === 'production') {
  console.error('Les fixtures ne se chargent pas en production.');
  process.exit(1);
}

// The fixtures fill the first professional workspace; the other workspaces are not touched.
const workspace = await unscopedPrisma.workspace.findFirst({ where: { kind: 'PRO' }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
if (!workspace) {
  console.error('Aucun espace professionnel : les fixtures ne sont pas chargées.');
  process.exit(1);
}
enterWorkspace(workspace);

// Final accounting documents are legal records: the purge would delete them with their clients. Only those
// issued by the demo company of the fixtures can be reloaded.
const [{ finalDocuments }] = await prisma.$queryRaw<{ finalDocuments: number }[]>`
  SELECT count(*)::int AS "finalDocuments" FROM "AccountingDocument"
  WHERE "workspaceId" = ${workspace.id} AND "status" = 'FINAL' AND coalesce("seller"->>'name', '') <> ${DEMO_COMPANY}`;
if (finalDocuments > 0) {
  console.error(`La base contient ${finalDocuments} document(s) comptable(s) définitif(s) : les fixtures ne sont pas chargées.`);
  process.exit(1);
}

const force = process.argv.includes('--force');
if (!force && process.stdin.isTTY) {
  const ok = await confirm({
    message:
      `Dans l’espace « ${workspace.name} », les clients, projets, tâches, libellés, contributeurs, temps, évènements d’agenda, sprints, tableaux de bord, documents comptables, catalogue et trésorerie vont être supprimés, et le profil de société remplacé par une société de démonstration ; la boîte mail de démo est recréée (le compte, les autres boîtes mail, les alarmes et les autres espaces sont conservés). Continuer ?`,
    default: false,
  });
  if (!ok) process.exit(0);
}

// Same data on every run.
faker.seed(2026);

const user = await unscopedPrisma.user.findFirst({ select: { id: true, username: true } });
if (!user) console.warn('Aucun compte : créez-le avec `npm run user:create` pour avoir des tâches assignées à « Moi ».');
if (user) await ensureMeContributor(user);
const meId = user ? await meContributorId(user.id) : null;

// --- Purge ----------------------------------------------------------------------------------------
// Alarms are not fixtures: they are kept, without their project or task (purged below).
const alarms = await prisma.alarm.findMany();
// Rows other rows forbid to delete go first.
await prisma.alarm.deleteMany();
await prisma.treasuryAllocation.deleteMany();
await prisma.treasuryEntry.deleteMany();
await prisma.accountingDocument.updateMany({ data: { sourceId: null } });
await prisma.accountingDocument.deleteMany();
for (const model of [
  prisma.importedDocument,
  prisma.documentSequence,
  prisma.catalogItem,
  prisma.treasuryContextPeriod,
  prisma.treasuryContext,
  prisma.treasuryAccount,
  prisma.treasuryCategory,
  prisma.treasuryPaymentMethod,
  prisma.treasuryCounterparty,
  prisma.calendarEvent,
  prisma.calendarSubscription,
  prisma.calendar,
  prisma.calendarCategory,
  prisma.workSchedule,
  prisma.timeEntry,
  prisma.task,
  prisma.taskView,
  prisma.dashboard,
  prisma.project,
  prisma.client,
  prisma.projectCategory,
  prisma.projectStatus,
  prisma.taskStatus,
  prisma.taskPriority,
  prisma.taskType,
  prisma.taskTag,
  prisma.attachment,
] as unknown as { deleteMany: () => Promise<unknown> }[]) {
  await model.deleteMany();
}
// Task numbers are shared by the workspaces: they go on after the highest one left.
await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Task"', 'number'), COALESCE((SELECT MAX("number") FROM "Task"), 0) + 1, false)`);
await prisma.alarm.createMany({ data: alarms.map((alarm) => ({ ...alarm, projectId: null, taskId: null })) });
await prisma.contributor.deleteMany({ where: { userId: null } });
await prisma.icon.deleteMany({ where: { contributors: { none: {} } } });

// --- Labels ---------------------------------------------------------------------------------------
const statuses = await Promise.all(
  (
    [
      ['À faire', '#868e96', 'TODO'],
      ['En cours', '#228be6', 'IN_PROGRESS'],
      ['En revue', '#be4bdb', 'IN_PROGRESS'],
      ['Terminé', '#40c057', 'DONE'],
      ['Annulé', '#fa5252', 'CANCELLED'],
    ] as [string, string, TaskStatusCategory][]
  ).map(([name, color, category], position) => prisma.taskStatus.create({ data: { name, color, category, position } })),
);
const priorities = await Promise.all(
  [
    ['Basse', '#15aabf'],
    ['Moyenne', '#fab005'],
    ['Haute', '#fd7e14'],
    ['Urgente', '#fa5252'],
  ].map(([name, color], position) => prisma.taskPriority.create({ data: { name, color, position } })),
);
const tags = await Promise.all(
  [
    ['frontend', '#228be6'],
    ['backend', '#7950f2'],
    ['design', '#e64980'],
    ['client', '#fd7e14'],
    ['dette technique', '#868e96'],
  ].map(([name, color], position) => prisma.taskTag.create({ data: { name, color, position } })),
);
const types = await Promise.all(
  [
    ['Fonctionnalité', '#4c6ef5'],
    ['Bug', '#fa5252'],
    ['Amélioration', '#12b886'],
    ['Documentation', '#82c91e'],
  ].map(([name, color], position) => prisma.taskType.create({ data: { name, color, position } })),
);
const projectStatuses = await Promise.all(
  [
    ['Prospect', '#fab005'],
    ['En cours', '#228be6'],
    ['En pause', '#fd7e14'],
    ['Terminé', '#40c057'],
  ].map(([name, color], position) => prisma.projectStatus.create({ data: { name, color, position } })),
);
const categories = await Promise.all(
  ['Web', 'Mobile', 'Conseil', 'Design', 'Maintenance'].map((name, index) =>
    prisma.projectCategory.create({ data: { name, color: COLORS[(index * 3) % COLORS.length] } }),
  ),
);

// --- Contributors, clients and project trees -----------------------------------------------------
const contributors = await contributorFactory.createList(8);

/**
 * Project details shared by every level: status, categories and, for root projects, contributors.
 * @param {boolean} root Whether the project is a root project.
 * @returns {object} Project fields.
 */
const projectExtras = (root: boolean) => ({
  statusId: faker.helpers.arrayElement(projectStatuses).id,
  categories: { connect: faker.helpers.arrayElements(categories, { min: 0, max: 2 }).map(({ id }) => ({ id })) },
  // Sub-projects inherit the contributors of their parents; a few get their own on top.
  contributors: {
    connect: (root || faker.datatype.boolean(0.2) ? faker.helpers.arrayElements(contributors, { min: 1, max: root ? 4 : 1 }) : []).map(
      ({ id }) => ({ id }),
    ),
  },
});

const projects: Project[] = [];

/**
 * Creates a project with a few sub-projects (three levels at most).
 * @param {string | null} clientId Client of the tree.
 * @param {string | null} parentId Parent project.
 * @param {number} level Level of the project (1 for a root project).
 * @returns {Promise<void>}
 */
async function createProjectTree(clientId: string | null, parentId: string | null, level: number): Promise<void> {
  const project = await projectFactory.create({
    clientId,
    parentId,
    ...projectExtras(level === 1),
    // Sub-projects are phases of their parent.
    ...(parentId && { title: faker.helpers.arrayElement(PHASES) }),
  });
  projects.push(project);
  const children = level === 1 ? faker.number.int({ min: 0, max: 3 }) : level === 2 ? faker.number.int({ min: 0, max: 1 }) : 0;
  for (let index = 0; index < children; index += 1) await createProjectTree(clientId, project.id, level + 1);
}

const clients = await clientFactory.createList(5);
for (const client of clients) {
  const roots = faker.number.int({ min: 1, max: 3 });
  for (let index = 0; index < roots; index += 1) await createProjectTree(client.id, null, 1);
}
// Projects without client.
for (let index = 0; index < 2; index += 1) await createProjectTree(null, null, 1);

// One archived client (with its projects) and one archived project, to fill the archives.
const archivedClient = clients[clients.length - 1];
const now = new Date();
await prisma.client.update({ where: { id: archivedClient.id }, data: { archivedAt: now } });
await prisma.project.updateMany({ where: { clientId: archivedClient.id }, data: { archivedAt: now, archivedByCascade: true } });
const archivedProject = projects.find((project) => project.parentId === null && project.clientId !== archivedClient.id);
if (archivedProject) {
  await prisma.project.update({ where: { id: archivedProject.id }, data: { archivedAt: now } });
  const subtree = projects.filter((project) => project.parentId === archivedProject.id).map((project) => project.id);
  for (let index = 0; index < subtree.length; index += 1) {
    subtree.push(...projects.filter((project) => project.parentId === subtree[index]).map((project) => project.id));
  }
  await prisma.project.updateMany({ where: { id: { in: subtree } }, data: { archivedAt: now, archivedByCascade: true } });
}

// --- Milestones -----------------------------------------------------------------------------------
const parentOf = new Map(projects.map((project) => [project.id, project.parentId]));

/**
 * Root project of a project.
 * @param {string} projectId Project.
 * @returns {string} Root project.
 */
const rootOf = (projectId: string): string => {
  let current = projectId;
  for (let parent = parentOf.get(current); parent; parent = parentOf.get(current)) current = parent;
  return current;
};

const milestonesByRoot = new Map<string, string[]>();
for (const project of projects.filter((item) => item.parentId === null)) {
  const milestones = await milestoneFactory.createList(faker.number.int({ min: 0, max: 3 }), { projectId: project.id });
  milestonesByRoot.set(project.id, milestones.map((milestone) => milestone.id));
}

// --- Tasks ----------------------------------------------------------------------------------------
const members = await prisma.project.findMany({ select: { id: true, contributors: { select: { id: true } } } });
const membersOf = new Map(members.map((project) => [project.id, project.contributors.map((contributor) => contributor.id)]));

/**
 * Contributors that can be assigned in a project: "Moi" and those of the project or its parents.
 * @param {string} projectId Project.
 * @returns {string[]} Contributor ids.
 */
const assignableIn = (projectId: string): string[] => {
  const ids = meId ? [meId] : [];
  for (let current: string | null | undefined = projectId; current; current = parentOf.get(current)) {
    ids.push(...(membersOf.get(current) ?? []));
  }
  return [...new Set(ids)];
};

/**
 * Creates a task of a project, with its status, labels, assignees, milestone and comments.
 * @param {string} projectId Project.
 * @param {string | null} parentId Parent task.
 * @returns {Promise<string>} Task id.
 */
async function createTask(projectId: string, parentId: string | null): Promise<string> {
  const status = faker.helpers.weightedArrayElement([
    { value: statuses[0], weight: 4 },
    { value: statuses[1], weight: 3 },
    { value: statuses[2], weight: 1 },
    { value: statuses[3], weight: 3 },
    { value: statuses[4], weight: 1 },
  ]);
  const done = status.category === 'DONE' || status.category === 'CANCELLED';
  const milestones = milestonesByRoot.get(rootOf(projectId)) ?? [];
  const assignees = faker.helpers.arrayElements(assignableIn(projectId), { min: 0, max: 2 });
  const task = await taskFactory.create({
    projectId,
    parentId,
    statusId: status.id,
    priorityId: maybe(0.7, () => faker.helpers.arrayElement(priorities).id),
    typeId: maybe(0.8, () => faker.helpers.arrayElement(types).id),
    milestoneId: milestones.length ? maybe(0.4, () => faker.helpers.arrayElement(milestones)) : null,
    closedAt: done ? faker.date.recent({ days: 30 }) : null,
    archivedAt: done ? maybe(0.15, () => faker.date.recent({ days: 10 })) : null,
    assignees: { connect: assignees.map((id) => ({ id })) },
    tags: { connect: faker.helpers.arrayElements(tags, { min: 0, max: 2 }).map(({ id }) => ({ id })) },
  });
  await commentFactory.createList(faker.helpers.weightedArrayElement([
    { value: 0, weight: 6 },
    { value: 1, weight: 2 },
    { value: 3, weight: 1 },
  ]), { taskId: task.id });
  return task.id;
}

const tasksByRoot = new Map<string, string[]>();
const tasksByProject = new Map<string, string[]>();
for (const project of projects) {
  const count = faker.number.int({ min: 3, max: project.parentId ? 6 : 10 });
  const created: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const taskId = await createTask(project.id, null);
    created.push(taskId);
    // Some tasks get sub-tasks, and a few of those their own.
    if (faker.datatype.boolean(0.3)) {
      for (let child = 0; child < faker.number.int({ min: 1, max: 4 }); child += 1) {
        const childId = await createTask(project.id, taskId);
        created.push(childId);
        if (faker.datatype.boolean(0.15)) created.push(await createTask(project.id, childId));
      }
    }
  }
  const root = rootOf(project.id);
  tasksByRoot.set(root, [...(tasksByRoot.get(root) ?? []), ...created]);
  tasksByProject.set(project.id, created);
}

// Dependencies and relations stay inside a project tree. A task only depends on an older one: no cycle.
for (const taskIds of tasksByRoot.values()) {
  for (let index = 1; index < taskIds.length; index += 1) {
    if (faker.datatype.boolean(0.15)) {
      const blockers = faker.helpers.arrayElements(taskIds.slice(0, index), { min: 1, max: 2 });
      await prisma.taskBlock.createMany({ data: blockers.map((blockerId) => ({ blockerId, blockedId: taskIds[index] })) });
    }
    if (faker.datatype.boolean(0.08)) {
      const other = faker.helpers.arrayElement(taskIds.slice(0, index));
      const [taskAId, taskBId] = [other, taskIds[index]].sort();
      await prisma.taskRelation.createMany({ data: [{ taskAId, taskBId }], skipDuplicates: true });
    }
  }
}

// --- Tracked time -----------------------------------------------------------------------------------
// Finished entries only (no running timer). Some are spent on one task, a few on several (shared equally).
for (const project of projects) {
  const taskIds = tasksByProject.get(project.id) ?? [];
  const count = faker.number.int({ min: project.parentId ? 0 : 2, max: project.parentId ? 5 : 10 });
  for (let index = 0; index < count; index += 1) {
    const linked = faker.helpers.weightedArrayElement([
      { value: 0, weight: 3 },
      { value: 1, weight: 5 },
      { value: 2, weight: 1 },
      { value: 3, weight: 1 },
    ]);
    await timeEntryFactory.create({
      projectId: project.id,
      tasks: { connect: faker.helpers.arrayElements(taskIds, Math.min(linked, taskIds.length)).map((id) => ({ id })) },
    });
  }
}

// --- Calendar -----------------------------------------------------------------------------------------
/**
 * Creates a calendar category.
 * @param {string} name Name.
 * @param {string} color Color.
 * @param {string | null} parentId Parent.
 * @param {number} position Position among its siblings.
 * @returns {Promise<string>} Category id.
 */
const category = async (name: string, color: string, parentId: string | null, position: number) =>
  (await prisma.calendarCategory.create({ data: { name, color, parentId, position } })).id;
const pro = await category('Pro', '#228be6', null, 0);
const meetings = await category('Réunions', '#4c6ef5', pro, 0);
const clientsCategory = await category('Clients', '#15aabf', pro, 1);
const appointments = await category('Rendez-vous', '#12b886', clientsCategory, 0);
const training = await category('Formation', '#82c91e', pro, 2);
const personal = await category('Perso', '#e64980', null, 1);
const sport = await category('Sport', '#fd7e14', personal, 0);
const health = await category('Santé', '#fa5252', personal, 1);
const admin = await category('Administratif', '#fab005', null, 2);

// Two calendars: work, and personal life (the personal categories).
const workCalendar = (await prisma.calendar.create({ data: { name: 'Travail', color: '#228be6', position: 0 } })).id;
const personalCalendar = (await prisma.calendar.create({ data: { name: 'Personnel', color: '#e64980', position: 1 } })).id;
/**
 * Calendar of an event, from its categories.
 * @param {readonly string[]} categoryIds Categories.
 * @returns {string} Calendar id.
 */
const calendarOf = (categoryIds: readonly string[]) => (categoryIds.some((id) => [personal, sport, health].includes(id)) ? personalCalendar : workCalendar);

const today = localDate(new Date());
// Monday of the current week.
const monday = addDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
const activeRoots = projects.filter((project) => project.parentId === null && !project.archivedAt);
/**
 * Rule from the default one.
 * @param {Partial<Recurrence>} changes Changes.
 * @returns {Recurrence} Rule.
 */
const rule = (changes: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...changes });

/**
 * Creates a recurring event.
 * @param {object} event Event fields.
 * @returns {Promise<string>} Event id.
 */
const recurring = async (event: {
  title: string;
  start: string;
  from: number;
  to: number;
  recurrence: Recurrence;
  categoryIds: string[];
  location?: string;
  projectId?: string | null;
  allDay?: boolean;
  reminders?: number[];
}) =>
  (
    await prisma.calendarEvent.create({
      data: {
        title: event.title,
        location: event.location ?? null,
        links: [],
        allDay: event.allDay ?? false,
        startDate: new Date(`${event.start}T00:00:00.000Z`),
        startTime: event.allDay ? null : clock(event.from),
        endDate: new Date(`${event.start}T00:00:00.000Z`),
        endTime: event.allDay ? null : clock(event.to),
        timeZone: TIME_ZONE,
        recurrence: event.recurrence,
        reminders: event.reminders ?? [10],
        projectId: event.projectId ?? null,
        calendarId: calendarOf(event.categoryIds),
        categories: { connect: event.categoryIds.map((id) => ({ id })) },
        contributors: { connect: faker.helpers.arrayElements(contributors, { min: 0, max: 3 }).map(({ id }) => ({ id })) },
      },
    })
  ).id;

// Weekly team meeting, paused two weeks for the holidays, one occurrence moved and one cancelled.
const teamMeeting = await recurring({
  title: 'Point équipe',
  start: addDays(monday, -28),
  from: 9 * 60 + 30,
  to: 10 * 60,
  recurrence: rule({ weekdays: [1], pauses: [{ from: addDays(monday, 42), to: addDays(monday, 55) }] }),
  categoryIds: [meetings],
  location: 'Salle Ada',
});
await prisma.calendarEventException.create({
  data: {
    eventId: teamMeeting,
    date: new Date(`${addDays(monday, 7)}T00:00:00.000Z`),
    title: 'Point équipe (décalé au mardi)',
    startDate: new Date(`${addDays(monday, 8)}T00:00:00.000Z`),
    startTime: '11:00',
    endDate: new Date(`${addDays(monday, 8)}T00:00:00.000Z`),
    endTime: '11:30',
    location: 'Salle Ada',
    links: [],
  },
});
await prisma.calendarEventException.create({ data: { eventId: teamMeeting, date: new Date(`${addDays(monday, 21)}T00:00:00.000Z`), cancelled: true } });

await recurring({
  title: 'Stand-up',
  start: addDays(monday, -14),
  from: 9 * 60,
  to: 9 * 60 + 15,
  recurrence: rule({ weekdays: [1, 2, 3, 4, 5], count: 60 }),
  categoryIds: [meetings],
  location: 'Visio',
  projectId: activeRoots[0]?.id ?? null,
  reminders: [],
});
await recurring({
  title: 'Revue mensuelle',
  start: addDays(monday, 1),
  from: 14 * 60,
  to: 15 * 60 + 30,
  recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY' }),
  categoryIds: [meetings],
  location: 'Salle Turing',
  reminders: [30, 1440],
});
await recurring({
  title: 'Sport',
  start: addDays(monday, -21),
  from: 18 * 60 + 30,
  to: 19 * 60 + 30,
  recurrence: rule({ weekdays: [2, 4] }),
  categoryIds: [sport],
  location: 'Salle de sport',
  reminders: [60],
});
await recurring({
  title: 'Déclaration de TVA',
  start: addDays(monday, 4),
  from: 0,
  to: 0,
  allDay: true,
  recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', until: addDays(monday, 365) }),
  categoryIds: [admin],
  reminders: [1440],
});
await recurring({
  title: 'Cours d’anglais',
  start: addDays(monday, 2),
  from: 12 * 60 + 15,
  to: 13 * 60 + 15,
  recurrence: rule({ interval: 2, weekdays: [3], count: 10 }),
  categoryIds: [training],
  location: 'Visio',
});

// One-off events, some for clients and projects.
for (let index = 0; index < 30; index += 1) {
  const project = faker.datatype.boolean(0.6) ? faker.helpers.arrayElement(activeRoots) : null;
  const categoryId = faker.helpers.weightedArrayElement([
    { value: appointments, weight: 4 },
    { value: meetings, weight: 3 },
    { value: training, weight: 1 },
    { value: health, weight: 1 },
    { value: admin, weight: 1 },
  ]);
  await calendarEventFactory.create({
    projectId: categoryId === health ? null : (project?.id ?? null),
    calendarId: calendarOf([categoryId]),
    categories: { connect: [{ id: categoryId }] },
    contributors: { connect: faker.helpers.arrayElements(contributors, { min: 0, max: 2 }).map(({ id }) => ({ id })) },
  });
}
// All-day events over several days.
for (const [title, offset, days, categoryId] of [
  ['Salon professionnel', 10, 3, pro],
  ['Congés', 38, 5, personal],
  ['Séminaire d’équipe', -9, 2, meetings],
] as const) {
  const start = addDays(monday, offset);
  await prisma.calendarEvent.create({
    data: {
      title,
      links: [],
      allDay: true,
      startDate: new Date(`${start}T00:00:00.000Z`),
      endDate: new Date(`${addDays(start, days - 1)}T00:00:00.000Z`),
      timeZone: TIME_ZONE,
      reminders: [1440],
      calendarId: calendarOf([categoryId]),
      categories: { connect: [{ id: categoryId }] },
    },
  });
}

// A cancelled meeting (kept struck through) and a postponed appointment.
await prisma.calendarEvent.create({
  data: {
    title: 'Atelier de cadrage (annulé par le client)',
    links: [],
    startDate: new Date(`${addDays(monday, 3)}T00:00:00.000Z`),
    startTime: '14:00',
    endDate: new Date(`${addDays(monday, 3)}T00:00:00.000Z`),
    endTime: '16:00',
    timeZone: TIME_ZONE,
    reminders: [15],
    calledOff: true,
    calendarId: workCalendar,
    categories: { connect: [{ id: meetings }] },
  },
});
const postponed = await prisma.calendarEvent.create({
  data: {
    title: 'Rendez-vous comptable',
    links: [],
    startDate: new Date(`${addDays(monday, 1)}T00:00:00.000Z`),
    startTime: '10:00',
    endDate: new Date(`${addDays(monday, 1)}T00:00:00.000Z`),
    endTime: '11:00',
    timeZone: TIME_ZONE,
    reminders: [60],
    calledOff: true,
    calendarId: workCalendar,
    categories: { connect: [{ id: admin }] },
  },
});
await prisma.calendarEvent.create({
  data: {
    title: 'Report de l’évènement « Rendez-vous comptable »',
    links: [],
    startDate: new Date(`${addDays(monday, 9)}T00:00:00.000Z`),
    startTime: '10:00',
    endDate: new Date(`${addDays(monday, 9)}T00:00:00.000Z`),
    endTime: '11:00',
    timeZone: TIME_ZONE,
    reminders: [60],
    postponedFromId: postponed.id,
    calendarId: workCalendar,
    categories: { connect: [{ id: admin }] },
  },
});

// Working hours: Monday to Thursday 9–12:30 and 14–18, Friday morning; a week of holidays.
await prisma.workSchedule.create({
  data: {
    name: 'Semaine type',
    startDate: new Date(`${addDays(monday, -56)}T00:00:00.000Z`),
    intervalWeeks: 1,
    slots: [
      ...[1, 2, 3, 4].flatMap((weekday) => [
        { weekday, start: '09:00', end: '12:30' },
        { weekday, start: '14:00', end: '18:00' },
      ]),
      { weekday: 5, start: '09:00', end: '12:30' },
    ],
    pauses: [{ from: addDays(monday, 38), to: addDays(monday, 42), label: 'Congés' }],
  },
});
// Every other week, Saturday morning.
await prisma.workSchedule.create({
  data: {
    name: 'Samedis matin',
    startDate: new Date(`${addDays(monday, -14)}T00:00:00.000Z`),
    intervalWeeks: 2,
    slots: [{ weekday: 6, start: '09:00', end: '12:00' }],
    pauses: [],
  },
});

// --- Accounting -------------------------------------------------------------------------------------------
await seedAccounting({ clients, projects, today });

// --- Sprints and dashboards (after the accounting: finance charts filter its accounts and statuses) ------------
await seedSprintsAndDashboards({ projects, today });

// --- Mailbox ----------------------------------------------------------------------------------------------
await seedMailbox({ projects, today });

const counts = {
  clients: await prisma.client.count(),
  projets: await prisma.project.count(),
  contributeurs: await prisma.contributor.count(),
  jalons: await prisma.milestone.count(),
  tâches: await prisma.task.count(),
  commentaires: await prisma.taskComment.count(),
  temps: await prisma.timeEntry.count(),
  calendriers: await prisma.calendar.count(),
  'catégories d’agenda': await prisma.calendarCategory.count(),
  'évènements': await prisma.calendarEvent.count(),
  'plages de travail': await prisma.workSchedule.count(),
  'documents comptables': await prisma.accountingDocument.count({ where: { status: { not: 'TEMPLATE' } } }),
  'documents importés': await prisma.importedDocument.count(),
  'articles du catalogue': await prisma.catalogItem.count(),
  'mouvements de trésorerie': await prisma.treasuryEntry.count(),
  'mails liés aux projets': await prisma.mailMessage.count(),
  sprints: await prisma.sprint.count(),
  'diagrammes': await prisma.dashboardChart.count(),
};
console.log('Fixtures chargées :', counts);
await prisma.$disconnect();

