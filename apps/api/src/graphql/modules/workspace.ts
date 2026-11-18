import { done } from '../errors';
import { prisma } from '../../db';
import { projectCategories } from '../../services/workspace/project-categories';
import * as clients from '../../services/workspace/clients';
import { iconUrl } from '../../services/core/icons';
import * as projects from '../../services/workspace/projects';
import { projectStatuses } from '../../services/tasks/statuses';
import { BY_POSITION } from '../../services/core/ordering';
import { builder } from '../builder';
import { NameColorInput, NameColorPatch, labelMutations, labelObject } from '../label-inputs';

builder.prismaObject('ProjectCategory', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
  }),
});

labelObject('ProjectStatus');

builder.prismaObject('Client', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    iconUrl: t.string({ nullable: true, resolve: (client) => iconUrl(client.iconId) }),
    color: t.exposeString('color', { nullable: true }),
    position: t.exposeInt('position'),
    favorite: t.exposeBoolean('favorite'),
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





builder.queryFields((t) => ({
  clients: t.prismaField({
    type: ['Client'],
    description: 'Every client, archived ones included, in manual order.',
    resolve: (query) => prisma.client.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  projects: t.prismaField({
    type: ['Project'],
    description: 'Every project, archived ones included, in manual order.',
    resolve: (query) => prisma.project.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  projectCategories: t.prismaField({
    type: ['ProjectCategory'],
    resolve: (query) => prisma.projectCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  projectStatuses: t.prismaField({
    type: ['ProjectStatus'],
    resolve: (query) => prisma.projectStatus.findMany({ ...query, orderBy: BY_POSITION }),
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
    resolve: (_root, { id, deleteProjects }) => done(clients.deleteClient(id, deleteProjects)),
  }),
  moveClient: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(clients.moveClient(id, index)),
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
    resolve: (_root, { id }) => done(projects.deleteProject(id)),
  }),
  moveProject: t.boolean({
    description: 'Moves a project with its sub-projects.',
    args: {
      id: t.arg.id({ required: true }),
      parentId: t.arg.id({ description: 'Target parent project, null for a root project.' }),
      clientId: t.arg.id({ description: 'Client of a root project, null for "no client" (ignored with a parent).' }),
      index: t.arg.int({ required: true }),
    },
    resolve: (_root, { id, parentId, clientId, index }) => done(projects.moveProject(id, { parentId: parentId ?? null, clientId: clientId ?? null, index })),
  }),
}));

labelMutations('ProjectCategory', projectCategories, { create: NameColorInput, update: NameColorPatch });
labelMutations('ProjectStatus', projectStatuses, { create: NameColorInput, update: NameColorPatch });
