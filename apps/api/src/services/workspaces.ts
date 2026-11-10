import { parseCookie } from 'cookie';
import type { NextFunction, Request, Response } from 'express';
import { requestSession } from '../auth/session';
import { readTaskColumnDefaults, taskColumnDefaultsSchema, type TaskColumnDefaults } from '@ordo/shared';
import { z } from 'zod';
import { prisma, unscopedPrisma } from '../db';
import { Prisma, type NotificationSource, type Workspace, type WorkspaceKind } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { currentWorkspace, runInWorkspace } from '../workspace-context';
import { resolveCalendarId } from './calendars';
import { ensureDocumentStatuses } from './document-statuses';

/** Cookie (and header) naming the workspace the app shows. */
export const WORKSPACE_COOKIE = 'ordo_workspace';
const WORKSPACE_HEADER = 'x-ordo-workspace';

const byOrder = [{ position: 'asc' }, { createdAt: 'asc' }] as const;

const workspaceInputSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis.').max(60, '60 caractères au plus.'),
  kind: z.enum(['PRO', 'PERSO']),
});

/**
 * Workspaces of an account, in the order of the switcher.
 * @param {string} ownerId Account.
 * @returns {Promise<Workspace[]>} Workspaces.
 */
export function listWorkspaces(ownerId: string): Promise<Workspace[]> {
  return unscopedPrisma.workspace.findMany({ where: { ownerId }, orderBy: [...byOrder] });
}

/**
 * Throws when an account may not have a workspace of this kind: only the admin has professional ones (company,
 * clients, invoicing); the other accounts have personal ones.
 * @param {WorkspaceKind} kind Kind.
 * @param {string} ownerId Account.
 * @returns {Promise<void>}
 */
async function assertKindAllowed(kind: WorkspaceKind, ownerId: string): Promise<void> {
  if (kind !== 'PRO') return;
  const owner = await unscopedPrisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });
  if (owner?.role !== 'ADMIN') throw clientError('FORBIDDEN', 'Seule l’administratrice a des espaces professionnels : créez un espace personnel.');
}

/**
 * Kind of the first workspace of an account: professional for the admin, personal for the others.
 * @param {string} ownerId Account.
 * @returns {Promise<{ name: string, kind: WorkspaceKind }>} Name and kind.
 */
export async function firstWorkspaceOf(ownerId: string): Promise<{ name: string; kind: WorkspaceKind }> {
  const owner = await unscopedPrisma.user.findUnique({ where: { id: ownerId }, select: { role: true } });
  return owner?.role === 'ADMIN' ? { name: 'Pro', kind: 'PRO' } : { name: 'Perso', kind: 'PERSO' };
}

/**
 * Workspace of an account, or throws as if it did not exist (the workspaces of the others are not even seen).
 * @param {string} id Workspace.
 * @param {string} ownerId Account.
 * @returns {Promise<Workspace>} Workspace.
 */
async function ownWorkspace(id: string, ownerId: string): Promise<Workspace> {
  const workspace = await unscopedPrisma.workspace.findFirst({ where: { id, ownerId } });
  if (!workspace) throw notFound('Espace');
  return workspace;
}

/**
 * Workspace a request asks for (header, then cookie) among those of its account, or the account's first one; one
 * is created when the account has none.
 * @param {Request} req Request.
 * @param {string} ownerId Logged-in account.
 * @returns {Promise<Workspace>} Workspace.
 */
async function requestedWorkspace(req: Request, ownerId: string): Promise<Workspace> {
  const header = req.headers[WORKSPACE_HEADER];
  const wanted = (typeof header === 'string' && header) || parseCookie(req.headers.cookie ?? '')[WORKSPACE_COOKIE];
  const found = wanted ? await unscopedPrisma.workspace.findFirst({ where: { id: wanted, ownerId } }) : null;
  if (found) return found;
  const first = await unscopedPrisma.workspace.findFirst({ where: { ownerId }, orderBy: [...byOrder] });
  return first ?? createWorkspace(await firstWorkspaceOf(ownerId), ownerId);
}

/**
 * Express middleware: the rest of the request of a logged-in account works in the workspace it asks for, among
 * the account's. A request without session works in none: it reaches no workspace data (login, password reset).
 * @param {Request} req Request.
 * @param {Response} res Response.
 * @param {NextFunction} next Next handler.
 * @returns {Promise<void>}
 */
export async function workspaceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await requestSession(req, res);
  if (!session) {
    next();
    return;
  }
  const workspace = await requestedWorkspace(req, session.userId);
  runInWorkspace(workspace, next);
}

/**
 * Runs a job in every workspace, one after the other (an error in one does not stop the others).
 * @param {(workspace: Workspace) => Promise<unknown>} job Job.
 * @param {{ kind?: WorkspaceKind }} [options] Only the workspaces of a kind. Optional.
 * @returns {Promise<void>}
 */
export async function forEachWorkspace(job: (workspace: Workspace) => Promise<unknown>, options: { kind?: WorkspaceKind } = {}): Promise<void> {
  const workspaces = await unscopedPrisma.workspace.findMany({ where: options.kind ? { kind: options.kind } : {}, orderBy: [...byOrder] });
  for (const workspace of workspaces) {
    try {
      await runInWorkspace(workspace, () => job(workspace));
    } catch (error) {
      console.error(`Workspace « ${workspace.name} »:`, error);
    }
  }
}

/**
 * Refuses an action a personal workspace does not have (invoicing, clients, company).
 * @param {string} what What is refused ("facturation"…).
 * @returns {void}
 */
export function requirePro(what: string): void {
  if (currentWorkspace().kind !== 'PRO') throw clientError('BAD_USER_INPUT', `Indisponible dans un espace personnel (${what}).`);
}

/**
 * Contributor profile ("Moi") of a user in the current workspace.
 * @param {string} userId User.
 * @returns {Promise<string | null>} Contributor id, null when there is none.
 */
export async function meContributorId(userId: string): Promise<string | null> {
  return (await prisma.contributor.findFirst({ where: { userId }, select: { id: true } }))?.id ?? null;
}

/**
 * Gives a user a contributor profile ("Moi") in the current workspace when they have none.
 * @param {{ id: string, username: string }} user User.
 * @returns {Promise<void>}
 */
export async function ensureMeContributor(user: { id: string; username: string }): Promise<void> {
  if (await meContributorId(user.id)) return;
  const base = user.username.replace(/[^a-z0-9_-]/g, '-');
  const taken = new Set((await prisma.contributor.findMany({ where: { handle: { startsWith: base } }, select: { handle: true } })).map((item) => item.handle));
  let handle = taken.has(base) ? `${base}-moi` : base;
  for (let index = 2; taken.has(handle); index += 1) handle = `${base}-moi-${index}`;
  await prisma.contributor.create({ data: { name: user.username, handle, userId: user.id } });
}

/**
 * Settings a workspace starts with: the "Moi" of its account, a calendar, and the tracking statuses of a
 * professional one.
 * @param {Workspace} workspace Workspace.
 * @returns {Promise<void>}
 */
export async function setUpWorkspace(workspace: Workspace): Promise<void> {
  await runInWorkspace(workspace, async () => {
    const owner = workspace.ownerId ? await unscopedPrisma.user.findUnique({ where: { id: workspace.ownerId }, select: { id: true, username: true } }) : null;
    if (owner) await ensureMeContributor(owner);
    await resolveCalendarId();
    // Every category of the tracking gets a status, those already there kept.
    if (workspace.kind === 'PRO') await ensureDocumentStatuses();
  });
}

/**
 * Creates a workspace of an account, last of its switcher.
 * @param {{ name: string, kind: WorkspaceKind }} input Name and kind.
 * @param {string} ownerId Account.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function createWorkspace(input: { name: string; kind: WorkspaceKind }, ownerId: string): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  await assertKindAllowed(data.kind, ownerId);
  const last = await unscopedPrisma.workspace.aggregate({ where: { ownerId }, _max: { position: true } });
  const workspace = await unscopedPrisma.workspace.create({ data: { ...data, ownerId, position: (last._max.position ?? -1) + 1 } });
  await setUpWorkspace(workspace);
  return workspace;
}

/**
 * Renames a workspace of an account or changes its kind. It only becomes personal without clients nor invoicing
 * documents.
 * @param {string} id Workspace.
 * @param {{ name: string, kind: WorkspaceKind }} input Name and kind.
 * @param {string} ownerId Account.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function updateWorkspace(id: string, input: { name: string; kind: WorkspaceKind }, ownerId: string): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  const workspace = await ownWorkspace(id, ownerId);
  await assertKindAllowed(data.kind, ownerId);
  if (workspace.kind === 'PRO' && data.kind === 'PERSO') {
    const used = await runInWorkspace(workspace, async () => (await prisma.client.count()) + (await prisma.accountingDocument.count()) + (await prisma.importedDocument.count()));
    if (used > 0) throw clientError('BAD_USER_INPUT', 'Cet espace a des clients ou des documents de facturation : il ne peut pas devenir personnel.');
  }
  const updated = await unscopedPrisma.workspace.update({ where: { id }, data });
  await setUpWorkspace(updated);
  return updated;
}

/**
 * Chooses the notifications a workspace of an account still gives while another one is open.
 * @param {string} id Workspace.
 * @param {NotificationSource[]} sources Alarms, calendar reminders, new mails.
 * @param {string} ownerId Account.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function setWorkspaceNotifications(id: string, sources: NotificationSource[], ownerId: string): Promise<Workspace> {
  await ownWorkspace(id, ownerId);
  return unscopedPrisma.workspace.update({ where: { id }, data: { notifyElsewhere: [...new Set(sources)] } });
}

/**
 * Moves a workspace of an account in its switcher.
 * @param {string} id Workspace.
 * @param {number} index New index.
 * @param {string} ownerId Account.
 * @returns {Promise<void>}
 */
export async function moveWorkspace(id: string, index: number, ownerId: string): Promise<void> {
  await ownWorkspace(id, ownerId);
  const ids = (await listWorkspaces(ownerId)).map((workspace) => workspace.id).filter((item) => item !== id);
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
  await unscopedPrisma.$transaction(ids.map((item, position) => unscopedPrisma.workspace.update({ where: { id: item }, data: { position } })));
}

/**
 * Deletes a workspace of an account and everything in it. The account's last one cannot be deleted, unless the
 * whole account goes (its deletion takes its workspaces first).
 * @param {string} id Workspace.
 * @param {string} ownerId Account.
 * @param {{ withAccount?: boolean }} [options] The account is being deleted. Optional.
 * @returns {Promise<void>}
 */
export async function deleteWorkspace(id: string, ownerId: string, { withAccount = false }: { withAccount?: boolean } = {}): Promise<void> {
  const workspace = await ownWorkspace(id, ownerId);
  if (!withAccount && (await unscopedPrisma.workspace.count({ where: { ownerId } })) <= 1) throw clientError('BAD_USER_INPUT', 'Le dernier espace ne peut pas être supprimé.');
  await runInWorkspace(workspace, () =>
    prisma.$transaction(async (tx) => {
      // Rows other rows forbid to delete go first: the cascade from the workspace takes the rest.
      await tx.treasuryAllocation.deleteMany();
      await tx.treasuryEntry.deleteMany();
      await tx.accountingDocument.updateMany({ data: { sourceId: null } });
      await tx.accountingDocument.deleteMany();
    }),
  );
  await unscopedPrisma.workspace.delete({ where: { id } });
}

/**
 * Columns new task views of this workspace start with: chosen for it, else the app's.
 * @returns {Promise<TaskColumnDefaults>} Order and hidden columns.
 */
export async function taskColumnDefaults(): Promise<TaskColumnDefaults> {
  const workspace = await unscopedPrisma.workspace.findUnique({ where: { id: currentWorkspace().id }, select: { taskColumns: true } });
  return readTaskColumnDefaults(workspace?.taskColumns);
}

/**
 * Chooses the columns new task views of this workspace start with, or gives back the app's (null).
 * @param {TaskColumnDefaults | null} input Order and hidden columns, or null.
 * @returns {Promise<TaskColumnDefaults>} Columns now.
 */
export async function setTaskColumnDefaults(input: TaskColumnDefaults | null): Promise<TaskColumnDefaults> {
  const columns = input ? parseInput(taskColumnDefaultsSchema, input) : null;
  await unscopedPrisma.workspace.update({ where: { id: currentWorkspace().id }, data: { taskColumns: columns ?? Prisma.DbNull } });
  return readTaskColumnDefaults(columns);
}
