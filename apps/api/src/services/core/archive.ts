import { ancestorsOf, dayIn, mapById, subtreeOf } from '@ordo/shared';
import type { GraphQLError } from 'graphql';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { modelDelegate } from './delegate';
import { clientError, fieldError, notFound, orNotFound } from '../../graphql/errors';
import { assertAllExist, type FindRecordDelegate, findOrNotFound } from './lookup';
import { SETTINGS_LISTS } from './settings-lists';
import { BY_POSITION } from './ordering';
import { PARIS } from '../../today';

/** Message of the error refusing a change of an archived element (or of its sub-elements). */
export const ARCHIVED_MESSAGE = 'Élément archivé : restaurez-le pour le modifier.';

/**
 * Messages refusing an archived element of another workspace (it is not restored from here, so not
 * `ARCHIVED_MESSAGE`): a calendar or a kind of schedules subscribed to.
 */
export const FOREIGN_ARCHIVED_MESSAGES = {
  // eslint-disable-next-line no-restricted-syntax -- the archived element of another workspace: cannot be restored from here.
  calendar: 'Ce calendrier est archivé.',
  // eslint-disable-next-line no-restricted-syntax -- the archived element of another workspace: cannot be restored from here.
  scheduleType: 'Ce type est archivé.',
} as const;

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
  CLIENT_CONTACT: 'clientContact',
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
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Prisma.PrismaPromise<unknown>;
  findMany(args: { where: Record<string, unknown>; select: { id: true } }): PromiseLike<{ id: string }[]>;
}

/** Models of the generic mutation also archived along with a parent (`archivedByCascade`): archived or restored here, they are on their own. */
const ALONG_WITH_PARENT = new Set<ArchivableModel>(['contributor', 'clientContact']);

/** Elements by kind. */
export type ArchiveTargets = Partial<Record<ArchivableKind, readonly string[]>>;

/** What archiving or restoring elements of a kind does besides. */
export interface ArchiveOptions {
  /** Elements of other kinds archived and restored with them (the people linked to them), from the elements given. Optional. Default = none. */
  along?: (ids: string[]) => Promise<ArchiveTargets>;
  /** Run once found, before the change, with the elements whose state changes, by kind (those along included); what it returns runs once the change is saved. Optional. Default = none. */
  settle?: (changing: ArchiveTargets) => Promise<(() => Promise<void>) | void>;
  /** Other writes saved in the same transaction as the change, from the elements whose state changes, by kind (those along included). Optional. Default = none. */
  writes?: (changing: ArchiveTargets) => Prisma.PrismaPromise<unknown>[];
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
const delegate = (model: ArchivableModel) => modelDelegate<ArchiveDelegate>(model);

/**
 * Condition of the elements archived, or not (every model tells it by its `archivedAt` date).
 * @param {boolean} archived Archived ones (else the others).
 * @returns {Record<string, unknown>} Prisma `where`.
 */
const archivedWhere = (archived: boolean): Record<string, unknown> => ({ archivedAt: archived ? { not: null } : null });

/**
 * Archives or restores elements of a kind, all at once (an id given twice counts once), with the elements of other
 * kinds that go along with them (`along`), in one transaction. Archiving keeps the date of those archived already.
 * `settle` runs once they are found, before they change: what it does elsewhere (the occurrences of routines a
 * schedule, a kind or a person archived makes disappear, asked then; their comments deleted by what it returns, once
 * saved). `writes` are saved with the change, in the same transaction (the subscriptions of other workspaces to an
 * archived calendar or kind of schedules).
 * @param {ArchivableKind} kind Kind of the elements.
 * @param {readonly string[]} ids Elements.
 * @param {boolean} archived Archives (else restores).
 * @param {ArchiveOptions} [options] Elements along and what it does elsewhere. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function setArchived(kind: ArchivableKind, ids: readonly string[], archived: boolean, { along, settle, writes }: ArchiveOptions = {}): Promise<void> {
  const unique = [...new Set(ids)];
  await assertAllExist(delegate(ARCHIVABLE[kind]), unique, 'Élément');
  if (!unique.length) return;
  const targets = new Map<ArchivableKind, Set<string>>([[kind, new Set(unique)]]);
  for (const [other, otherIds] of Object.entries(along ? await along(unique) : {}) as [ArchivableKind, readonly string[]][]) {
    targets.set(other, new Set([...(targets.get(other) ?? []), ...otherIds]));
  }
  // Only those whose state changes.
  const changing: ArchiveTargets = {};
  for (const [target, targetIds] of targets) {
    changing[target] = (await delegate(ARCHIVABLE[target]).findMany({ where: { id: { in: [...targetIds] }, ...archivedWhere(!archived) }, select: { id: true } })).map((item) => item.id);
  }
  const after = settle && Object.values(changing).some((list) => list.length) ? await settle(changing) : undefined;
  const archivedAt = archived ? new Date() : null;
  await prisma.$transaction([
    ...(Object.entries(changing) as [ArchivableKind, string[]][]).map(([target, targetIds]) =>
      delegate(ARCHIVABLE[target]).updateMany({ where: { id: { in: targetIds } }, data: { archivedAt, ...(ALONG_WITH_PARENT.has(ARCHIVABLE[target]) && { archivedByCascade: false }) } }),
    ),
    ...(writes?.(changing) ?? []),
  ]);
  if (after) await after();
}

/** How a value chosen in a form is checked: the values it had stay valid, the error shows under its field. */
export interface ChosenOptions {
  /** Values already there (the current value or values of the field): accepted even if archived. Optional. */
  keep?: string | readonly (string | null | undefined)[] | null;
  /** Field of the input (« categoryId », « lines.0.categoryId »): the error shows under it. Optional. Default = a toast. */
  field?: string;
}

/**
 * Refuses an archived element (BAD_USER_INPUT « Élément archivé… »): a change of it, or a value newly chosen in a
 * form (with `field`, the error shows under the field; the values in `keep` stay valid). Nothing is
 * checked without id nor for an element that does not exist (its own lookup tells it).
 * @param {ArchivableKind | ArchivableModel} target Kind or Prisma model of the element (« SHEET », « sheet »…).
 * @param {string | null | undefined} id Element. Optional.
 * @param {ChosenOptions} [options] Values kept and field of a chosen value. Optional.
 * @returns {Promise<void>}
 */
export async function assertNotArchived(target: ArchivableKind | ArchivableModel, id: string | null | undefined, options: ChosenOptions = {}): Promise<void> {
  if (id) await assertNoneArchived(target, [id], options);
}

/**
 * Refuses elements when one of them is archived (BAD_USER_INPUT « Élément archivé… »), as `assertNotArchived`.
 * @param {ArchivableKind | ArchivableModel} target Kind or Prisma model of the elements.
 * @param {readonly (string | null | undefined)[] | null | undefined} ids Elements (empty values skipped). Optional.
 * @param {ChosenOptions} [options] Values kept and field of chosen values. Optional.
 * @returns {Promise<void>}
 */
export async function assertNoneArchived(target: ArchivableKind | ArchivableModel, ids: readonly (string | null | undefined)[] | null | undefined, options: ChosenOptions = {}): Promise<void> {
  const kept = keptIds(options.keep);
  const checked = [...new Set(ids ?? [])].filter((id): id is string => !!id && !kept.has(id));
  if (!checked.length) return;
  const model = modelOf(target);
  if ((await delegate(model).count({ where: { id: { in: checked }, ...archivedWhere(true) } })) === 0) return;
  throw archivedError(options.field);
}

/**
 * Values accepted even if archived.
 * @param {ChosenOptions['keep']} keep Values already there. Optional.
 * @returns {Set<string>} Their ids.
 */
export function keptIds(keep: ChosenOptions['keep']): Set<string> {
  return new Set((typeof keep === 'string' ? [keep] : (keep ?? [])).filter((id): id is string => Boolean(id)));
}

/**
 * Error refusing an archived element (one message), under a field when one is given.
 * @param {string} [field] Field of the input. Optional. Default = a toast.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
export function archivedError(field?: string): GraphQLError {
  // eslint-disable-next-line no-restricted-syntax -- archivedError itself.
  return field ? fieldError(field, ARCHIVED_MESSAGE) : clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
}

/**
 * Refuses a change of an element already loaded when it is archived (BAD_USER_INPUT « Élément archivé… »).
 * @param {{ archivedAt: Date | null }} record Element (or its parent that locks it).
 * @param {string} [field] Field of the input it was chosen in: the error shows under it. Optional. Default = a toast.
 * @returns {void}
 */
export function refuseArchived(record: { archivedAt: Date | null }, field?: string): void {
  // eslint-disable-next-line no-restricted-syntax -- refuseArchived itself.
  if (record.archivedAt) throw archivedError(field);
}

/**
 * Refuses an archived element of another workspace (BAD_USER_INPUT « Ce calendrier est archivé. »…): it cannot be
 * restored from here, unlike `refuseArchived`.
 * @param {{ archivedAt: Date | null }} record Element of another workspace, already loaded.
 * @param {keyof typeof FOREIGN_ARCHIVED_MESSAGES} what What it is (its message).
 * @returns {void}
 */
export function refuseForeignArchived(record: { archivedAt: Date | null }, what: keyof typeof FOREIGN_ARCHIVED_MESSAGES): void {
  // eslint-disable-next-line no-restricted-syntax -- refuseForeignArchived itself: not restored from here.
  if (record.archivedAt) throw clientError('BAD_USER_INPUT', FOREIGN_ARCHIVED_MESSAGES[what]);
}

/**
 * Whole record that can be changed, found by id: NOT_FOUND « X introuvable. », or BAD_USER_INPUT « Élément archivé… » when it is archived (read only).
 * @param {FindRecordDelegate<T>} model Model delegate (`prisma.sheet`…).
 * @param {string} id Record id.
 * @param {string} what Human-readable name of the record ("Fiche", "Liste"…).
 * @returns {Promise<T>} Record.
 */
export async function findActive<T extends { archivedAt: Date | null }>(model: FindRecordDelegate<T>, id: string, what: string): Promise<T> {
  const record = await findOrNotFound(model, id, what);
  // eslint-disable-next-line no-restricted-syntax -- findActive itself.
  refuseArchived(record);
  return record;
}

/** Model delegate able to tell whether records are archived (`prisma.project`, `tx.stockLocation`…). */
interface ActiveDelegate {
  findUnique(args: { where: { id: string }; select: { archivedAt: true } }): PromiseLike<{ archivedAt: Date | null } | null>;
  findMany(args: { where: { id: { in: string[] } }; select: { id: true; archivedAt: true } }): PromiseLike<{ id: string; archivedAt: Date | null }[]>;
}

/** How a chosen element is checked: as `ChosenOptions`, plus the field of the error of a missing one. */
export interface ActiveOptions extends ChosenOptions {
  /** Field the « X introuvable. » error is attached to. Optional. Default = NOT_FOUND error (a toast). */
  missingField?: string;
}

/**
 * Checks that an element exists (NOT_FOUND « X introuvable. ») and is not archived (as `assertNotArchived`), in one
 * query. Nothing is checked without id.
 * @param {Pick<ActiveDelegate, 'findUnique'>} model Model delegate (`prisma.project`…).
 * @param {string | null | undefined} id Element. Optional.
 * @param {string} what Human-readable name of the element ("Projet", "Emplacement"…).
 * @param {ActiveOptions} [options] Values kept, field of an archived value and of a missing one. Optional.
 * @returns {Promise<void>}
 */
export async function assertActive(model: Pick<ActiveDelegate, 'findUnique'>, id: string | null | undefined, what: string, options: ActiveOptions = {}): Promise<void> {
  if (!id) return;
  const record = await orNotFound(model.findUnique({ where: { id }, select: { archivedAt: true } }), what, options.missingField);
  if (!keptIds(options.keep).has(id)) refuseArchived(record, options.field);
}

/**
 * Checks that every element of a list exists and none is archived (as `assertActive`), in one query.
 * @param {Pick<ActiveDelegate, 'findMany'>} model Model delegate (`prisma.task`…).
 * @param {readonly string[] | null | undefined} ids Elements. Optional.
 * @param {string} what Human-readable name of an element ("Tâche", "Catégorie"…).
 * @param {ActiveOptions} [options] Values kept, field of an archived value and of a missing one. Optional.
 * @returns {Promise<string[]>} The elements, each once.
 */
export async function activeIds(model: Pick<ActiveDelegate, 'findMany'>, ids: readonly string[] | null | undefined, what: string, options: ActiveOptions = {}): Promise<string[]> {
  const unique = [...new Set(ids ?? [])];
  if (!unique.length) return unique;
  const records = await model.findMany({ where: { id: { in: unique } }, select: { id: true, archivedAt: true } });
  if (records.length !== unique.length) throw notFound(what, options.missingField);
  const kept = keptIds(options.keep);
  for (const record of records) if (!kept.has(record.id)) refuseArchived(record, options.field);
  return unique;
}

/** Model delegate able to find the first record of a list (`prisma.calendar`, `tx.documentStatus`…). */
interface FirstDelegate<T> {
  findFirst(args: { where: object; orderBy: typeof BY_POSITION }): PromiseLike<T | null>;
}

/**
 * First record of a list in its manual order that is not archived, else the first one (archived), else none.
 * @param {FirstDelegate} model Model delegate.
 * @param {object} [where] The list: its scope. Optional. Default = every record.
 * @returns {Promise<T | null>} Record.
 */
export async function firstActive<T>(model: FirstDelegate<T>, where: object = {}): Promise<T | null> {
  return (await model.findFirst({ where: { ...where, archivedAt: null }, orderBy: BY_POSITION })) ?? model.findFirst({ where, orderBy: BY_POSITION });
}

/**
 * Whether an element is already in the archived state asked (archiving or restoring it then changes nothing).
 * @param {{ archivedAt: Date | null }} record Element.
 * @param {boolean} archived State asked: archived (else active).
 * @returns {boolean} Already so.
 */
export function isArchivedAs(record: { archivedAt: Date | null }, archived: boolean): boolean {
  return (record.archivedAt !== null) === archived;
}

/** Models archived in cascade, with `archivedByCascade`. */
type CascadeModel = 'task' | 'project' | 'routine';

/** What the models archived in cascade (tasks, projects, routines) have in common. */
interface CascadeDelegate<T> {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Prisma.PrismaPromise<unknown>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Prisma.PrismaPromise<T>;
}

/** What an archiving in cascade touches, besides the element itself. */
export interface Cascade {
  /** Elements under it: archived along with it (those active), restored with it (those archived along). */
  descendantIds: readonly string[];
  /** Its archived ancestors, restored alone with it. Optional. Default = none. */
  ancestorIds?: readonly string[];
  /** Other elements archived along with a restored ancestor (the sub-items of the ancestors are), which then stay archived on their own. Optional. */
  alongWith?: readonly Record<string, unknown>[];
  /** Other writes of a restore, in the same transaction, after the element. Optional. */
  restoreAlso?: readonly Prisma.PrismaPromise<unknown>[];
}

/**
 * Archives an element with its active sub-elements, or restores it with the sub-elements archived along and its
 * archived ancestors (alone: their other sub-elements archived along then stay archived on their own), in one transaction.
 * @param {CascadeModel} model Prisma model (with `archivedByCascade`).
 * @param {string} id Element.
 * @param {boolean} archived Archives (else restores).
 * @param {Cascade} cascade Elements touched.
 * @returns {Promise<T>} Updated element.
 */
export async function cascadeArchive<T>(model: CascadeModel, id: string, archived: boolean, cascade: Cascade): Promise<T> {
  const items = modelDelegate<CascadeDelegate<T>>(model);
  const descendantIds = [...cascade.descendantIds];
  const ancestorIds = [...(cascade.ancestorIds ?? [])];
  if (archived) {
    const now = new Date();
    const [, updated] = await prisma.$transaction([
      items.updateMany({ where: { id: { in: descendantIds }, archivedAt: null }, data: { archivedAt: now, archivedByCascade: true } }),
      items.update({ where: { id }, data: { archivedAt: now, archivedByCascade: false } }),
    ]);
    return updated;
  }
  const [, , , updated] = await prisma.$transaction([
    items.updateMany({ where: { id: { in: descendantIds }, archivedByCascade: true }, data: { archivedAt: null, archivedByCascade: false } }),
    items.updateMany({ where: { id: { in: ancestorIds } }, data: { archivedAt: null, archivedByCascade: false } }),
    items.updateMany({
      where: { archivedByCascade: true, id: { notIn: [id, ...descendantIds] }, OR: [{ parentId: { in: ancestorIds } }, ...(cascade.alongWith ?? [])] },
      data: { archivedByCascade: false },
    }),
    items.update({ where: { id }, data: { archivedAt: null, archivedByCascade: false } }),
    ...(cascade.restoreAlso ?? []),
  ]);
  return updated as T;
}

/** What the trees archived in cascade (tasks, routines) have in common. */
interface ArchiveTreeDelegate<T> {
  findUnique(args: { where: { id: string } }): PromiseLike<T | null>;
  findMany(args: { select: { id: true; parentId: true; archivedAt: true } }): PromiseLike<{ id: string; parentId: string | null; archivedAt: Date | null }[]>;
}

/**
 * Archives an item of a tree (task, routine) with its active sub-items, or restores it with the sub-items archived
 * along and its archived ancestors (alone: their other sub-items archived along then stay archived on their own).
 * Already in that state: nothing changes.
 * @param {'task' | 'routine'} model Prisma model (with `parentId` and `archivedByCascade`).
 * @param {string} id Item.
 * @param {boolean} archived Archives (else restores).
 * @param {string} what Human-readable name of the item (« Tâche », « Routine »), for « X introuvable. ».
 * @returns {Promise<T>} Item.
 */
export async function archiveTree<T extends { archivedAt: Date | null }>(model: 'task' | 'routine', id: string, archived: boolean, what: string): Promise<T> {
  const items = modelDelegate<ArchiveTreeDelegate<T>>(model);
  const item = await findOrNotFound(items, id, what);
  if (isArchivedAs(item, archived)) return item;
  const all = await items.findMany({ select: { id: true, parentId: true, archivedAt: true } });
  const descendantIds = [...subtreeOf(all, id, false)];
  const ancestorIds = ancestorsOf(mapById(all), id)
    .filter((ancestor) => ancestor.archivedAt)
    .map((ancestor) => ancestor.id);
  return cascadeArchive<T>(model, id, archived, { descendantIds, ancestorIds });
}

/**
 * Day an item with occurrences (a routine, an event) was archived, Paris time: its occurrences started
 * before that day stay, archived (read only), even those ending on or after it; none starting on or after it.
 * Restored, it has them all again. Null when not archived.
 * @param {{ archivedAt?: Date | null }} item Item.
 * @returns {string | null} Day (YYYY-MM-DD).
 */
export const archivedOn = (item: { archivedAt?: Date | null }): string | null => (item.archivedAt ? dayIn(item.archivedAt, PARIS) : null);
