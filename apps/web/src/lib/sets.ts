/**
 * A set with a value switched: removed when in it, added otherwise (a row checked, a line unfolded…).
 * @param {ReadonlySet<T>} set Set.
 * @param {T} value Value switched.
 * @returns {Set<T>} New set.
 */
export function toggledIn<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  // eslint-disable-next-line no-restricted-syntax -- toggledIn itself.
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
