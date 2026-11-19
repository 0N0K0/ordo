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

/**
 * A list with a value switched: removed when in it, added at its end otherwise (folded ids, chosen values…); or put
 * in or taken out as asked (a box ticked or unticked).
 * @param {readonly T[]} list List.
 * @param {T} value Value switched.
 * @param {boolean} [on] In (true) or out (false). Optional. Default = the opposite of now.
 * @returns {T[]} New list.
 */
export function toggledInList<T>(list: readonly T[], value: T, on: boolean = !list.includes(value)): T[] {
  if (list.includes(value) === on) return [...list];
  // eslint-disable-next-line no-restricted-syntax -- toggledInList itself.
  return on ? [...list, value] : list.filter((item) => item !== value);
}
