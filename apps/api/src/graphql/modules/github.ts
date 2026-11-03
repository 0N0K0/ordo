import { prisma } from '../../db';
import { syncGithubProject } from '../../services/github/sync';
import * as admin from '../../services/github/links-admin';
import type { Board, BoardField } from '../../services/github/board';
import { builder } from '../builder';

const BoardOptionRef = builder.objectRef<{ id: string; name: string }>('GithubBoardOption').implement({
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name') }),
});

const BoardFieldRef = builder.objectRef<BoardField>('GithubBoardField').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    dataType: t.exposeString('dataType', { description: 'SINGLE_SELECT, ITERATION, DATE, NUMBER, TEXT…' }),
    options: t.field({ type: [BoardOptionRef], resolve: (field) => field.options }),
    iterationCount: t.int({ resolve: (field) => field.iterations.length }),
  }),
});

const BoardRef = builder.objectRef<Board>('GithubBoard').implement({
  description: 'GitHub Projects (v2) board.',
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    url: t.exposeString('url'),
    fields: t.field({ type: [BoardFieldRef], resolve: (board) => board.fields }),
  }),
});

builder.prismaObject('GithubProjectLink', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    url: t.exposeString('url'),
    title: t.exposeString('title'),
    statusFieldId: t.exposeString('statusFieldId', { nullable: true }),
    priorityFieldId: t.exposeString('priorityFieldId', { nullable: true }),
    iterationFieldId: t.exposeString('iterationFieldId', { nullable: true }),
    startFieldId: t.exposeString('startFieldId', { nullable: true }),
    endFieldId: t.exposeString('endFieldId', { nullable: true }),
    effortFieldId: t.exposeString('effortFieldId', { nullable: true }),
    statusOptions: t.field({ type: 'JSON', resolve: (link) => link.statusOptions }),
    priorityOptions: t.field({ type: 'JSON', resolve: (link) => link.priorityOptions }),
    repositoryName: t.exposeString('repositoryName', { nullable: true }),
    pushExisting: t.exposeBoolean('pushExisting'),
    enabled: t.exposeBoolean('enabled'),
    lastSyncAt: t.expose('lastSyncAt', { type: 'DateTime', nullable: true }),
    lastSyncError: t.exposeString('lastSyncError', { nullable: true }),
    lastSyncSummary: t.field({ type: 'JSON', nullable: true, resolve: (link) => link.lastSyncSummary }),
    linkedTaskCount: t.int({
      resolve: async (link) => {
        const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
        const tree = [link.projectId];
        for (let index = 0; index < tree.length; index += 1) tree.push(...projects.filter((project) => project.parentId === tree[index]).map((project) => project.id));
        return prisma.task.count({ where: { projectId: { in: tree }, githubItemId: { not: null } } });
      },
    }),
  }),
});

const LinkInput = builder.inputType('GithubLinkInput', {
  fields: (t) => ({
    url: t.string({ required: true }),
    statusFieldId: t.string(),
    priorityFieldId: t.string(),
    iterationFieldId: t.string(),
    startFieldId: t.string(),
    endFieldId: t.string(),
    effortFieldId: t.string(),
    statusOptions: t.field({ type: 'JSON', required: true, description: '{ [ordoStatusId]: optionId }' }),
    priorityOptions: t.field({ type: 'JSON', required: true, description: '{ [ordoPriorityId]: optionId }' }),
    repositoryName: t.string({ description: 'owner/name: new tasks become issues of it; drafts without it.' }),
    pushExisting: t.boolean({ required: true }),
    enabled: t.boolean({ required: true }),
  }),
});

const SummaryRef = builder.objectRef<Awaited<ReturnType<typeof syncGithubProject>>>('GithubSyncSummary').implement({
  fields: (t) => ({
    pulledNew: t.exposeInt('pulledNew'),
    pushedNew: t.exposeInt('pushedNew'),
    pulled: t.exposeInt('pulled'),
    pushed: t.exposeInt('pushed'),
    unlinked: t.exposeInt('unlinked'),
    sprints: t.exposeInt('sprints'),
  }),
});

/**
 * Mapping of the input (only string values kept).
 * @param {unknown} value JSON.
 * @returns {Record<string, string>} Mapping.
 */
const mapping = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};

builder.queryFields((t) => ({
  githubLogin: t.string({
    nullable: true,
    description: 'Login of the connected GitHub account, or null.',
    resolve: async () => (await prisma.githubConnection.findUnique({ where: { id: 'github' } }))?.login ?? null,
  }),
  githubBoard: t.field({
    type: BoardRef,
    description: 'Board of a URL with its fields, to configure a link.',
    args: { url: t.arg.string({ required: true }) },
    resolve: (_root, { url }) => admin.previewBoard(url),
  }),
  githubProjectLink: t.prismaField({
    type: 'GithubProjectLink',
    nullable: true,
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (query, _root, { projectId }) => prisma.githubProjectLink.findUnique({ ...query, where: { projectId } }),
  }),
  githubContributors: t.field({
    type: [builder.objectRef<{ id: string; name: string; githubLogin: string | null }>('GithubContributor').implement({
      fields: (f) => ({ id: f.exposeID('id'), name: f.exposeString('name'), githubLogin: f.exposeString('githubLogin', { nullable: true }) }),
    })],
    resolve: () => prisma.contributor.findMany({ select: { id: true, name: true, githubLogin: true }, orderBy: { name: 'asc' } }),
  }),
}));

builder.mutationFields((t) => ({
  setGithubToken: t.string({
    description: 'Saves the personal access token once checked; returns the login.',
    args: { token: t.arg.string({ required: true }) },
    resolve: (_root, { token }) => admin.setGithubToken(token),
  }),
  removeGithubToken: t.boolean({
    resolve: async () => {
      await admin.removeGithubToken();
      return true;
    },
  }),
  saveGithubLink: t.boolean({
    description: 'Links a project to a board, or changes the settings of its link.',
    args: { projectId: t.arg.id({ required: true }), input: t.arg({ type: LinkInput, required: true }) },
    resolve: async (_root, { projectId, input }) => {
      await admin.saveGithubLink(projectId, {
        url: input.url,
        statusFieldId: input.statusFieldId ?? null,
        priorityFieldId: input.priorityFieldId ?? null,
        iterationFieldId: input.iterationFieldId ?? null,
        startFieldId: input.startFieldId ?? null,
        endFieldId: input.endFieldId ?? null,
        effortFieldId: input.effortFieldId ?? null,
        statusOptions: mapping(input.statusOptions),
        priorityOptions: mapping(input.priorityOptions),
        repositoryName: input.repositoryName ?? null,
        pushExisting: input.pushExisting,
        enabled: input.enabled,
      });
      return true;
    },
  }),
  unlinkGithubProject: t.boolean({
    args: { projectId: t.arg.id({ required: true }) },
    resolve: async (_root, { projectId }) => {
      await admin.unlinkGithubProject(projectId);
      return true;
    },
  }),
  syncGithubProject: t.field({
    type: SummaryRef,
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (_root, { projectId }) => syncGithubProject(projectId),
  }),
  setContributorGithubLogin: t.boolean({
    args: { id: t.arg.id({ required: true }), login: t.arg.string() },
    resolve: async (_root, { id, login }) => {
      await admin.setContributorGithubLogin(id, login ?? null);
      return true;
    },
  }),
}));
