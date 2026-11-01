import { prisma } from '../../db';
import * as categories from '../../services/project-categories';
import * as clients from '../../services/clients';
import { iconUrl } from '../../services/icons';
import * as projects from '../../services/projects';
import * as statuses from '../../services/statuses';
import { builder } from '../builder';

const byManualOrder = [{ position: 'asc' }, { createdAt: 'asc' }] as const;

builder.prismaObject('ProjectCategory', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
  }),
});

builder.prismaObject('ProjectStatus', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('Client', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    iconUrl: t.string({ nullable: true, resolve: (client) => iconUrl(client.iconId) }),
    color: t.exposeString('color', { nullable: true }),
    position: t.exposeInt('position'),
    favorite: t.exposeBoolean('favorite'),
    archived: t.boolean({ resolve: (client) => client.archivedAt !== null }),
  }),
});

builder.prismaObject('Project', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    clientId: t.exposeID('clientId', { nullable: true }),
    parentId: t.exposeID('parentId', { nullable: true }),
    iconUrl: t.string({ nullable: true, resolve: (project) => iconUrl(project.iconId) }),
    description: t.exposeString('description', { nullable: true }),
    statusId: t.exposeID('statusId', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date', nullable: true }),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    color: t.exposeString('color', { nullable: true }),
    position: t.exposeInt('position'),
    favorite: t.exposeBoolean('favorite'),
    archived: t.boolean({ resolve: (project) => project.archivedAt !== null }),
    categories: t.relation('categories', { query: { orderBy: { name: 'asc' } } }),
  }),
});

const ClientInput = builder.inputType('ClientInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.string(),
    icon: t.field({ type: 'File' }),
  }),
});

const ClientUpdateInput = builder.inputType('ClientUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    color: t.string({ description: 'null clears the color.' }),
    icon: t.field({ type: 'File', description: 'Replaces the current icon.' }),
    removeIcon: t.boolean(),
  }),
});

const ProjectInput = builder.inputType('ProjectInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    clientId: t.id({ description: 'Client of a root project; a sub-project inherits the client of its parent.' }),
    parentId: t.id(),
    categoryIds: t.idList(),
    statusId: t.id(),
    description: t.string(),
    startDate: t.field({ type: 'Date' }),
    endDate: t.field({ type: 'Date' }),
    color: t.string(),
    icon: t.field({ type: 'File' }),
  }),
});

const ProjectUpdateInput = builder.inputType('ProjectUpdateInput', {
  fields: (t) => ({
    title: t.string(),
    clientId: t.id({ description: 'null detaches the project from its client; omitted leaves it unchanged.' }),
    parentId: t.id({ description: 'null makes it a root project; omitted leaves it unchanged.' }),
    categoryIds: t.idList(),
    statusId: t.id(),
    description: t.string(),
    startDate: t.field({ type: 'Date' }),
    endDate: t.field({ type: 'Date' }),
    color: t.string(),
    icon: t.field({ type: 'File', description: 'Replaces the current icon.' }),
    removeIcon: t.boolean(),
  }),
});

const ProjectCategoryInput = builder.inputType('ProjectCategoryInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.string({ required: true }),
  }),
});

const StatusInput = builder.inputType('ProjectStatusInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.string({ required: true }),
  }),
});

const StatusUpdateInput = builder.inputType('ProjectStatusUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    color: t.string(),
  }),
});

const ProjectCategoryUpdateInput = builder.inputType('ProjectCategoryUpdateInput', {
  fields: (t) => ({
    name: t.string(),
    color: t.string(),
  }),
});

builder.queryFields((t) => ({
  clients: t.prismaField({
    type: ['Client'],
    description: 'Every client, archived ones included, in manual order.',
    resolve: (query) => prisma.client.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  projects: t.prismaField({
    type: ['Project'],
    description: 'Every project, archived ones included, in manual order.',
    resolve: (query) => prisma.project.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
  projectCategories: t.prismaField({
    type: ['ProjectCategory'],
    resolve: (query) => prisma.projectCategory.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  projectStatuses: t.prismaField({
    type: ['ProjectStatus'],
    resolve: (query) => prisma.projectStatus.findMany({ ...query, orderBy: [...byManualOrder] }),
  }),
}));

/**
 * Reloads a client with the fields requested by the query.
 * @param {object} query Pothos Prisma selection.
 * @param {string} id Client id.
 * @returns {Promise<object>} Client.
 */
function reloadClient(query: object, id: string) {
  return prisma.client.findUniqueOrThrow({ ...query, where: { id } });
}

/**
 * Reloads a project with the fields requested by the query.
 * @param {object} query Pothos Prisma selection.
 * @param {string} id Project id.
 * @returns {Promise<object>} Project.
 */
function reloadProject(query: object, id: string) {
  return prisma.project.findUniqueOrThrow({ ...query, where: { id } });
}

builder.mutationFields((t) => ({
  createClient: t.prismaField({
    type: 'Client',
    args: { input: t.arg({ type: ClientInput, required: true }) },
    resolve: async (query, _root, { input }) => reloadClient(query, (await clients.createClient(input)).id),
  }),
  updateClient: t.prismaField({
    type: 'Client',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ClientUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloadClient(query, (await clients.updateClient(id, input)).id),
  }),
  setClientFavorite: t.prismaField({
    type: 'Client',
    args: { id: t.arg.id({ required: true }), favorite: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, favorite }) =>
      reloadClient(query, (await clients.setClientFavorite(id, favorite)).id),
  }),
  setClientArchived: t.prismaField({
    type: 'Client',
    description: 'Archiving cascades to the active projects; restoring brings them back.',
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, archived }) =>
      reloadClient(query, (await clients.setClientArchived(id, archived)).id),
  }),
  deleteClient: t.boolean({
    args: {
      id: t.arg.id({ required: true }),
      deleteProjects: t.arg.boolean({
        required: true,
        description: 'true deletes the projects, false moves them to "no client".',
      }),
    },
    resolve: async (_root, { id, deleteProjects }) => {
      await clients.deleteClient(id, deleteProjects);
      return true;
    },
  }),
  moveClient: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await clients.moveClient(id, index);
      return true;
    },
  }),

  createProject: t.prismaField({
    type: 'Project',
    args: { input: t.arg({ type: ProjectInput, required: true }) },
    resolve: async (query, _root, { input }) => reloadProject(query, (await projects.createProject(input)).id),
  }),
  updateProject: t.prismaField({
    type: 'Project',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProjectUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      reloadProject(query, (await projects.updateProject(id, input)).id),
  }),
  setProjectFavorite: t.prismaField({
    type: 'Project',
    args: { id: t.arg.id({ required: true }), favorite: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, favorite }) =>
      reloadProject(query, (await projects.setProjectFavorite(id, favorite)).id),
  }),
  setProjectArchived: t.prismaField({
    type: 'Project',
    description: 'Archiving cascades to sub-projects; restoring a project restores its archived ancestors and client.',
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, archived }) =>
      reloadProject(query, (await projects.setProjectArchived(id, archived)).id),
  }),
  deleteProject: t.boolean({
    description: 'Deletes the project and all its sub-projects.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await projects.deleteProject(id);
      return true;
    },
  }),
  moveProject: t.boolean({
    description: 'Moves a project with its sub-projects.',
    args: {
      id: t.arg.id({ required: true }),
      parentId: t.arg.id({ description: 'Target parent project, null for a root project.' }),
      clientId: t.arg.id({ description: 'Client of a root project, null for "no client" (ignored with a parent).' }),
      index: t.arg.int({ required: true }),
    },
    resolve: async (_root, { id, parentId, clientId, index }) => {
      await projects.moveProject(id, { parentId: parentId ?? null, clientId: clientId ?? null, index });
      return true;
    },
  }),

  createProjectCategory: t.prismaField({
    type: 'ProjectCategory',
    args: { input: t.arg({ type: ProjectCategoryInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.projectCategory.findUniqueOrThrow({ ...query, where: { id: (await categories.createProjectCategory(input)).id } }),
  }),
  updateProjectCategory: t.prismaField({
    type: 'ProjectCategory',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProjectCategoryUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.projectCategory.findUniqueOrThrow({
        ...query,
        where: { id: (await categories.updateProjectCategory(id, input)).id },
      }),
  }),
  deleteProjectCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await categories.deleteProjectCategory(id);
      return true;
    },
  }),

  createProjectStatus: t.prismaField({
    type: 'ProjectStatus',
    args: { input: t.arg({ type: StatusInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.projectStatus.findUniqueOrThrow({ ...query, where: { id: (await statuses.createStatus(input)).id } }),
  }),
  updateProjectStatus: t.prismaField({
    type: 'ProjectStatus',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: StatusUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.projectStatus.findUniqueOrThrow({
        ...query,
        where: { id: (await statuses.updateStatus(id, input)).id },
      }),
  }),
  deleteProjectStatus: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await statuses.deleteStatus(id);
      return true;
    },
  }),
  moveProjectStatus: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await statuses.moveStatus(id, index);
      return true;
    },
  }),
}));
