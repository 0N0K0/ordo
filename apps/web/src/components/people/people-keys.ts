/** Kinds of people a field can hold: contributors, members of the team or household, relations (people out of it). */
export type PersonKind = 'contributor' | 'member' | 'relation';

const PREFIX: Record<PersonKind, string> = { contributor: 'c', member: 'm', relation: 'r' };
const KIND = new Map(Object.entries(PREFIX).map(([kind, prefix]) => [prefix, kind as PersonKind]));

/** People of a field, by kind. */
export type People = Partial<Record<PersonKind, string[]>>;

/**
 * Value of a person in a select mixing kinds: « c:<id> », « m:<id> », « r:<id> ».
 * @param {PersonKind} kind Kind.
 * @param {string} id Id.
 * @returns {string} Key.
 */
export const personKey = (kind: PersonKind, id: string): string => `${PREFIX[kind]}:${id}`;

/**
 * Kind and id of a select value.
 * @param {string | null | undefined} key Key.
 * @returns {{ kind: PersonKind, id: string } | null} Person, null for none or an unknown key.
 */
export function parsePersonKey(key: string | null | undefined): { kind: PersonKind; id: string } | null {
  const kind = key ? KIND.get(key.slice(0, key.indexOf(':'))) : undefined;
  return kind && key ? { kind, id: key.slice(key.indexOf(':') + 1) } : null;
}

/**
 * Values of a multi-select of people, kind by kind.
 * @param {People} people People.
 * @returns {string[]} Keys.
 */
export const peopleKeys = (people: People): string[] => (Object.keys(PREFIX) as PersonKind[]).flatMap((kind) => (people[kind] ?? []).map((id) => personKey(kind, id)));

/**
 * Ids of one kind among select values.
 * @param {readonly string[]} keys Keys.
 * @param {PersonKind} kind Kind.
 * @returns {string[]} Ids.
 */
export const idsOfKind = (keys: readonly string[], kind: PersonKind): string[] => keys.flatMap((key) => (parsePersonKey(key)?.kind === kind ? [parsePersonKey(key)!.id] : []));

/**
 * Person of a single select between members and relations (whom a line or a budget is for), as its two fields.
 * @param {string | null} key Key.
 * @returns {{ memberId: string | null, relationId: string | null }} Fields.
 */
export function memberOrRelation(key: string | null): { memberId: string | null; relationId: string | null } {
  const person = parsePersonKey(key);
  return { memberId: person?.kind === 'member' ? person.id : null, relationId: person?.kind === 'relation' ? person.id : null };
}

/**
 * Key of a member or a relation (the relation first), null without any.
 * @param {{ memberId?: string | null, relationId?: string | null }} value Fields.
 * @returns {string | null} Key.
 */
export const memberOrRelationKey = ({ memberId, relationId }: { memberId?: string | null; relationId?: string | null }): string | null =>
  relationId ? personKey('relation', relationId) : memberId ? personKey('member', memberId) : null;
