import { parseCookie } from 'cookie';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, unscopedPrisma } from '../db';
import type { NotificationSource, Workspace, WorkspaceKind } from '../generated/prisma/client';
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
 * Workspaces, in the order of the switcher.
 * @returns {Promise<Workspace[]>} Workspaces.
 */
export function listWorkspaces(): Promise<Workspace[]> {
  return unscopedPrisma.workspace.findMany({ orderBy: [...byOrder] });
}

/**
 * Workspace a request asks for (header, then cookie), or the first one; one is created when there is none.
 * @param {Request} req Request.
 * @returns {Promise<Workspace>} Workspace.
 */
async function requestedWorkspace(req: Request): Promise<Workspace> {
  const header = req.headers[WORKSPACE_HEADER];
  const wanted = (typeof header === 'string' && header) || parseCookie(req.headers.cookie ?? '')[WORKSPACE_COOKIE];
  const found = wanted ? await unscopedPrisma.workspace.findUnique({ where: { id: wanted } }) : null;
  if (found) return found;
  const first = await unscopedPrisma.workspace.findFirst({ orderBy: [...byOrder] });
  return first ?? unscopedPrisma.workspace.create({ data: { name: 'Pro', kind: 'PRO' } });
}

/**
 * Express middleware: the rest of the request works in the workspace it asks for.
 * @param {Request} req Request.
 * @param {Response} _res Response.
 * @param {NextFunction} next Next handler.
 * @returns {Promise<void>}
 */
export async function workspaceMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const workspace = await requestedWorkspace(req);
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
 * Settings a workspace starts with: the "Moi" of every user, a calendar, and the tracking statuses of a
 * professional one.
 * @param {Workspace} workspace Workspace.
 * @returns {Promise<void>}
 */
async function setUpWorkspace(workspace: Workspace): Promise<void> {
  await runInWorkspace(workspace, async () => {
    for (const user of await unscopedPrisma.user.findMany({ select: { id: true, username: true } })) await ensureMeContributor(user);
    await resolveCalendarId();
    // Every category of the tracking gets a status, those already there kept.
    if (workspace.kind === 'PRO') await ensureDocumentStatuses();
  });
}

/**
 * Creates a workspace, last of the switcher.
 * @param {{ name: string, kind: WorkspaceKind }} input Name and kind.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function createWorkspace(input: { name: string; kind: WorkspaceKind }): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  const last = await unscopedPrisma.workspace.aggregate({ _max: { position: true } });
  const workspace = await unscopedPrisma.workspace.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
  await setUpWorkspace(workspace);
  return workspace;
}

/**
 * Renames a workspace or changes its kind. It only becomes personal without clients nor invoicing documents.
 * @param {string} id Workspace.
 * @param {{ name: string, kind: WorkspaceKind }} input Name and kind.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function updateWorkspace(id: string, input: { name: string; kind: WorkspaceKind }): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  const workspace = await unscopedPrisma.workspace.findUnique({ where: { id } });
  if (!workspace) throw notFound('Espace');
  if (workspace.kind === 'PRO' && data.kind === 'PERSO') {
    const used = await runInWorkspace(workspace, async () => (await prisma.client.count()) + (await prisma.accountingDocument.count()) + (await prisma.importedDocument.count()));
    if (used > 0) throw clientError('BAD_USER_INPUT', 'Cet espace a des clients ou des documents de facturation : il ne peut pas devenir personnel.');
  }
  const updated = await unscopedPrisma.workspace.update({ where: { id }, data });
  await setUpWorkspace(updated);
  return updated;
}

/**
 * Chooses the notifications a workspace still gives while another one is open.
 * @param {string} id Workspace.
 * @param {NotificationSource[]} sources Alarms, calendar reminders, new mails.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function setWorkspaceNotifications(id: string, sources: NotificationSource[]): Promise<Workspace> {
  if (!(await unscopedPrisma.workspace.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Espace');
  return unscopedPrisma.workspace.update({ where: { id }, data: { notifyElsewhere: [...new Set(sources)] } });
}

/**
 * Moves a workspace in the switcher.
 * @param {string} id Workspace.
 * @param {number} index New index.
 * @returns {Promise<void>}
 */
export async function moveWorkspace(id: string, index: number): Promise<void> {
  const ids = (await listWorkspaces()).map((workspace) => workspace.id).filter((item) => item !== id);
  if (ids.length === (await unscopedPrisma.workspace.count())) throw notFound('Espace');
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
  await unscopedPrisma.$transaction(ids.map((item, position) => unscopedPrisma.workspace.update({ where: { id: item }, data: { position } })));
}

/**
 * Deletes a workspace and everything in it. The last one cannot be deleted.
 * @param {string} id Workspace.
 * @returns {Promise<void>}
 */
export async function deleteWorkspace(id: string): Promise<void> {
  const workspace = await unscopedPrisma.workspace.findUnique({ where: { id } });
  if (!workspace) throw notFound('Espace');
  if ((await unscopedPrisma.workspace.count()) <= 1) throw clientError('BAD_USER_INPUT', 'Le dernier espace ne peut pas être supprimé.');
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
