import { fakerFR as faker } from '@faker-js/faker';
import { confirm } from '@inquirer/prompts';
import { prisma } from '../src/db';
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
} from './fixtures/factories';

// Fake data for development: purges the business data (clients, projects, tasks, labels, contributors),
// keeps the user account, then fills the database. `npm run db:seed -- --force` skips the confirmation.

if (process.env.NODE_ENV === 'production') {
  console.error('Les fixtures ne se chargent pas en production.');
  process.exit(1);
}

const force = process.argv.includes('--force');
if (!force && process.stdin.isTTY) {
  const ok = await confirm({
    message: 'Les clients, projets, tâches, libellés et contributeurs vont être supprimés (le compte est conservé). Continuer ?',
    default: false,
  });
  if (!ok) process.exit(0);
}

// Same data on every run.
faker.seed(2026);

const user = await prisma.user.findFirst({ select: { contributorId: true } });
if (!user) console.warn('Aucun compte : créez-le avec `npm run user:create` pour avoir des tâches assignées à « Moi ».');
const meId = user?.contributorId ?? null;

// --- Purge ----------------------------------------------------------------------------------------
await prisma.$executeRawUnsafe(`
  TRUNCATE "TaskComment", "TaskBlock", "TaskRelation", "Task", "Milestone", "TaskView", "Project", "Client",
    "ProjectCategory", "ProjectStatus", "TaskStatus", "TaskPriority", "TaskType", "Attachment"
  RESTART IDENTITY CASCADE
`);
await prisma.contributor.deleteMany({ where: { user: { is: null } } });
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
  });
  await commentFactory.createList(faker.helpers.weightedArrayElement([
    { value: 0, weight: 6 },
    { value: 1, weight: 2 },
    { value: 3, weight: 1 },
  ]), { taskId: task.id });
  return task.id;
}

const tasksByRoot = new Map<string, string[]>();
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

const counts = {
  clients: await prisma.client.count(),
  projets: await prisma.project.count(),
  contributeurs: await prisma.contributor.count(),
  jalons: await prisma.milestone.count(),
  tâches: await prisma.task.count(),
  commentaires: await prisma.taskComment.count(),
};
console.log('Fixtures chargées :', counts);
await prisma.$disconnect();

