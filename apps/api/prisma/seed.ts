import { fakerFR as faker } from '@faker-js/faker';
import { confirm } from '@inquirer/prompts';
import { prisma, unscopedPrisma } from '../src/db';
import { createWorkspace, ensureMeContributor, meContributorId, setTaskColumnDefaults, setWorkspaceNotifications } from '../src/services/workspaces';
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
import { addDays, DEFAULT_RECURRENCE, emptyFilter, type Recurrence } from '@ordo/shared';
import { createAlarm } from '../src/services/alarms';
import { createCalendarEvent, postponeCalendarEvent } from '../src/services/calendar-events';
import { materializeTaskOccurrences, setTaskRecurrence } from '../src/services/task-recurrence';
import { createView } from '../src/services/task-views';
import { createTimeEntry } from '../src/services/time-entries';
import { saveScheduleType, subscribeScheduleKind } from '../src/services/work-schedules';
import { subscribe } from '../src/services/calendars';
import { seedAccounting } from './fixtures/accounting';
import { seedSprintsAndDashboards } from './fixtures/dashboards';
import { initialsIcon } from './fixtures/images';
import { seedLibrary } from './fixtures/library';
import { seedMailbox } from './fixtures/mail';
import { seedPersonal } from './fixtures/personal';
import { purgeWorkspace } from './fixtures/purge';
import { rebuildStatusHistory } from './fixtures/history';
import { seedRoutines } from './fixtures/routines';
import { seedShopping } from './fixtures/shopping';
import { seedTeam } from './fixtures/team';

// Fake data for development and staging (never production): fills one professional and one personal workspace
// (the first of each kind, created when missing) after purging them (every business row: clients, projects, tasks,
// labels, contributors, time, alarms, calendar, schedules, sprints, dashboards, accounting, treasury, library, places,
// shopping, routines, mail flags and searches). The user account, the "Moi" contributors, the mail accounts and the
// other workspaces are kept; the demo mailbox on GreenMail is recreated. `npm run db:seed -- --force` skips the
// confirmation.

if (process.env.NODE_ENV === 'production') {
  console.error('Les fixtures ne se chargent pas en production.');
  process.exit(1);
}

/**
 * First workspace of a kind, created when there is none.
 * @param {'PRO' | 'PERSO'} kind Kind.
 * @param {string} name Name of the one created.
 * @returns {Promise<{ id: string, name: string, kind: 'PRO' | 'PERSO' }>} Workspace.
 */
const workspaceOf = async (kind: 'PRO' | 'PERSO', name: string) =>
  (await unscopedPrisma.workspace.findFirst({ where: { kind }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })) ?? (await createWorkspace({ name, kind }));

const force = process.argv.includes('--force');
if (!force && process.stdin.isTTY) {
  const ok = await confirm({
    message:
      'Le premier espace professionnel et le premier espace personnel (créés s’ils manquent) vont être vidés de toutes leurs données (clients, projets, tâches, temps, alarmes, agenda, plages, documents comptables, trésorerie, bibliothèque, courses, routines…) puis remplis de données de démonstration ; la boîte mail de démo est recréée. Le compte, les boîtes mail et les autres espaces sont conservés. Continuer ?',
    default: false,
  });
  if (!ok) process.exit(0);
}

const workspace = await workspaceOf('PRO', 'Atelier');
const personalWorkspace = await workspaceOf('PERSO', 'Maison');
enterWorkspace(workspace);

// Same data on every run.
faker.seed(2026);

const user = await unscopedPrisma.user.findFirst({ select: { id: true, username: true } });
if (!user) console.warn('Aucun compte : créez-le avec `npm run user:create` pour avoir des tâches assignées à « Moi ».');
if (user) await ensureMeContributor(user);
const meId = user ? await meContributorId(user.id) : null;

// --- Purge ----------------------------------------------------------------------------------------
await purgeWorkspace();

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

// --- Icons: logos of some clients and projects, avatars of some contributors -------------------------------
for (const [index, client] of clients.slice(0, 3).entries()) {
  await prisma.client.update({ where: { id: client.id }, data: { iconId: await initialsIcon(client.name, COLORS[(index * 5) % COLORS.length]) } });
}
for (const [index, project] of projects.filter((item) => item.parentId === null).slice(0, 3).entries()) {
  await prisma.project.update({ where: { id: project.id }, data: { iconId: await initialsIcon(project.title, COLORS[(index * 7 + 2) % COLORS.length]) } });
}
for (const [index, contributor] of contributors.slice(0, 4).entries()) {
  await prisma.contributor.update({ where: { id: contributor.id }, data: { iconId: await initialsIcon(contributor.name, COLORS[(index * 3 + 1) % COLORS.length]) } });
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

const standUp = await recurring({
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
const sportEvent = await recurring({
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

// Working hours: Monday to Thursday 9–12:30 and 14–18, Friday morning; a week of holidays, and a day of training
// with its own hours.
const range = (start: string, end: string) => ({ start, end });
const weekly = (weekdays: number[], ranges: { start: string; end: string }[], every = 1) => ({ pattern: 'WEEKLY', weekdays, every, from: null, allDay: false, ranges });
const workWeek = await prisma.workSchedule.create({
  data: {
    name: 'Semaine type',
    startDate: new Date(`${addDays(monday, -56)}T00:00:00.000Z`),
    cases: [weekly([1, 2, 3, 4], [range('09:00', '12:30'), range('14:00', '18:00')]), weekly([5], [range('09:00', '12:30')])],
    exceptions: [
      { from: addDays(monday, 38), to: addDays(monday, 42), label: 'Congés', cases: [] },
      { from: addDays(monday, 9), to: addDays(monday, 9), label: 'Formation', cases: [{ pattern: 'DAILY', allDay: false, ranges: [range('08:00', '17:00')] }] },
    ],
  },
});
// Every other week, Saturday morning.
await prisma.workSchedule.create({
  data: {
    name: 'Samedis matin',
    startDate: new Date(`${addDays(monday, -14)}T00:00:00.000Z`),
    cases: [weekly([6], [range('09:00', '12:00')], 2)],
    exceptions: [],
  },
});

// --- Recurring tasks: weekly, every other week, monthly (limited), their occurrences around today ---------------
const repeatable = await prisma.task.findMany({
  where: { closedAt: null, archivedAt: null, parentId: null, startDate: { not: null }, project: { archivedAt: null } },
  orderBy: { number: 'asc' },
  take: 3,
});
for (const [index, task] of repeatable.entries()) {
  const anchor = task.startDate!.toISOString().slice(0, 10);
  const weekday = new Date(`${anchor}T12:00:00Z`).getUTCDay() || 7;
  await setTaskRecurrence(
    task.id,
    [rule({ weekdays: [weekday] }), rule({ interval: 2, weekdays: [weekday] }), rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', count: 6 })][index],
  );
}
await materializeTaskOccurrences(addDays(today, -28), addDays(today, 31));
// Past occurrences are mostly done.
const doneStatus = statuses.find((status) => status.category === 'DONE')!;
for (const occurrence of await prisma.task.findMany({ where: { seriesId: { not: null }, occurrenceDate: { lt: new Date(`${today}T00:00:00.000Z`) } } })) {
  if (faker.datatype.boolean(0.8)) await prisma.task.update({ where: { id: occurrence.id }, data: { statusId: doneStatus.id, closedAt: new Date(`${occurrence.occurrenceDate!.toISOString().slice(0, 10)}T17:00:00`) } });
}

// --- Events with an address and travel times, with tasks; time spent on events; a postponed occurrence ------
const eventBase = {
  description: null,
  links: [],
  allDay: false,
  timeZone: TIME_ZONE,
  recurrence: null,
  reminders: [30],
  calendarId: workCalendar,
  contributorIds: [],
  categoryIds: [appointments],
  taskIds: [],
};
const firstRoot = activeRoots[0] ?? null;
const rootTasks = firstRoot ? await prisma.task.findMany({ where: { projectId: firstRoot.id, closedAt: null }, select: { id: true }, take: 2 }) : [];
await createCalendarEvent({
  ...eventBase,
  title: 'Atelier chez le client',
  description: 'Recette des maquettes **sur place**, avec l’équipe du client.',
  location: '20 cours Émile Zola, 69100 Villeurbanne',
  locationLat: 45.7699,
  locationLon: 4.8803,
  travelBefore: 25,
  travelAfter: 30,
  startDate: addDays(monday, 2),
  startTime: '14:00',
  endDate: addDays(monday, 2),
  endTime: '16:30',
  projectId: firstRoot?.id ?? null,
  contributorIds: contributors.slice(0, 2).map(({ id }) => id),
  taskIds: rootTasks.map(({ id }) => id),
  links: [{ url: 'https://www.example.com/plan-acces', label: 'Plan d’accès' }],
});
await createCalendarEvent({
  ...eventBase,
  title: 'Revue de code',
  location: 'Visio',
  startDate: addDays(monday, -3),
  startTime: '15:00',
  endDate: addDays(monday, -3),
  endTime: '16:00',
  projectId: firstRoot?.id ?? null,
  taskIds: rootTasks.slice(0, 1).map(({ id }) => id),
});
// The stand-ups of the last two weeks were tracked from the event (each occurrence).
if (firstRoot) {
  for (let date = addDays(monday, -14); date < today; date = addDays(date, 1)) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6 || !faker.datatype.boolean(0.7)) continue;
    await createTimeEntry({ projectId: firstRoot.id, event: { eventId: standUp, occurrenceDate: date }, description: 'Stand-up', startedAt: new Date(`${date}T09:00:00`), duration: 15 * 60 });
  }
}
// The next sport session is moved to the day after (the occurrence is called off and a new event made).
const sportDay = [1, 3, 8, 10].map((offset) => addDays(monday, offset)).find((date) => date > today)!;
await postponeCalendarEvent(sportEvent, sportDay, {
  ...eventBase,
  title: 'Sport',
  location: 'Salle de sport',
  startDate: addDays(sportDay, 1),
  startTime: '19:00',
  endDate: addDays(sportDay, 1),
  endTime: '20:00',
  projectId: null,
  calendarId: personalCalendar,
  categoryIds: [sport],
  reminders: [60],
});

// On-call duty: a kind of its own (color, display), every fourth Saturday.
const onCall = await saveScheduleType(null, { name: 'Astreinte', color: '#fd7e14', dayDisplay: 'SLOT_BORDER', dayBar: true, monthDisplay: 'BORDER' });
await prisma.workSchedule.create({
  data: {
    name: 'Astreintes',
    typeId: onCall.id,
    startDate: new Date(`${addDays(monday, 5)}T00:00:00.000Z`),
    cases: [weekly([6], [range('10:00', '18:00')], 4)],
    exceptions: [],
  },
});

// --- Alarms: task alert, reminders at several frequencies, tracking alarms, a disabled one -------------------
const alarmBase = { note: null, time: '09:00', interval: 1, weekdays: [], endDate: null, minutes: null, projectId: null, taskId: null, enabled: true };
const alerted = await prisma.task.findFirst({ where: { closedAt: null, deadline: { gte: new Date(`${today}T00:00:00.000Z`) } }, orderBy: { deadline: 'asc' } });
if (alerted) {
  await createAlarm({ ...alarmBase, title: `Échéance : ${alerted.title}`, type: 'REMINDER', frequency: 'ONCE', startDate: addDays(alerted.deadline!.toISOString().slice(0, 10), -1), time: '10:00', projectId: alerted.projectId, taskId: alerted.id });
}
await createAlarm({ ...alarmBase, title: 'Relancer les devis en attente', type: 'REMINDER', frequency: 'WEEKLY', weekdays: [1], startDate: monday, note: 'Voir l’onglet « Devis » de la facturation.' });
await createAlarm({ ...alarmBase, title: 'Préparer la déclaration de TVA', type: 'REMINDER', frequency: 'MONTHLY', startDate: addDays(monday, 2), time: '14:00' });
await createAlarm({ ...alarmBase, title: 'Pense à lancer un chrono', type: 'NOT_TRACKING', frequency: 'DAILY', startDate: addDays(monday, -7), time: '10:00', weekdays: [1, 2, 3, 4, 5] });
await createAlarm({ ...alarmBase, title: 'Chrono lancé depuis 2 h', type: 'TRACKING_DURATION', frequency: 'ONCE', startDate: null, time: null, minutes: 120 });
await createAlarm({ ...alarmBase, title: 'Sauvegarde mensuelle', type: 'REMINDER', frequency: 'MONTHLY', interval: 2, startDate: addDays(monday, -30), time: '17:00', enabled: false });

// --- Workspace settings: columns of new task views, notifications given while another workspace is open -------
await setTaskColumnDefaults({ columnOrder: ['title', 'status', 'priority', 'assignees', 'deadline', 'project', 'effort', 'trackedTime', 'tags', 'type', 'startDate', 'endDate', 'parent', 'milestone', 'sprint', 'blockedBy', 'blocking', 'related', 'comments', 'createdAt', 'updatedAt'], hiddenColumns: ['blocking', 'related', 'milestone', 'createdAt', 'updatedAt', 'type'] });
await setWorkspaceNotifications(workspace.id, ['MAILS', 'ALARMS']);

// --- Task views (home page and a project) ------------------------------------------------------------------
const condition = (id: string, field: string, operator: string, value: string | string[] | null = null) => ({ type: 'condition', id, field, operator, value });
const filter = (...children: ReturnType<typeof condition>[]) => ({ ...emptyFilter(), children });
await createView({ name: 'Toutes les tâches', config: {} });
if (meId) await createView({ name: 'Mes tâches', config: { filter: filter(condition('mine', 'assignees', 'anyOf', [meId]), condition('open', 'closed', 'isFalse')), sorting: [{ id: 'deadline', desc: false }] } });
await createView({ name: 'En retard', config: { filter: filter(condition('late', 'overdue', 'isTrue')), groupBy: 'project', hiddenColumns: ['tags', 'effort', 'trackedTime'] } });
await createView({ name: 'Par priorité', config: { filter: filter(condition('open', 'closed', 'isFalse')), groupBy: 'priority', flat: true, events: { show: true, period: 'next:30' } } });
if (activeRoots[0]) {
  await createView({ name: 'Tableau', projectId: activeRoots[0].id, config: { groupBy: 'status' } });
  await createView({ name: 'Sprint en cours', projectId: activeRoots[0].id, config: { filter: filter(condition('sprint', 'sprint', 'current')), groupBy: 'assignees' } });
}

// --- Accounting -------------------------------------------------------------------------------------------
await seedAccounting({ clients, projects, today });

// --- Sprints and dashboards (after the accounting: finance charts filter its accounts and statuses) ------------
await seedSprintsAndDashboards({ projects, today });

// --- History of the statuses: created to do (a few weeks ago), started, then closed --------------------------
await rebuildStatusHistory(statuses[0].id, statuses[1].id);

// --- Team of the treasury, library, shopping, places and routines ------------------------------------------
const team = await seedTeam({ contributors, today, monday });
await seedLibrary({ projects });
await seedShopping({ team, today });
await seedRoutines({ projects, contributors, meId, scheduleId: workWeek.id });

// --- Mailbox ----------------------------------------------------------------------------------------------
await seedMailbox({ projects, today });

// --- Personal workspace, then the professional one subscribes to its childcare schedules and family calendar -----
const household = await seedPersonal({ workspace: personalWorkspace, proWorkspaceId: workspace.id, proCalendarId: workCalendar, user, today, monday });
enterWorkspace(workspace);
await subscribeScheduleKind(personalWorkspace.id, household.childcareTypeId);
await subscribe(household.familyCalendarId);

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
  'vues de tâches': await prisma.taskView.count(),
  'documents comptables': await prisma.accountingDocument.count({ where: { status: { not: 'TEMPLATE' } } }),
  'documents importés': await prisma.importedDocument.count(),
  'articles du catalogue': await prisma.catalogItem.count(),
  'mouvements de trésorerie': await prisma.treasuryEntry.count(),
  'mails liés aux projets': await prisma.mailMessage.count(),
  sprints: await prisma.sprint.count(),
  'diagrammes': await prisma.dashboardChart.count(),
  'budgets': await prisma.treasuryBudget.count(),
  'documents de la bibliothèque': await prisma.libraryDocument.count(),
  'documents de projets': await prisma.projectResource.count(),
  lieux: await prisma.place.count(),
  'produits de courses': await prisma.shoppingProduct.count(),
  'listes de courses': await prisma.shoppingList.count(),
  routines: await prisma.routine.count(),
  'routines cochées': await prisma.routineCheck.count(),
  alarmes: await prisma.alarm.count(),
};
console.log(`Fixtures de l’espace professionnel « ${workspace.name} » :`, counts);
console.log(`Espace personnel : « ${personalWorkspace.name} ».`);
await prisma.$disconnect();

