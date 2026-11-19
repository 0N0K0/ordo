import { notFound, orNotFound } from '../../graphql/errors';

/** Model delegate able to find one record by id (`prisma.project`, `tx.client`…). */
interface FindByIdDelegate {
  findUnique(args: { where: { id: string }; select: { id: true } }): PromiseLike<unknown>;
}

/** Model delegate able to count records by ids (`prisma.contributor`, `tx.taskTag`…). */
interface CountByIdsDelegate {
  count(args: { where: { id: { in: string[] } } }): PromiseLike<number>;
}

/** How a missing record is reported. */
export interface LookupOptions {
  /** Form field the error is attached to (BAD_USER_INPUT). Optional. Default = NOT_FOUND error. */
  field?: string;
}

/** Model delegate able to find one whole record by id (`prisma.task`, `tx.sheet`…). */
interface FindRecordDelegate<T> {
  findUnique(args: { where: { id: string } }): PromiseLike<T | null>;
}

/**
 * Whole record found by id, or NOT_FOUND « X introuvable. » when there is none. A query with `include` / `select`
 * goes through `orNotFound(model.findUnique(…), what)` (graphql/errors).
 * @param {FindRecordDelegate<T>} model Model delegate (`prisma.task`…).
 * @param {string} id Record id.
 * @param {string} what Human-readable name of the record ("Tâche", "Projet"…).
 * @returns {Promise<T>} Record.
 */
export function findOrNotFound<T>(model: FindRecordDelegate<T>, id: string, what: string): Promise<T> {
  // eslint-disable-next-line no-restricted-syntax -- findOrNotFound itself.
  return orNotFound(model.findUnique({ where: { id } }), what);
}

/**
 * Checks that a record exists. Nothing is checked when no id is given.
 * @param {FindByIdDelegate} model Model delegate (`prisma.project`…).
 * @param {string | null | undefined} id Record id. Optional.
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @param {LookupOptions} [options] Report options. Optional. Default = NOT_FOUND error.
 * @returns {Promise<void>}
 */
export async function assertExists(model: FindByIdDelegate, id: string | null | undefined, what: string, options: LookupOptions = {}): Promise<void> {
  if (id && !(await model.findUnique({ where: { id }, select: { id: true } }))) throw notFound(what, options.field);
}

/**
 * Checks that every record of a list exists (duplicates count once). Nothing is checked for an empty list.
 * @param {CountByIdsDelegate} model Model delegate (`prisma.contributor`…).
 * @param {readonly string[] | null | undefined} ids Record ids. Optional.
 * @param {string} what Human-readable name of a record ("Contributeur", "Catégorie"…).
 * @param {LookupOptions} [options] Report options. Optional. Default = NOT_FOUND error.
 * @returns {Promise<void>}
 */
export async function assertAllExist(model: CountByIdsDelegate, ids: readonly string[] | null | undefined, what: string, options: LookupOptions = {}): Promise<void> {
  if (!ids?.length) return;
  const unique = [...new Set(ids)];
  if ((await model.count({ where: { id: { in: unique } } })) !== unique.length) throw notFound(what, options.field);
}

/** Model delegate able to delete records by id (`prisma.project`, `tx.client`…). */
interface DeleteByIdDelegate {
  deleteMany(args: { where: { id: string } }): PromiseLike<{ count: number }>;
}

/**
 * Deletes a record, NOT_FOUND when there was none.
 * @param {DeleteByIdDelegate} model Model delegate (`prisma.project`…).
 * @param {string} id Record id.
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @returns {Promise<void>}
 */
export async function deleteOrNotFound(model: DeleteByIdDelegate, id: string, what: string): Promise<void> {
  const { count } = await model.deleteMany({ where: { id } });
  if (!count) throw notFound(what);
}
