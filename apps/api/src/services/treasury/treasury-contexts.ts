import { prisma, unscopedPrisma } from '../../db';
import { clientError, notFound } from '../../graphql/errors';
import { archivedError, keptIds, type ChosenOptions } from '../core/archive';
import { countOf } from '@ordo/shared';

/**
 * Contexts of the treasury as kinds of éphémérides: a kind « Sert de contexte au budget » is a context in its
 * workspace, in every workspace of the user when « Partagé entre espaces » (the same access as the slot conditions
 * naming the schedules of another workspace). Each workspace where it is one has a row of its own, which its
 * lines and budgets name; the kind holds the label, color, image, position and archiving.
 */

/** Budget fields of a kind. */
interface KindContext {
  budgetContext: boolean;
  sharedContext: boolean;
}

/**
 * Workspaces where a kind is a context: none, its own, or every one when shared.
 * @param {{ workspaceId: string } & KindContext} type Kind.
 * @returns {Promise<string[]>} Workspace ids.
 */
async function contextWorkspaces(type: { workspaceId: string } & KindContext): Promise<string[]> {
  if (!type.budgetContext) return [];
  if (!type.sharedContext) return [type.workspaceId];
  return (await unscopedPrisma.workspace.findMany({ select: { id: true } })).map((workspace) => workspace.id);
}

/**
 * Refuses a change of the budget fields of a kind that would take its context from a workspace where lines or budgets
 * have it (they would lose it): « Sert de contexte au budget » turned off, or « Partagé entre espaces » turned off.
 * @param {string} typeId Kind.
 * @param {KindContext} next Budget fields as they would be saved.
 * @returns {Promise<void>}
 */
export async function assertKindContextsKept(typeId: string, next: KindContext): Promise<void> {
  const type = await unscopedPrisma.scheduleType.findUnique({ where: { id: typeId }, select: { workspaceId: true } });
  if (!type) return;
  const kept = new Set(await contextWorkspaces({ workspaceId: type.workspaceId, ...next }));
  const dropped = await unscopedPrisma.treasuryContext.findMany({
    where: { scheduleTypeId: typeId, workspaceId: { notIn: [...kept] } },
    select: { workspace: { select: { label: true } }, _count: { select: { lines: true, budgets: true } } },
  });
  const used = dropped.find((context) => context._count.lines + context._count.budgets > 0);
  if (used)
    throw clientError(
      'BAD_USER_INPUT',
      `Ce contexte a ${countOf(used._count.lines, 'ligne')} et ${countOf(used._count.budgets, 'budget')} dans l’espace « ${used.workspace.label} » : il le reste (archivez plutôt le type).`,
    );
}

/**
 * Keeps the contexts of a kind: one row in each workspace where it is a context (created when missing), none
 * elsewhere (removed; `assertKindContextsKept` first).
 * @param {string} typeId Kind.
 * @returns {Promise<void>}
 */
export async function syncKindContexts(typeId: string): Promise<void> {
  const type = await unscopedPrisma.scheduleType.findUnique({ where: { id: typeId }, select: { workspaceId: true, budgetContext: true, sharedContext: true } });
  if (!type) return;
  const targets = await contextWorkspaces(type);
  await unscopedPrisma.treasuryContext.deleteMany({ where: { scheduleTypeId: typeId, workspaceId: { notIn: targets } } });
  const existing = new Set(
    (await unscopedPrisma.treasuryContext.findMany({ where: { scheduleTypeId: typeId }, select: { workspaceId: true } })).map((context) => context.workspaceId),
  );
  const missing = targets.filter((workspaceId) => !existing.has(workspaceId));
  if (missing.length) await unscopedPrisma.treasuryContext.createMany({ data: missing.map((workspaceId) => ({ workspaceId, scheduleTypeId: typeId })), skipDuplicates: true });
}

/**
 * Gives a new workspace the contexts shared by the other workspaces.
 * @param {string} workspaceId New workspace.
 * @returns {Promise<void>}
 */
export async function addSharedContexts(workspaceId: string): Promise<void> {
  const shared = await unscopedPrisma.scheduleType.findMany({ where: { budgetContext: true, sharedContext: true, workspaceId: { not: workspaceId } }, select: { id: true } });
  if (shared.length) await unscopedPrisma.treasuryContext.createMany({ data: shared.map((type) => ({ workspaceId, scheduleTypeId: type.id })), skipDuplicates: true });
}

/**
 * Refuses contexts of this workspace that do not exist (« Contexte » introuvable) or whose kind is archived, unless
 * kept (those already chosen).
 * @param {readonly (string | null | undefined)[]} ids Contexts.
 * @param {ChosenOptions} [options] Contexts kept and field of the error. Optional.
 * @returns {Promise<void>}
 */
export async function assertContextsActive(ids: readonly (string | null | undefined)[], options: ChosenOptions = {}): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  const contexts = await prisma.treasuryContext.findMany({ where: { id: { in: unique } }, select: { id: true, scheduleType: { select: { archivedAt: true } } } });
  if (contexts.length !== unique.length) throw notFound('Contexte', options.field);
  const kept = keptIds(options.keep);
  if (contexts.some((context) => context.scheduleType.archivedAt && !kept.has(context.id))) throw archivedError(options.field);
}
