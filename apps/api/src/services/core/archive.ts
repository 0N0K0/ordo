import { prisma } from '../../db';
import { clientError } from '../../graphql/errors';
import { assertAllExist } from './lookup';
import { SETTINGS_LISTS } from './settings-lists';

/** Message of the error refusing a change of an archived element (or of its sub-elements). */
export const ARCHIVED_MESSAGE = 'Élément archivé : restaurez-le pour le modifier.';

/** Main elements of the features archived through the generic mutation, by kind: the Prisma model of each. */
const MAIN = {
  MILESTONE: 'milestone',
  SPRINT: 'sprint',
  DASHBOARD: 'dashboard',
  CALENDAR_EVENT: 'calendarEvent',
  WORK_SCHEDULE: 'workSchedule',
  ACCOUNTING_DOCUMENT: 'accountingDocument',
  RECURRING_INVOICE: 'recurringInvoice',
  IMPORTED_DOCUMENT: 'importedDocument',
  TREASURY_ENTRY: 'treasuryEntry',
  TREASURY_BUDGET: 'treasuryBudget',
  TREASURY_RELATION: 'treasuryRelation',
  SHOPPING_LIST: 'shoppingList',
  SHOPPING_PRODUCT: 'shoppingProduct',
  STOCK_ITEM: 'stockItem',
  SHEET: 'sheet',
  CONTRIBUTOR: 'contributor',
  MAIL_ACCOUNT: 'mailAccount',
  CATALOG_ITEM: 'catalogItem',
} as const;

/**
 * Elements archived through the generic mutation, by kind: the main elements of the features and every settings list
 * (same kinds as `SettingsListKind`). Clients, projects, tasks and routines keep their own mutations (their cascades).
 */
export const ARCHIVABLE = { ...MAIN, ...SETTINGS_LISTS } as const;

export type ArchivableKind = keyof typeof ARCHIVABLE;

/** Prisma model (delegate name) of an element that can be archived, those with their own mutations included. */
export type ArchivableModel = (typeof ARCHIVABLE)[ArchivableKind] | 'client' | 'project' | 'task' | 'routine';

/** What the archivable models have in common (each delegate of Prisma has these). */
interface ArchiveDelegate {
  count(args: { where: Record<string, unknown> }): PromiseLike<number>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): PromiseLike<unknown>;
}

/**
 * Whether a value is a kind of the generic mutation (else a Prisma model).
 * @param {ArchivableKind | ArchivableModel} target Kind or model.
 * @returns {boolean} A kind.
 */
const isKind = (target: ArchivableKind | ArchivableModel): target is ArchivableKind => target in ARCHIVABLE;

/**
 * Prisma model of a kind or model.
 * @param {ArchivableKind | ArchivableModel} target Kind or model.
 * @returns {ArchivableModel} Model.
 */
const modelOf = (target: ArchivableKind | ArchivableModel): ArchivableModel => (isKind(target) ? ARCHIVABLE[target] : target);

/**
 * Delegate of a model.
 * @param {ArchivableModel} model Model.
 * @returns {ArchiveDelegate} Its Prisma delegate (scoped to the current workspace, as every model).
 */
const delegate = (model: ArchivableModel) => (prisma as unknown as Record<string, ArchiveDelegate>)[model];

/**
 * Condition of the elements archived, or not (every model tells it by its `archivedAt` date).
 * @param {boolean} archived Archived ones (else the others).
 * @returns {Record<string, unknown>} Prisma `where`.
 */
const archivedWhere = (archived: boolean): Record<string, unknown> => ({ archivedAt: archived ? { not: null } : null });

/**
 * Archives or restores elements of a kind, all at once (an id given twice counts once). Archiving keeps the date of
 * those archived already.
 * @param {ArchivableKind} kind Kind of the elements.
 * @param {readonly string[]} ids Elements.
 * @param {boolean} archived Archives (else restores).
 * @returns {Promise<void>}
 */
export async function setArchived(kind: ArchivableKind, ids: readonly string[], archived: boolean): Promise<void> {
  const model = ARCHIVABLE[kind];
  const unique = [...new Set(ids)];
  await assertAllExist(delegate(model), unique, 'Élément');
  if (!unique.length) return;
  await delegate(model).updateMany({ where: { id: { in: unique }, ...archivedWhere(!archived) }, data: { archivedAt: archived ? new Date() : null } });
}

/**
 * Refuses a change of an archived element (BAD_USER_INPUT « Élément archivé… »). Nothing is checked without id nor
 * for an element that does not exist (its own lookup tells it).
 * @param {ArchivableKind | ArchivableModel} target Kind or Prisma model of the element (« SHEET », « sheet »…).
 * @param {string | null | undefined} id Element. Optional.
 * @returns {Promise<void>}
 */
export async function assertNotArchived(target: ArchivableKind | ArchivableModel, id: string | null | undefined): Promise<void> {
  if (id) await assertNoneArchived(target, [id]);
}

/**
 * Refuses a change of elements when one of them is archived (BAD_USER_INPUT « Élément archivé… »).
 * @param {ArchivableKind | ArchivableModel} target Kind or Prisma model of the elements.
 * @param {readonly string[] | null | undefined} ids Elements. Optional.
 * @returns {Promise<void>}
 */
export async function assertNoneArchived(target: ArchivableKind | ArchivableModel, ids: readonly string[] | null | undefined): Promise<void> {
  if (!ids?.length) return;
  const model = modelOf(target);
  if ((await delegate(model).count({ where: { id: { in: [...new Set(ids)] }, ...archivedWhere(true) } })) > 0) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
}
