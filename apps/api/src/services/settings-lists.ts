import { prisma } from '../db';
import { clientError } from '../graphql/errors';
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
  TREASURY_CONTEXT: 'treasuryContext',
  TREASURY_PAYMENT_METHOD: 'treasuryPaymentMethod',
  TREASURY_COUNTERPARTY: 'treasuryCounterparty',
  TREASURY_CATEGORY: 'treasuryCategory',
  ROUTINE_CATEGORY: 'routineCategory',
  STOCK_LOCATION: 'stockLocation',
  PLACE: 'place',
} as const;

export type SettingsListKind = keyof typeof SETTINGS_LISTS;

/** What the lists have in common, whatever their model (each delegate of Prisma has these). */
interface ListDelegate {
  findUniqueOrThrow(args: { where: { id: string }; select: { id: true; iconId: true } }): Promise<{ id: string; iconId: string | null }>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Model of a settings list.
 * @param {SettingsListKind} kind List.
 * @returns {ListDelegate} Its Prisma delegate (scoped to the current workspace, as every model).
 */
const delegate = (kind: SettingsListKind) => (prisma as unknown as Record<string, ListDelegate>)[SETTINGS_LISTS[kind]];

/** Color of an item: a name of the palette (« blue ») or a hex color. */
const COLOR = /^(#[0-9a-f]{6}|[a-z]+(\.[0-9])?)$/i;

/**
 * Changes the look of an item of a settings list: its color and / or its image (replaced or removed).
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
  const item = await model.findUniqueOrThrow({ where: { id }, select: { id: true, iconId: true } });
  if (input.color !== undefined && input.color !== null && !COLOR.test(input.color)) throw clientError('BAD_USER_INPUT', 'Couleur invalide.', { fields: { color: 'Couleur invalide.' } });
  const iconId = await resolveIconUpdate(item.iconId, input);
  const data: Record<string, unknown> = {};
  if (input.color !== undefined) data.color = input.color;
  if (iconId !== undefined) data.iconId = iconId;
  if (Object.keys(data).length) await model.update({ where: { id }, data });
  if (iconId !== undefined) await deleteOrphanIcons([item.iconId]);
  return iconId === undefined ? item.iconId : iconId;
}

/**
 * Puts the items of a flat settings list in the order given (each one's position is its index).
 * @param {SettingsListKind} kind List.
 * @param {string[]} ids Items, in their new order.
 * @returns {Promise<void>}
 */
export async function reorder(kind: SettingsListKind, ids: string[]): Promise<void> {
  const model = delegate(kind);
  for (const [position, id] of ids.entries()) await model.update({ where: { id }, data: { position } });
}
