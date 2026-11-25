import { currentGithubConnection } from '../../services/github/client';
import { done } from '../errors';
import { prisma } from '../../db';
import { syncGithubProject } from '../../services/github/sync';
import * as admin from '../../services/github/links-admin';
import type { Board, BoardField } from '../../services/github/board';
import { builder } from '../builder';
import { subtreeIds } from '../../services/core/trees';

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
    issueField: t.boolean({ description: 'Issue field of the organization: values on the issues only (none on drafts).', resolve: (field) => field.issueFieldId !== null }),
  }),
});

const BoardRef = builder.objectRef<Board>('GithubBoard').implement({
  description: 'GitHub Projects (v2) board.',
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    url: t.exposeString('url'),
    fields: t.field({ type: [BoardFieldRef], resolve: (board) => board.fields }),
    issueTypes: t.field({ type: [BoardOptionRef], description: 'Issue types of the organization owning the board.', resolve: (board) => board.issueTypes }),
  }),
});

builder.prismaObject('GithubProjectLink', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    url: t.exposeString('url'),
    label: t.exposeString('label'),
    statusFieldId: t.exposeString('statusFieldId', { nullable: true }),
    priorityFieldId: t.exposeString('priorityFieldId', { nullable: true }),
    iterationFieldId: t.exposeString('iterationFieldId', { nullable: true }),
    startFieldId: t.exposeString('startFieldId', { nullable: true }),
    endFieldId: t.exposeString('endFieldId', { nullable: true }),
    effortFieldId: t.exposeString('effortFieldId', { nullable: true }),
    deadlineFieldId: t.exposeString('deadlineFieldId', { nullable: true }),
    timeSpentFieldId: t.exposeString('timeSpentFieldId', { nullable: true }),
    typeSource: t.exposeString('typeSource', { nullable: true, description: 'FIELD, ISSUE_TYPE, or null.' }),
    typeFieldId: t.exposeString('typeFieldId', { nullable: true }),
    statusOptions: t.field({ type: 'JSON', resolve: (link) => link.statusOptions }),
    priorityOptions: t.field({ type: 'JSON', resolve: (link) => link.priorityOptions }),
    typeOptions: t.field({ type: 'JSON', resolve: (link) => link.typeOptions }),
    syncAssignees: t.exposeBoolean('syncAssignees'),
    syncLabels: t.exposeBoolean('syncLabels'),
    repositoryName: t.exposeString('repositoryName', { nullable: true }),
    pushExisting: t.exposeBoolean('pushExisting'),
    writeIterations: t.exposeBoolean('writeIterations', { description: 'Sprints written as iterations on GitHub (off: iterations only read and paired).' }),
    iterationWriteRefusal: t.exposeString('iterationWriteRefusal', { nullable: true, description: 'Why GitHub refused the last iteration write (tried again at each sync).' }),
    enabled: t.exposeBoolean('enabled'),
    lastSyncAt: t.expose('lastSyncAt', { type: 'DateTime', nullable: true }),
    lastSyncError: t.exposeString('lastSyncError', { nullable: true }),
    iterationWriteError: t.exposeString('iterationWriteError', {
      nullable: true,
      description: 'Why the iterations are no longer synchronized (GitHub did not keep a write as sent), until resumed (resumeGithubIterations).',
    }),
    lastSyncSummary: t.field({ type: 'JSON', nullable: true, resolve: (link) => link.lastSyncSummary }),
    linkedTaskCount: t.int({
      resolve: async (link) => {
        const tree = await subtreeIds('project', link.projectId);
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
    deadlineFieldId: t.string(),
    timeSpentFieldId: t.string({ description: 'Number field receiving the tracked time, in hours (Ordo → GitHub).' }),
    typeSource: t.string({ description: 'FIELD (typeFieldId), ISSUE_TYPE (issue types of the organization), or null.' }),
    typeFieldId: t.string(),
    statusOptions: t.field({ type: 'JSON', required: true, description: '{ [ordoStatusId]: optionId }' }),
    priorityOptions: t.field({ type: 'JSON', required: true, description: '{ [ordoPriorityId]: optionId }' }),
    typeOptions: t.field({ type: 'JSON', required: true, description: '{ [ordoTypeId]: optionId or issue type id }' }),
    syncAssignees: t.boolean({ required: true }),
    syncLabels: t.boolean({ required: true }),
    repositoryName: t.string({ description: 'owner/name: new tasks become issues of it; drafts without it.' }),
    pushExisting: t.boolean({ required: true }),
    writeIterations: t.boolean({ description: 'Sprints written as iterations on GitHub. Default = false.' }),
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
    sprintsPushed: t.exposeInt('sprintsPushed', { description: 'Iterations created or updated on GitHub from the sprints.' }),
    sprintsSkipped: t.exposeInt('sprintsSkipped', { description: 'Sprints not sent: they share a day with another sprint of the project tree, or would with another iteration.' }),
    sprintsBlocked: t.exposeInt('sprintsBlocked', { description: 'Sprints not sent: the iteration writes of the link are stopped (iterationWriteError) or refused by GitHub (iterationWriteRefusal).' }),
    sprintsUnpaired: t.exposeInt('sprintsUnpaired', { description: 'Sprints without iteration while the iterations are not written (writeIterations off).' }),
    renumbered: t.exposeInt('renumbered'),
    comments: t.exposeInt('comments'),
    failed: t.exposeInt('failed', { description: 'Tasks whose sync failed: left as they were, tried again at the next sync.' }),
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
    resolve: async () => (await currentGithubConnection())?.login ?? null,
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
    type: [
      builder.objectRef<{ id: string; name: string; githubLogin: string | null }>('GithubContributor').implement({
        fields: (f) => ({ id: f.exposeID('id'), name: f.exposeString('name'), githubLogin: f.exposeString('githubLogin', { nullable: true }) }),
      }),
    ],
    // Archived contributors are read only: not offered to be paired.
    resolve: () => prisma.contributor.findMany({ where: { archivedAt: null }, select: { id: true, name: true, githubLogin: true }, orderBy: { name: 'asc' } }),
  }),
}));

builder.mutationFields((t) => ({
  setGithubToken: t.string({
    description: 'Saves the personal access token once checked; returns the login.',
    args: { token: t.arg.string({ required: true }) },
    resolve: (_root, { token }) => admin.setGithubToken(token),
  }),
  removeGithubToken: t.boolean({
    resolve: () => done(admin.removeGithubToken()),
  }),
  saveGithubLink: t.boolean({
    description: 'Links a project to a board, or changes the settings of its link.',
    args: { projectId: t.arg.id({ required: true }), input: t.arg({ type: LinkInput, required: true }) },
    resolve: (_root, { projectId, input }) =>
      done(
        admin.saveGithubLink(projectId, {
          url: input.url,
          statusFieldId: input.statusFieldId ?? null,
          priorityFieldId: input.priorityFieldId ?? null,
          iterationFieldId: input.iterationFieldId ?? null,
          startFieldId: input.startFieldId ?? null,
          endFieldId: input.endFieldId ?? null,
          effortFieldId: input.effortFieldId ?? null,
          deadlineFieldId: input.deadlineFieldId ?? null,
          timeSpentFieldId: input.timeSpentFieldId ?? null,
          typeSource: input.typeSource === 'FIELD' || input.typeSource === 'ISSUE_TYPE' ? input.typeSource : null,
          typeFieldId: input.typeFieldId ?? null,
          statusOptions: mapping(input.statusOptions),
          priorityOptions: mapping(input.priorityOptions),
          typeOptions: mapping(input.typeOptions),
          syncAssignees: input.syncAssignees,
          syncLabels: input.syncLabels,
          repositoryName: input.repositoryName ?? null,
          pushExisting: input.pushExisting,
          writeIterations: input.writeIterations ?? false,
          enabled: input.enabled,
        }),
      ),
  }),
  resumeGithubIterations: t.boolean({
    description: 'Resumes the iteration sync of a link stopped after a write GitHub did not keep as sent.',
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (_root, { projectId }) => done(admin.resumeGithubIterations(projectId)),
  }),
  unlinkGithubProject: t.boolean({
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (_root, { projectId }) => done(admin.unlinkGithubProject(projectId)),
  }),
  syncGithubProject: t.field({
    type: SummaryRef,
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (_root, { projectId }) => syncGithubProject(projectId),
  }),
  setContributorGithubLogin: t.boolean({
    args: { id: t.arg.id({ required: true }), login: t.arg.string() },
    resolve: (_root, { id, login }) => done(admin.setContributorGithubLogin(id, login ?? null)),
  }),
}));
