import { modelDelegate } from './delegate';
import { colorSchema } from '@ordo/shared';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { fieldError, orNotFound } from '../../graphql/errors';
import { deleteOrphanIcons, resolveIconUpdate } from './icons';

/**
 * Settings lists sharing the same look (color, image, name) and manual order, by their kind: the Prisma model of each.
 * Places are a tree of their own (their order and parents), the other trees move with their own mutations.
 */
export const SETTINGS_LISTS = {
  PROJECT_STATUS: 'projectStatus',
  PROJECT_CATEGORY: 'projectCategory',
  TASK_STATUS: 'taskStatus',
  TASK_PRIORITY: 'taskPriority',
  TASK_TYPE: 'taskType',
  TASK_TAG: 'taskTag',
  DOCUMENT_STATUS: 'documentStatus',
  SHEET_CATEGORY: 'sheetCategory',
  SHOPPING_STORE: 'shoppingStore',
  SHOPPING_UNIT: 'shoppingUnit',
  SHOPPING_STORAGE: 'shoppingStorage',
  SHOPPING_BASE_LIST: 'shoppingBaseList',
  SHOPPING_CATEGORY: 'shoppingCategory',
  MAIL_LABEL: 'mailLabel',
  CALENDAR: 'calendar',
  CALENDAR_CATEGORY: 'calendarCategory',
  SCHEDULE_TYPE: 'scheduleType',
  TREASURY_ACCOUNT: 'treasuryAccount',
  TREASURY_PAYMENT_METHOD: 'treasuryPaymentMethod',
  TREASURY_COUNTERPARTY: 'treasuryCounterparty',
  TREASURY_CATEGORY: 'treasuryCategory',
  ROUTINE_CATEGORY: 'routineCategory',
  STOCK_LOCATION: 'stockLocation',
  SAVED_COUNTDOWN: 'savedCountdown',
  TASK_AUTOMATION: 'taskAutomation',
  PLACE: 'place',
} as const;

export type SettingsListKind = keyof typeof SETTINGS_LISTS;

/** What the lists have in common, whatever their model (each delegate of Prisma has these). */
interface ListDelegate {
  findUnique(args: { where: { id: string }; select: { id: true; iconId: true } }): Promise<{ id: string; iconId: string | null } | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Prisma.PrismaPromise<unknown>;
}

/**
 * Model of a settings list.
 * @param {SettingsListKind} kind List.
 * @returns {ListDelegate} Its Prisma delegate (scoped to the current workspace, as every model).
 */
const delegate = (kind: SettingsListKind) => modelDelegate<ListDelegate>(SETTINGS_LISTS[kind]);

/**
 * Changes the look of an item of a settings list: its color and / or its image (replaced or removed). NOT_FOUND
 * « Élément introuvable. » when there is none (an archived one is refused by its mutation).
 * @param {SettingsListKind} kind List.
 * @param {string} id Item.
 * @param {object} input Look.
 * @param {string | null} [input.color] New color; null: none (where the list allows it). Optional.
 * @param {File | null} [input.icon] New image. Optional.
 * @param {boolean | null} [input.removeIcon] Removes the current image. Optional.
 * @returns {Promise<string | null>} Image id after the change.
 */
export async function setLook(kind: SettingsListKind, id: string, input: { color?: string | null; icon?: File | null; removeIcon?: boolean | null }): Promise<string | null> {
  const model = delegate(kind);
  const item = await orNotFound(model.findUnique({ where: { id }, select: { id: true, iconId: true } }), 'Élément');
  // The same rule as every color of the app (#rrggbb).
  let color = input.color;
  if (color) {
    const parsed = colorSchema.safeParse(color);
    if (!parsed.success) throw fieldError('color', 'Couleur invalide (format #rrggbb).');
    color = parsed.data;
  }
  const iconId = await resolveIconUpdate(item.iconId, input);
  const data: Record<string, unknown> = {};
  if (color !== undefined) data.color = color;
  if (iconId !== undefined) data.iconId = iconId;
  if (Object.keys(data).length) await model.update({ where: { id }, data });
  if (iconId !== undefined) await deleteOrphanIcons([item.iconId]);
  return iconId === undefined ? item.iconId : iconId;
}

/**
 * Puts the items of a flat settings list in the order given (each one's position is its index), all at once or not at
 * all.
 * @param {SettingsListKind} kind List.
 * @param {string[]} ids Items, in their new order.
 * @returns {Promise<void>}
 */
export async function reorder(kind: SettingsListKind, ids: string[]): Promise<void> {
  const model = delegate(kind);
  await prisma.$transaction(ids.map((id, position) => model.update({ where: { id }, data: { position } })));
}
