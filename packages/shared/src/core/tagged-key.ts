/**
 * Value of an element in a list mixing kinds (a select of clients and counterparties, drag ids…): « <tag>:<id> ».
 * @param {string} tag Kind (« client », « tiers »…).
 * @param {string | number} id Id of the element.
 * @returns {string} Key.
 */
export function taggedKey(tag: string, id: string | number): string {
  return `${tag}:${id}`;
}

/**
 * Kind and id of a key made by `taggedKey` (the id may hold « : » itself).
 * @param {string | null | undefined} key Key.
 * @returns {{ tag: string, id: string } | null} Kind and id, null for none or a key without kind.
 */
export function parseTaggedKey(key: string | null | undefined): { tag: string; id: string } | null {
  const at = key ? key.indexOf(':') : -1;
  return key && at > 0 ? { tag: key.slice(0, at), id: key.slice(at + 1) } : null;
}

/**
 * Ids of the keys of one kind, in their order.
 * @param {readonly string[]} keys Keys made by `taggedKey`.
 * @param {string} tag Kind kept.
 * @returns {string[]} Ids.
 */
export function taggedIds(keys: readonly string[], tag: string): string[] {
  return keys.flatMap((key) => {
    const parsed = parseTaggedKey(key);
    return parsed?.tag === tag ? [parsed.id] : [];
  });
}
