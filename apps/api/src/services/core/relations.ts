/**
 * Prisma references of records to connect or set in a relation, each id once.
 * @param {Iterable<string>} ids Record ids (duplicates allowed).
 * @returns {{ id: string }[]} References.
 */
export function connectIds(ids: Iterable<string>): { id: string }[] {
  return [...new Set(ids)].map((id) => ({ id }));
}

/**
 * Two ids of a symmetric link (« relative à ») in the order it is stored: the smaller first, so a pair is kept once.
 * @param {string} a One id.
 * @param {string} b The other one.
 * @returns {[string, string]} Stored pair.
 */
export function orderedPair(a: string, b: string): [string, string] {
  // eslint-disable-next-line no-restricted-syntax -- orderedPair itself.
  return a < b ? [a, b] : [b, a];
}
