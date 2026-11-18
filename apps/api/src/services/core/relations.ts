/**
 * Prisma references of records to connect or set in a relation, each id once.
 * @param {Iterable<string>} ids Record ids (duplicates allowed).
 * @returns {{ id: string }[]} References.
 */
export function connectIds(ids: Iterable<string>): { id: string }[] {
  return [...new Set(ids)].map((id) => ({ id }));
}
