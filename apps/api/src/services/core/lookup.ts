import type { GraphQLError } from 'graphql';
import { fieldError, notFound } from '../../graphql/errors';

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

/**
 * Error for a missing record: « X introuvable. », attached to a field when one is given.
 * @param {string} what Human-readable name of the record ("Client", "Projet"…).
 * @param {LookupOptions} options Report options.
 * @returns {GraphQLError} NOT_FOUND error, or BAD_USER_INPUT error of the field.
 */
function missing(what: string, { field }: LookupOptions): GraphQLError {
  return field ? fieldError(field, `${what} introuvable.`) : notFound(what);
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
  if (id && !(await model.findUnique({ where: { id }, select: { id: true } }))) throw missing(what, options);
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
  if ((await model.count({ where: { id: { in: unique } } })) !== unique.length) throw missing(what, options);
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
