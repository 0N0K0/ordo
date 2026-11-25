import { ancestorsOf, type GithubLinkInput, mapById, REMOVED_FROM_BOARD, subtreeOf } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type GithubProjectLink } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound } from '../../graphql/errors';
import { encryptSecret } from '../mail/secret';
import { repositoryByName, resolveBoard, viewerLogin, type Board } from './board';
import { githubToken } from './client';
import { currentWorkspaceId } from '../../workspace-context';
import { assertActive } from '../core/archive';
import { toJson } from '../core/json';

/**
 * Saves the personal access token after checking it on GitHub.
 * @param {string} token Token.
 * @returns {Promise<string>} Login of its owner.
 */
export async function setGithubToken(token: string): Promise<string> {
  const value = token.trim();
  if (!value) throw fieldError('token', 'Le jeton est requis.');
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

/**
 * Ancestors and descendants of a project.
 * @param {string} projectId Project.
 * @returns {Promise<{ ancestors: string[], descendants: string[] }>} Ids (the project excluded).
 */
async function relatives(projectId: string): Promise<{ ancestors: string[]; descendants: string[] }> {
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const ancestors = ancestorsOf(mapById(projects), projectId).map((project) => project.id);
  return { ancestors, descendants: [...subtreeOf(projects, projectId, false)] };
}

/**
 * Links a project (and its sub-projects) to a GitHub board, or changes its settings. The fields must be of the
 * board and of the right kind; a project tree has one board.
 * @param {string} projectId Project.
 * @param {GithubLinkInput} input Settings.
 * @returns {Promise<GithubProjectLink>} Link.
 */
export async function saveGithubLink(projectId: string, input: GithubLinkInput): Promise<GithubProjectLink> {
  await assertActive(prisma.project, projectId, 'Projet');
  const { ancestors, descendants } = await relatives(projectId);
  const clash = await prisma.githubProjectLink.findFirst({ where: { projectId: { in: [...ancestors, ...descendants] } }, include: { project: { select: { label: true } } } });
  if (clash) throw clientError('BAD_USER_INPUT', `« ${clash.project.label} » est déjà lié à un tableau GitHub : un projet et ses sous-projets partagent un seul tableau.`);
  const token = await githubToken();
  const board = await resolveBoard(token, input.url);
  const other = await prisma.githubProjectLink.findFirst({ where: { githubProjectId: board.id, projectId: { not: projectId } }, include: { project: { select: { label: true } } } });
  if (other) throw clientError('BAD_USER_INPUT', `Ce tableau est déjà lié au projet « ${other.project.label} ».`);

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
  check(input.deadlineFieldId, ['DATE'], 'l’échéance');
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
    label: board.title,
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
    statusOptions: toJson(options(input.statusOptions, status)),
    priorityOptions: toJson(options(input.priorityOptions, priority)),
    typeOptions: toJson(options(input.typeOptions, typeChoices)),
    syncAssignees: input.syncAssignees,
    syncLabels: input.syncLabels,
    repositoryId: repository?.id ?? null,
    repositoryName: repository?.nameWithOwner ?? null,
    pushExisting: input.pushExisting,
    enabled: input.enabled,
    writeIterations: input.writeIterations,
  };
  const current = await prisma.githubProjectLink.findUnique({ where: { projectId } });
  // Another board: the tasks of the previous one are no longer linked. Another iteration field: the sprints are paired
  // again with its iterations, by name. Either way, what the link knew of the iteration writes concerned the former field.
  if (current && current.githubProjectId !== board.id) await forgetLinks(projectId);
  else if (current && current.iterationFieldId !== input.iterationFieldId) await forgetSprintLinks([projectId, ...descendants]);
  const forgotten = current && (current.githubProjectId !== board.id || current.iterationFieldId !== input.iterationFieldId);
  return current
    ? prisma.githubProjectLink.update({ where: { projectId }, data: { ...data, ...(forgotten && { iterationIds: [], iterationWritePending: Prisma.DbNull, iterationWriteRefusal: null, iterationWriteError: null }) } })
    : prisma.githubProjectLink.create({ data: { ...data, projectId } });
}

/**
 * Clears the GitHub links of the tasks, sprints and comments of a project tree. A task off the board keeps its mark (not
 * sent again after a new link) and a comment of someone else its GitHub author (never published under the account
 * connected).
 * @param {string} projectId Project.
 * @returns {Promise<void>}
 */
async function forgetLinks(projectId: string): Promise<void> {
  const tree = [projectId, ...(await relatives(projectId)).descendants];
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { projectId: { in: tree } },
      data: { githubItemId: null, githubContentId: null, githubUrl: null, githubNumber: null, githubSnapshot: Prisma.DbNull },
    }),
    prisma.task.updateMany({ where: { projectId: { in: tree }, githubContentType: { not: REMOVED_FROM_BOARD } }, data: { githubContentType: null } }),
    prisma.taskComment.updateMany({ where: { task: { projectId: { in: tree } } }, data: { githubCommentId: null, githubBody: null } }),
  ]);
  await forgetSprintLinks(tree);
}

/**
 * Resumes the iteration sync of a link stopped after a write GitHub did not keep as sent (« Reprendre »): it goes on at
 * the next sync. Saving the settings does not resume it.
 * @param {string} projectId Linked project.
 * @returns {Promise<void>}
 */
export async function resumeGithubIterations(projectId: string): Promise<void> {
  await orNotFound(prisma.githubProjectLink.findUnique({ where: { projectId } }), 'Lien GitHub');
  await prisma.githubProjectLink.update({ where: { projectId }, data: { iterationWriteError: null } });
}

/**
 * Clears the iterations of the sprints of a project tree and their snapshots.
 * @param {string[]} tree Projects of the tree.
 * @returns {Promise<void>}
 */
async function forgetSprintLinks(tree: string[]): Promise<void> {
  await prisma.sprint.updateMany({ where: { projectId: { in: tree } }, data: { githubIterationId: null, githubSnapshot: Prisma.DbNull } });
}

/**
 * Unlinks a project from its board: tasks and sprints stay in Ordo, items stay on GitHub.
 * @param {string} projectId Project.
 * @returns {Promise<void>}
 */
export async function unlinkGithubProject(projectId: string): Promise<void> {
  await orNotFound(prisma.githubProjectLink.findUnique({ where: { projectId } }), 'Lien GitHub');
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
  await assertActive(prisma.contributor, id, 'Contributeur');
  const taken = value ? await prisma.contributor.findFirst({ where: { githubLogin: { equals: value, mode: 'insensitive' }, id: { not: id } }, select: { name: true } }) : null;
  if (taken) throw clientError('CONFLICT', `Ce login GitHub est déjà celui de ${taken.name}.`);
  await prisma.contributor.update({ where: { id }, data: { githubLogin: value } });
}
