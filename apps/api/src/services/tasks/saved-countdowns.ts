import { savedCountdownLinksSchema, savedCountdownSchema, type SavedCountdownTarget } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Prisma, SavedCountdown } from '../../generated/prisma/client';
import { orNotFound, parseInput } from '../../graphql/errors';
import { activeIds, assertNotArchived, refuseArchived } from '../core/archive';
import { createLabelService } from '../core/labels';
import { connectIds } from '../core/relations';

/**
 * Saved timers (« minuteurs enregistrés ») of the workspace: a settings list (name, color, image, duration, ringtone,
 * manual order, archive), each started again in one click, alone or from the tasks, routines, events and sheets it is
 * linked to. Started, it is a timer of the user (`Countdown`) copying its name, duration and ringtone.
 */

/** CRUD of the saved timers: a name taken is a conflict; a null ringtone is the one of the settings. */
export const savedCountdowns = createLabelService<SavedCountdown>(
  'savedCountdown',
  { notFound: 'Minuteur', conflict: 'Un minuteur porte déjà ce nom.' },
  { schema: savedCountdownSchema, clearable: ['ringtone'] },
);

/** Model of each item, its name in the errors, and its relation on the saved timers. */
const TARGETS = {
  TASK: { model: 'task', what: 'Tâche', relation: 'tasks' },
  ROUTINE: { model: 'routine', what: 'Routine', relation: 'routines' },
  EVENT: { model: 'calendarEvent', what: 'Évènement', relation: 'events' },
  SHEET: { model: 'sheet', what: 'Fiche', relation: 'sheets' },
} as const;

/** An item with its saved timers, as loaded to link them. */
interface LinkedItem {
  archivedAt: Date | null;
  calendarId?: string;
  savedCountdowns: { id: string }[];
}

/** Saved timers of an item, as sent: each once, 20 at most (the error under the field). */
const linksInput = z.object({ savedCountdownIds: savedCountdownLinksSchema });

/** What the four item models share to link saved timers. */
interface LinkDelegate {
  findUnique(args: { where: { id: string }; include: { savedCountdowns: { select: { id: true } } } }): PromiseLike<LinkedItem | null>;
  update(args: { where: { id: string }; data: { savedCountdowns: { set: { id: string }[] } } }): PromiseLike<unknown>;
}

/**
 * Prisma delegate of an item.
 * @param {SavedCountdownTarget} target Kind of item.
 * @returns {LinkDelegate} Delegate.
 */
const delegateOf = (target: SavedCountdownTarget): LinkDelegate => prisma[TARGETS[target].model] as unknown as LinkDelegate;

/**
 * Sets the saved timers of a task, a routine, an event (its whole series) or a sheet, in place of the current ones;
 * refused on an archived item (an event of an archived calendar too); a saved timer archived is not newly chosen (one
 * already there stays).
 * @param {SavedCountdownTarget} target Kind of item.
 * @param {string} id Item.
 * @param {readonly string[]} ids Saved timers, 20 at most.
 * @returns {Promise<void>}
 */
export async function setSavedCountdownLinks(target: SavedCountdownTarget, id: string, ids: readonly string[]): Promise<void> {
  const wanted = parseInput(linksInput, { savedCountdownIds: ids }).savedCountdownIds;
  const model = delegateOf(target);
  const item = await orNotFound(model.findUnique({ where: { id }, include: { savedCountdowns: { select: { id: true } } } }), TARGETS[target].what);
  refuseArchived(item);
  // An event of an archived calendar is read only too.
  if (target === 'EVENT') await assertNotArchived('calendar', item.calendarId);
  const current = item.savedCountdowns.map((saved) => saved.id);
  await activeIds(prisma.savedCountdown, wanted, 'Minuteur', { keep: current, field: 'savedCountdownIds' });
  await model.update({ where: { id }, data: { savedCountdowns: { set: connectIds(wanted) } } });
}

/** Client able to read the saved timers (the scoped client, or a transaction). */
type SavedCountdownReader = Pick<typeof prisma, 'savedCountdown'> | Prisma.TransactionClient;

/**
 * Saved timers of an item, as the item made of it keeps them (a copy, a task turned into a routine and back, a series
 * split, an event postponed).
 * @param {SavedCountdownTarget} target Kind of the item.
 * @param {string} id Item.
 * @param {SavedCountdownReader} [client] Client or transaction. Optional. Default = the scoped client.
 * @returns {Promise<{ connect: { id: string }[] }>} Relation of the new item.
 */
export async function linkedSavedCountdowns(target: SavedCountdownTarget, id: string, client: SavedCountdownReader = prisma): Promise<{ connect: { id: string }[] }> {
  return { connect: await client.savedCountdown.findMany({ where: { [TARGETS[target].relation]: { some: { id } } }, select: { id: true } }) };
}
