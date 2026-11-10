import { prisma } from '../../db';
import { Prisma, type GithubProjectLink } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { encryptSecret } from '../mail/secret';
import { repositoryByName, resolveBoard, viewerLogin, type Board } from './board';
import { githubToken } from './client';
import { currentWorkspaceId } from '../../workspace-context';

/**
 * Saves the personal access token after checking it on GitHub.
 * @param {string} token Token.
 * @returns {Promise<string>} Login of its owner.
 */
export async function setGithubToken(token: string): Promise<string> {
  const value = token.trim();
  if (!value) throw clientError('BAD_USER_INPUT', 'Le jeton est requis.', { fields: { token: 'Le jeton est requis.' } });
  const login = await viewerLogin(value);
  const data = { token: encryptSecret(value), login };
  await prisma.githubConnection.upsert({ where: { workspaceId: currentWorkspaceId() }, create: data, update: data });
  return login;
}

/**
 * Forgets the token (the links stay, their sync stops).
 * @returns {Promise<void>}
 */
export async function removeGithubToken(): Promise<void> {
  await prisma.githubConnection.deleteMany({ where: { workspaceId: currentWorkspaceId() } });
}

/**
 * Board of a URL with its fields, to configure a link.
 * @param {string} url Board URL.
 * @returns {Promise<Board>} Board.
 */
export async function previewBoard(url: string): Promise<Board> {
  return resolveBoard(await githubToken(), url);
}

export interface LinkInput {
  url: string;
  statusFieldId: string | null;
  priorityFieldId: string | null;
  iterationFieldId: string | null;
  startFieldId: string | null;
  endFieldId: string | null;
  effortFieldId: string | null;
  deadlineFieldId: string | null;
  timeSpentFieldId: string | null;
  /** FIELD (typeFieldId), ISSUE_TYPE (issue types of the organization) or null. */
  typeSource: 'FIELD' | 'ISSUE_TYPE' | null;
  typeFieldId: string | null;
  /** { [ordoStatusId]: optionId } */
  statusOptions: Record<string, string>;
  priorityOptions: Record<string, string>;
  /** { [ordoTypeId]: optionId or issue type id } */
  typeOptions: Record<string, string>;
  syncAssignees: boolean;
  syncLabels: boolean;
  /** "owner/name", or null for draft issues. */
  repositoryName: string | null;
  pushExisting: boolean;
  enabled: boolean;
}

/**
 * Ancestors and descendants of a project.
 * @param {string} projectId Project.
 * @returns {Promise<{ ancestors: string[], descendants: string[] }>} Ids (the project excluded).
 */
async function relatives(projectId: string): Promise<{ ancestors: string[]; descendants: string[] }> {
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const ancestors: string[] = [];
  for (let parent = projects.find((project) => project.id === projectId)?.parentId; parent; parent = projects.find((project) => project.id === parent)?.parentId) {
    ancestors.push(parent);
  }
  const below = [projectId];
  for (let index = 0; index < below.length; index += 1) below.push(...projects.filter((project) => project.parentId === below[index]).map((project) => project.id));
  return { ancestors, descendants: below.slice(1) };
}

/**
 * Links a project (and its sub-projects) to a GitHub board, or changes its settings. The fields must be of the
 * board and of the right kind; a project tree has one board.
 * @param {string} projectId Project.
 * @param {LinkInput} input Settings.
 * @returns {Promise<GithubProjectLink>} Link.
 */
export async function saveGithubLink(projectId: string, input: LinkInput): Promise<GithubProjectLink> {
  if (!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw notFound('Projet');
  const { ancestors, descendants } = await relatives(projectId);
  const clash = await prisma.githubProjectLink.findFirst({ where: { projectId: { in: [...ancestors, ...descendants] } }, include: { project: { select: { title: true } } } });
  if (clash) throw clientError('BAD_USER_INPUT', `« ${clash.project.title} » est déjà lié à un tableau GitHub : un projet et ses sous-projets partagent un seul tableau.`);
  const token = await githubToken();
  const board = await resolveBoard(token, input.url);
  const other = await prisma.githubProjectLink.findFirst({ where: { githubProjectId: board.id, projectId: { not: projectId } }, include: { project: { select: { title: true } } } });
  if (other) throw clientError('BAD_USER_INPUT', `Ce tableau est déjà lié au projet « ${other.project.title} ».`);

  const check = (fieldId: string | null, types: string[], label: string) => {
    if (!fieldId) return null;
    const field = board.fields.find((item) => item.id === fieldId);
    if (!field || !types.includes(field.dataType)) throw clientError('BAD_USER_INPUT', `Le champ choisi pour ${label} n’est pas un champ adapté du tableau.`);
    return field;
  };
  const status = check(input.statusFieldId, ['SINGLE_SELECT'], 'le statut');
  const priority = check(input.priorityFieldId, ['SINGLE_SELECT'], 'la priorité');
  check(input.iterationFieldId, ['ITERATION'], 'le sprint');
  check(input.startFieldId, ['DATE'], 'le début');
  check(input.endFieldId, ['DATE'], 'la fin');
  check(input.effortFieldId, ['NUMBER'], 'l’effort');
  check(input.deadlineFieldId, ['DATE'], 'la date max');
  check(input.timeSpentFieldId, ['NUMBER'], 'le temps passé');
  const typeField = input.typeSource === 'FIELD' ? check(input.typeFieldId, ['SINGLE_SELECT'], 'le type') : null;
  if (input.typeSource === 'FIELD' && !typeField) throw clientError('BAD_USER_INPUT', 'Choisissez le champ du tableau qui porte le type.');
  if (input.typeSource === 'ISSUE_TYPE' && !board.issueTypes.length) {
    throw clientError('BAD_USER_INPUT', 'Ce tableau n’appartient pas à une organisation ayant des types d’issue : choisissez un champ du tableau pour le type.');
  }
  const options = (mapping: Record<string, string>, field: { options: { id: string }[] } | null) =>
    Object.fromEntries(Object.entries(field ? mapping : {}).filter(([, optionId]) => field?.options.some((option) => option.id === optionId)));
  const typeChoices = input.typeSource === 'ISSUE_TYPE' ? { options: board.issueTypes } : typeField;
  const repository = input.repositoryName?.trim() ? await repositoryByName(token, input.repositoryName) : null;

  const data = {
    githubProjectId: board.id,
    url: board.url,
    title: board.title,
    statusFieldId: input.statusFieldId,
    priorityFieldId: input.priorityFieldId,
    iterationFieldId: input.iterationFieldId,
    startFieldId: input.startFieldId,
    endFieldId: input.endFieldId,
    effortFieldId: input.effortFieldId,
    deadlineFieldId: input.deadlineFieldId,
    timeSpentFieldId: input.timeSpentFieldId,
    typeSource: input.typeSource,
    typeFieldId: input.typeSource === 'FIELD' ? input.typeFieldId : null,
    statusOptions: options(input.statusOptions, status) as Prisma.InputJsonValue,
    priorityOptions: options(input.priorityOptions, priority) as Prisma.InputJsonValue,
    typeOptions: options(input.typeOptions, typeChoices) as Prisma.InputJsonValue,
    syncAssignees: input.syncAssignees,
    syncLabels: input.syncLabels,
    repositoryId: repository?.id ?? null,
    repositoryName: repository?.nameWithOwner ?? null,
    pushExisting: input.pushExisting,
    enabled: input.enabled,
  };
  const current = await prisma.githubProjectLink.findUnique({ where: { projectId } });
  // Another board: the tasks of the previous one are no longer linked.
  if (current && current.githubProjectId !== board.id) await forgetLinks(projectId);
  return current ? prisma.githubProjectLink.update({ where: { projectId }, data }) : prisma.githubProjectLink.create({ data: { ...data, projectId } });
}

/**
 * Clears the GitHub links of the tasks and sprints of a project tree.
 * @param {string} projectId Project.
 * @returns {Promise<void>}
 */
async function forgetLinks(projectId: string): Promise<void> {
  const tree = [projectId, ...(await relatives(projectId)).descendants];
  await prisma.task.updateMany({
    where: { projectId: { in: tree } },
    data: { githubItemId: null, githubContentId: null, githubContentType: null, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull },
  });
  await prisma.sprint.updateMany({ where: { projectId: { in: tree } }, data: { githubIterationId: null } });
  await prisma.taskComment.updateMany({ where: { task: { projectId: { in: tree } } }, data: { githubCommentId: null, githubBody: null, githubAuthor: null } });
}

/**
 * Unlinks a project from its board: tasks and sprints stay in Ordo, items stay on GitHub.
 * @param {string} projectId Project.
 * @returns {Promise<void>}
 */
export async function unlinkGithubProject(projectId: string): Promise<void> {
  if (!(await prisma.githubProjectLink.findUnique({ where: { projectId } }))) throw notFound('Lien GitHub');
  await forgetLinks(projectId);
  await prisma.githubProjectLink.delete({ where: { projectId } });
}

/**
 * Sets (or clears) the GitHub login of a contributor: GitHub assignees with that login are this contributor.
 * @param {string} id Contributor id.
 * @param {string | null} login Login, or null.
 * @returns {Promise<void>}
 */
export async function setContributorGithubLogin(id: string, login: string | null): Promise<void> {
  const value = login?.trim().replace(/^@/, '') || null;
  if (value && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(value)) throw clientError('BAD_USER_INPUT', 'Login GitHub invalide.');
  if (!(await prisma.contributor.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Contributeur');
  const taken = value ? await prisma.contributor.findFirst({ where: { githubLogin: { equals: value, mode: 'insensitive' }, id: { not: id } }, select: { name: true } }) : null;
  if (taken) throw clientError('CONFLICT', `Ce login GitHub est déjà celui de ${taken.name}.`);
  await prisma.contributor.update({ where: { id }, data: { githubLogin: value } });
}
