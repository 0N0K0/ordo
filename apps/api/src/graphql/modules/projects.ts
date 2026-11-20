import { PROJECT_RESOURCE_KINDS } from '@ordo/shared';
import { done } from '../errors';
import { prisma } from '../../db';
import { projectCategories } from '../../services/projects/project-categories';
import * as clients from '../../services/projects/clients';
import { iconUrl } from '../../services/core/icons';
import * as projects from '../../services/projects/projects';
import * as resources from '../../services/projects/project-resources';
import { resourceUrl } from '../../services/core/attachments';
import { projectStatuses } from '../../services/projects/project-statuses';
import { BY_POSITION, BY_POSITION_NAME } from '../../services/core/ordering';
import { builder, type InputFields } from '../builder';
import { labelMutations, labelObject } from '../label-inputs';
import { reloaded } from '../reload';

labelObject('ProjectCategory');
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
    label: t.exposeString('label'),
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
    categories: t.relation('categories', { query: { orderBy: { label: 'asc' } } }),
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

/**
 * Fields of a project a creation and an update both take (its label, client, parent and icon aside).
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const projectFields = (t: InputFields) => ({
  categoryIds: t.idList(),
  statusId: t.id(),
  description: t.string(),
  startDate: t.field({ type: 'Date' }),
  endDate: t.field({ type: 'Date' }),
  color: t.string(),
});

const ProjectInput = builder.inputType('ProjectInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    clientId: t.id({ description: 'Client of a root project; a sub-project inherits the client of its parent.' }),
    parentId: t.id(),
    ...projectFields(t),
    icon: t.field({ type: 'File' }),
  }),
});

const ProjectUpdateInput = builder.inputType('ProjectUpdateInput', {
  fields: (t) => ({
    label: t.string(),
    clientId: t.id({ description: 'null detaches the project from its client; omitted leaves it unchanged.' }),
    parentId: t.id({ description: 'null makes it a root project; omitted leaves it unchanged.' }),
    ...projectFields(t),
    icon: t.field({ type: 'File', description: 'Replaces the current icon.' }),
    removeIcon: t.boolean(),
  }),
});

builder.queryFields((t) => ({
  clients: t.prismaField({
    type: ['Client'],
    description: 'Every client, archived ones included, in manual order.',
    resolve: (query) => prisma.client.findMany({ ...query, orderBy: BY_POSITION_NAME }),
  }),
  projects: t.prismaField({
    type: ['Project'],
    description: 'Every project, archived ones included, in manual order.',
    resolve: (query) => prisma.project.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  projectCategories: t.prismaField({
    type: ['ProjectCategory'],
    resolve: (query) => prisma.projectCategory.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  projectStatuses: t.prismaField({
    type: ['ProjectStatus'],
    resolve: (query) => prisma.projectStatus.findMany({ ...query, orderBy: BY_POSITION }),
  }),
}));

builder.mutationFields((t) => ({
  createClient: t.prismaField({
    type: 'Client',
    args: { input: t.arg({ type: ClientInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.client, query, clients.createClient(input)),
  }),
  updateClient: t.prismaField({
    type: 'Client',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ClientUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.client, query, clients.updateClient(id, input)),
  }),
  setClientFavorite: t.prismaField({
    type: 'Client',
    args: { id: t.arg.id({ required: true }), favorite: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, favorite }) => reloaded(prisma.client, query, clients.setClientFavorite(id, favorite)),
  }),
  setClientArchived: t.prismaField({
    type: 'Client',
    description: 'Archiving cascades to the active projects; restoring brings them back.',
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, archived }) => reloaded(prisma.client, query, clients.setClientArchived(id, archived)),
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
    resolve: async (query, _root, { input }) => reloaded(prisma.project, query, projects.createProject(input)),
  }),
  updateProject: t.prismaField({
    type: 'Project',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProjectUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.project, query, projects.updateProject(id, input)),
  }),
  setProjectFavorite: t.prismaField({
    type: 'Project',
    args: { id: t.arg.id({ required: true }), favorite: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, favorite }) => reloaded(prisma.project, query, projects.setProjectFavorite(id, favorite)),
  }),
  setProjectArchived: t.prismaField({
    type: 'Project',
    description: 'Archiving cascades to sub-projects; restoring a project restores its archived ancestors and client.',
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, archived }) => reloaded(prisma.project, query, projects.setProjectArchived(id, archived)),
  }),
  deleteProject: t.boolean({
    description: 'Deletes the project and all its sub-projects; their tasks leave them (out of any project).',
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

labelMutations('ProjectCategory', projectCategories);
labelMutations('ProjectStatus', projectStatuses);

// Resources of a project: files and links.

const ResourceKindEnum = builder.enumType('ProjectResourceKind', { values: PROJECT_RESOURCE_KINDS });

builder.prismaObject('ProjectResource', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    kind: t.field({ type: ResourceKindEnum, resolve: (resource) => resource.kind }),
    label: t.exposeString('label'),
    note: t.exposeString('note', { nullable: true }),
    url: t.string({
      select: { attachment: { select: { id: true, filename: true } } },
      resolve: (resource) => resourceUrl(resource),
    }),
    size: t.int({ nullable: true, select: { attachment: { select: { size: true } } }, resolve: (resource) => resource.attachment?.size ?? null }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

builder.queryFields((t) => ({
  projectResources: t.prismaField({
    type: ['ProjectResource'],
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (query, _root, { projectId }) => prisma.projectResource.findMany({ ...query, where: { projectId }, orderBy: BY_POSITION }),
  }),
}));

builder.mutationFields((t) => ({
  addProjectLink: t.boolean({
    args: { projectId: t.arg.id({ required: true }), label: t.arg.string({ required: true }), url: t.arg.string({ required: true }), note: t.arg.string() },
    resolve: (_root, { projectId, label, url, note }) => done(resources.addProjectLink(projectId, { label, url, note: note ?? null })),
  }),
  addProjectFiles: t.boolean({
    args: { projectId: t.arg.id({ required: true }), files: t.arg({ type: ['File'], required: true }) },
    resolve: (_root, { projectId, files }) => done(resources.addProjectFiles(projectId, files)),
  }),
  updateProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }), label: t.arg.string({ required: true }), url: t.arg.string(), note: t.arg.string() },
    resolve: (_root, { id, label, url, note }) => done(resources.updateProjectResource(id, { label, url, note })),
  }),
  deleteProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(resources.deleteProjectResource(id)),
  }),
  moveProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, index }) => done(resources.moveProjectResource(id, index)),
  }),
}));
