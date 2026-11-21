import type { TreeItem } from './tree';

/**
 * State of an inherited field of an item: taken from its parent (live), its own value, or emptied
 * on purpose (« aucun », even when its parent has one). Only an item with a parent inherits: a top-level item's fields
 * are always its own (empty: empty).
 */
export const INHERIT_STATES = ['INHERITED', 'OWN', 'CLEARED'] as const;
export type InheritState = (typeof INHERIT_STATES)[number];

/**
 * Where the effective value of a field comes from: the item itself, its parent (live inheritance), or, for the dates of
 * a task without any (its own nor its parent's), its milestone, its project or its first sprint.
 */
export const INHERIT_SOURCES = ['OWN', 'PARENT', 'MILESTONE', 'PROJECT', 'SPRINT'] as const;
export type InheritSource = (typeof INHERIT_SOURCES)[number];

/** Words shown after a value that is not the item's own (13b: « 12 nov. 2026 (jalon) »). */
export const INHERIT_SOURCE_LABELS: Record<Exclude<InheritSource, 'OWN'>, string> = {
  PARENT: 'parent',
  MILESTONE: 'jalon',
  PROJECT: 'projet',
  SPRINT: 'sprint',
};

/** Item that may inherit fields from its parent: the fields it inherits (stored list, `inheritedFields`). */
export interface InheritingItem extends TreeItem {
  inheritedFields: readonly string[];
}

/** State and source of one inherited field of an item. */
export interface FieldOrigin<F extends string = string> {
  field: F;
  state: InheritState;
  /** Where its value comes from (none: no value). */
  source: InheritSource | null;
  /** Item the value is taken from: its parent (PARENT), its milestone, project or sprint; none for its own value. */
  sourceId: string | null;
}

/** Columns of an item that make one inherited field (a place: its text and its point). */
export type InheritedColumns<T, F extends string> = Record<F, readonly (keyof T)[]>;

/**
 * Whether a stored value is empty (no value): null, undefined, an empty text, an empty list.
 * @param {unknown} value Value.
 * @returns {boolean} Empty.
 */
export const isEmptyValue = (value: unknown): boolean => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Whether an item takes a field from its parent: it has a parent (known) and the field is in its inherited list.
 * @param {T} item Item.
 * @param {string} field Field.
 * @param {ReadonlyMap<string, T>} byId Items by id (its parent among them).
 * @returns {boolean} Inherited.
 */
export function inheritsField<T extends InheritingItem>(item: T, field: string, byId: ReadonlyMap<string, T>): boolean {
  return marksInherited(item, field) && byId.has(item.parentId!);
}

/**
 * Whether the stored list of an item marks a field inherited, the item having a parent (its parent not looked up).
 * @param {{ parentId?: string | null, inheritedFields: readonly string[] }} item Item.
 * @param {string} field Field.
 * @returns {boolean} Inherited.
 */
export function marksInherited(item: { parentId?: string | null; inheritedFields: readonly string[] }, field: string): boolean {
  // eslint-disable-next-line no-restricted-syntax -- marksInherited itself.
  return Boolean(item.parentId) && item.inheritedFields.includes(field);
}

/**
 * Item whose own value an item goes by for a field: itself, or, while it inherits, its parent, its grand-parent… (the
 * live chain; a cycle stops at the last item met).
 * @param {T} item Item.
 * @param {string} field Field.
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @returns {T} Owner of the value.
 */
export function inheritanceOwner<T extends InheritingItem>(item: T, field: string, byId: ReadonlyMap<string, T>): T {
  return inheritanceChain(item, field, byId).at(-1)!;
}

/**
 * Items a field of an item goes through: the item, then, while it inherits, its parent, its grand-parent… up to the
 * item whose own value it goes by (cycle-safe). A change of the field on any of them changes the item's value.
 * @param {T} item Item.
 * @param {string} field Field.
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @returns {T[]} Items, the item first, the owner of the value last.
 */
export function inheritanceChain<T extends InheritingItem>(item: T, field: string, byId: ReadonlyMap<string, T>): T[] {
  const seen = new Set<string>([item.id]);
  const chain = [item];
  let owner = item;
  while (inheritsField(owner, field, byId)) {
    const parent = byId.get(owner.parentId!)!;
    if (seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.push(parent);
    owner = parent;
  }
  return chain;
}

/**
 * State of a field of an item: inherited, its own value, or emptied on purpose (an item with a parent, not inheriting
 * it, without value). A top-level item's empty field is its own (nothing to inherit).
 * @param {T} item Item.
 * @param {string} field Field.
 * @param {boolean} empty Its own value is empty.
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @returns {InheritState} State.
 */
export function inheritState<T extends InheritingItem>(item: T, field: string, empty: boolean, byId: ReadonlyMap<string, T>): InheritState {
  if (inheritsField(item, field, byId)) return 'INHERITED';
  return empty && item.parentId && byId.has(item.parentId) ? 'CLEARED' : 'OWN';
}

/** An item as it goes, each inherited field taken from its owner, with the origin of each field. */
export interface ResolvedInheritance<T, F extends string> {
  /** Copy of the item, the columns of each inherited field those of the item it inherits them from. */
  effective: T;
  origins: FieldOrigin<F>[];
}

/**
 * Effective fields of an item: each inherited field from its parent, live, up the chain (cycle-safe);
 * its own value otherwise. The only computation of the inheritance of the tasks and routines (`effectiveTask`,
 * `effectiveRoutine`), for the API and the app.
 * @param {T} item Item.
 * @param {ReadonlyMap<string, T>} byId Items by id (its ancestors among them).
 * @param {InheritedColumns<T, F>} columns Columns of each inherited field.
 * @returns {ResolvedInheritance<T, F>} Item as it goes, and the origin of each field.
 */
export function resolveInheritance<T extends InheritingItem, F extends string>(item: T, byId: ReadonlyMap<string, T>, columns: InheritedColumns<T, F>): ResolvedInheritance<T, F> {
  const effective = { ...item };
  const origins: FieldOrigin<F>[] = [];
  for (const field of Object.keys(columns) as F[]) {
    const keys = columns[field];
    const owner = inheritanceOwner(item, field, byId);
    for (const key of keys) effective[key] = owner[key];
    const empty = (of: T) => keys.every((key) => isEmptyValue(of[key]));
    const state = inheritState(item, field, empty(item), byId);
    const source: InheritSource | null = empty(owner) ? null : state === 'INHERITED' ? 'PARENT' : 'OWN';
    origins.push({ field, state, source, sourceId: state === 'INHERITED' ? item.parentId! : null });
  }
  return { effective, origins };
}

/**
 * Inherited list of an item once changed: fields set to inherit added, those given an own value or
 * emptied on purpose removed, unknown fields dropped; a top-level item inherits nothing.
 * @param {readonly string[]} current Fields it inherits now.
 * @param {{ inherit?: readonly F[] | null, own?: readonly F[] | null, hasParent: boolean, fields: readonly F[] }} change Fields to inherit, fields given an own value (or cleared), whether it has a parent, the inheritable fields.
 * @returns {F[]} Inherited fields, in the order of `fields`.
 */
export function changedInheritance<F extends string>(
  current: readonly string[],
  change: { inherit?: readonly F[] | null; own?: readonly F[] | null; hasParent: boolean; fields: readonly F[] },
): F[] {
  if (!change.hasParent) return [];
  const inherit = new Set<string>(change.inherit ?? []);
  const own = new Set<string>(change.own ?? []);
  return change.fields.filter((field) => inherit.has(field) || (current.includes(field) && !own.has(field)));
}

/**
 * Fields of an item without any value of its own (each of their columns empty): those it inherits automatically when
 * it is placed under a parent after the fact, as at its creation; its own values stay.
 * @param {T} item Item (its own values).
 * @param {Partial<InheritedColumns<T, F>>} columns Columns of each field considered.
 * @returns {F[]} Empty fields, in the order of `columns`.
 */
export function emptyInheritedFields<T, F extends string>(item: T, columns: Partial<InheritedColumns<T, F>>): F[] {
  return (Object.keys(columns) as F[]).filter((field) => columns[field]!.every((key) => isEmptyValue(item[key])));
}

/**
 * Copy of an item as it goes, for a screen: each field it inherits takes the columns of its effective
 * values (`effective`, as the API gives them); its own fields stay. The screens read this copy for their cells,
 * filters, sorts, groups and exports, and `inheritance` to grey what is inherited.
 * @param {T} item Item, with its stored list.
 * @param {Partial<T>} effective Its effective values (only the columns present are taken).
 * @param {Partial<Record<string, readonly (keyof T)[]>>} columns Columns of each inherited field.
 * @returns {T} Item as it goes.
 */
export function inheritedView<T extends { parentId?: string | null; inheritedFields: readonly string[] }>(item: T, effective: Partial<T>, columns: Partial<Record<string, readonly (keyof T)[]>>): T {
  const view = { ...item };
  for (const [field, keys] of Object.entries(columns)) {
    if (!keys || !marksInherited(item, field)) continue;
    for (const key of keys) if (key in effective) view[key] = effective[key] as T[keyof T];
  }
  return view;
}

/**
 * Inherited fields a partial input gives an own value: one of its keys given (null included); an empty
 * list of ids added or removed (`add…`, `remove…`) changes nothing.
 * @param {object} input Input of an item (or of several).
 * @param {Record<F, readonly string[]>} keys Keys of the input giving each field a value.
 * @returns {F[]} Fields.
 */
export function inheritedFieldsGiven<F extends string>(input: object, keys: Record<F, readonly string[]>): F[] {
  const given = input as Record<string, unknown>;
  const changes = (key: string) => given[key] !== undefined && !(/^(add|remove)/.test(key) && (given[key] === null || (Array.isArray(given[key]) && !given[key].length)));
  return (Object.keys(keys) as F[]).filter((field) => keys[field].some(changes));
}
