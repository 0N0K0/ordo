import { parseCookie } from 'cookie';
import { addSharedContexts } from '../treasury/treasury-contexts';
import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_SHOPPING_UNITS,
  readTableColumnDefaults,
  storedTableColumnDefaults,
  TABLE_COLUMN_DEFAULTS_MAX,
  tableColumnDefaultsSchema,
  tableKeySchema,
  weekSpanSchema,
  type TableColumnDefaults,
  type WeekSpan,
  workspaceLabelSchema,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma, unscopedPrisma } from '../../db';
import { BY_POSITION, nextPositionIn, saveSiblingOrder } from '../core/ordering';
import { Prisma, type NotificationSource, type Workspace, type WorkspaceKind } from '../../generated/prisma/client';
import { clientError, notFound, parseInput } from '../../graphql/errors';
import { assertExists, findOrNotFound } from '../core/lookup';
import { currentWorkspace, currentWorkspaceId, runInWorkspace } from '../../workspace-context';
import { currentWorkspaceFields } from './current-workspace';
import { toJson } from '../core/json';
import { resolveCalendarId } from '../calendar/calendars';
import { freeHandle } from '../projects/contributors';
import { ensureDocumentStatuses } from '../accounting/document-statuses';

/** Cookie (and header) naming the workspace the app shows. */
const WORKSPACE_COOKIE = 'ordo_workspace';
const WORKSPACE_HEADER = 'x-ordo-workspace';

const workspaceInputSchema = z.object({
  label: workspaceLabelSchema,
  kind: z.enum(['PRO', 'PERSO']),
});

/**
 * Workspaces, in the order of the switcher.
 * @returns {Promise<Workspace[]>} Workspaces.
 */
export function listWorkspaces(): Promise<Workspace[]> {
  return unscopedPrisma.workspace.findMany({ orderBy: BY_POSITION });
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
  const first = await unscopedPrisma.workspace.findFirst({ orderBy: BY_POSITION });
  return first ?? unscopedPrisma.workspace.create({ data: { label: 'Pro', kind: 'PRO' } });
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
  const workspaces = await unscopedPrisma.workspace.findMany({ where: options.kind ? { kind: options.kind } : {}, orderBy: BY_POSITION });
  for (const workspace of workspaces) {
    try {
      await runInWorkspace(workspace, () => job(workspace));
    } catch (error) {
      console.error(`Workspace « ${workspace.label} »:`, error);
    }
  }
}

/**
 * Runs a background job a while after the start, then at an interval (Node timers, no cron); a run still going when
 * the next one is due makes it skip; a failure is logged, the next run comes anyway.
 * @param {string} label What fails, in the log (« Envois programmés »).
 * @param {() => Promise<unknown>} job Job.
 * @param {{ delay: number, interval: number }} timing First run (ms after the start), interval (ms).
 * @returns {void}
 */
export function scheduleJob(label: string, job: () => Promise<unknown>, { delay, interval }: { delay: number; interval: number }): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void job()
      .catch((error: unknown) => console.warn(`${label} en échec.`, error))
      .finally(() => {
        running = false;
      });
  };
  setTimeout(run, delay);
  setInterval(run, interval);
}

/**
 * Runs a background job in every workspace (of a kind) a while after the start, then at an interval (`scheduleJob`).
 * @param {string} label What fails, in the log (« Envois programmés »).
 * @param {(workspace: Workspace) => Promise<unknown>} job Job, run in each workspace.
 * @param {{ delay: number, interval: number, kind?: WorkspaceKind }} timing First run (ms after the start), interval (ms), workspaces of a kind only.
 * @returns {void}
 */
export function schedulePerWorkspace(label: string, job: (workspace: Workspace) => Promise<unknown>, { delay, interval, kind }: { delay: number; interval: number; kind?: WorkspaceKind }): void {
  scheduleJob(label, () => forEachWorkspace(job, { kind }), { delay, interval });
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
  const handle = await freeHandle(user.username, { fallback: 'moi', suffix: 'moi' });
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
    // The usual units of quantity of the shopping products.
    if (!(await prisma.shoppingUnit.count())) await prisma.shoppingUnit.createMany({ data: DEFAULT_SHOPPING_UNITS.map((label, position) => ({ label, position })) });
  });
}

/**
 * Creates a workspace, last of the switcher.
 * @param {{ label: string, kind: WorkspaceKind }} input Label and kind.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function createWorkspace(input: { label: string; kind: WorkspaceKind }): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  const workspace = await unscopedPrisma.workspace.create({ data: { ...data, position: await nextPositionIn('workspace', {}, unscopedPrisma) } });
  await setUpWorkspace(workspace);
  // The contexts of the budget shared by the other workspaces are contexts here too.
  await addSharedContexts(workspace.id);
  return workspace;
}

/**
 * Renames a workspace or changes its kind. It only becomes personal without clients nor invoicing documents.
 * @param {string} id Workspace.
 * @param {{ label: string, kind: WorkspaceKind }} input Label and kind.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function updateWorkspace(id: string, input: { label: string; kind: WorkspaceKind }): Promise<Workspace> {
  const data = parseInput(workspaceInputSchema, input);
  const workspace = await findOrNotFound(unscopedPrisma.workspace, id, 'Espace');
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
 * @param {NotificationSource[]} sources New mails (alarms and reminders always ring).
 * @returns {Promise<Workspace>} Workspace.
 */
export async function setWorkspaceNotifications(id: string, sources: NotificationSource[]): Promise<Workspace> {
  await assertExists(unscopedPrisma.workspace, id, 'Espace');
  return unscopedPrisma.workspace.update({ where: { id }, data: { notifyElsewhere: [...new Set(sources)] } });
}

/**
 * Sets the week of a workspace: its first and last days (1 = Monday … 7 = Sunday).
 * @param {string} id Workspace.
 * @param {WeekSpan} week Week.
 * @returns {Promise<Workspace>} Workspace.
 */
export async function setWorkspaceWeek(id: string, week: WeekSpan): Promise<Workspace> {
  const { start, end } = parseInput(weekSpanSchema, week);
  await assertExists(unscopedPrisma.workspace, id, 'Espace');
  return unscopedPrisma.workspace.update({ where: { id }, data: { weekStart: start, weekEnd: end } });
}

/**
 * Moves a workspace in the switcher.
 * @param {string} id Workspace.
 * @param {number} index New index.
 * @returns {Promise<void>}
 */
export async function moveWorkspace(id: string, index: number): Promise<void> {
  const ids = (await listWorkspaces()).map((workspace) => workspace.id);
  if (!ids.includes(id)) throw notFound('Espace');
  await saveSiblingOrder(ids, id, index, (item, position) => unscopedPrisma.workspace.update({ where: { id: item }, data: { position } }), unscopedPrisma);
}

/**
 * Deletes a workspace and everything in it. The last one cannot be deleted.
 * @param {string} id Workspace.
 * @returns {Promise<void>}
 */
export async function deleteWorkspace(id: string): Promise<void> {
  const workspace = await findOrNotFound(unscopedPrisma.workspace, id, 'Espace');
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

/**
 * Columns new views of a table of this workspace start with: chosen for it, else the app's.
 * @param {string} tableKey Table.
 * @returns {Promise<TableColumnDefaults>} Order and hidden columns.
 */
export async function tableColumnDefaults(tableKey: string): Promise<TableColumnDefaults> {
  const key = parseInput(tableKeySchema, tableKey);
  const workspace = await currentWorkspaceFields({ tableColumns: true });
  return readTableColumnDefaults(storedTableColumnDefaults(workspace.tableColumns)[key], key);
}

/**
 * Chooses the columns new views of a table of this workspace start with, or gives back the app's (null); those of the
 * other tables are kept.
 * @param {string} tableKey Table.
 * @param {TableColumnDefaults | null} input Order and hidden columns, or null.
 * @returns {Promise<TableColumnDefaults>} Columns now.
 */
export async function setTableColumnDefaults(tableKey: string, input: TableColumnDefaults | null): Promise<TableColumnDefaults> {
  const key = parseInput(tableKeySchema, tableKey);
  const columns = input ? parseInput(tableColumnDefaultsSchema, input) : null;
  const stored = storedTableColumnDefaults((await currentWorkspaceFields({ tableColumns: true })).tableColumns);
  if (columns) {
    if (!(key in stored) && Object.keys(stored).length >= TABLE_COLUMN_DEFAULTS_MAX) throw clientError('BAD_USER_INPUT', 'Trop de tableaux ont des colonnes par défaut.');
    stored[key] = columns;
  } else delete stored[key];
  await unscopedPrisma.workspace.update({ where: { id: currentWorkspaceId() }, data: { tableColumns: Object.keys(stored).length ? toJson(stored) : Prisma.DbNull } });
  return readTableColumnDefaults(columns, key);
}
