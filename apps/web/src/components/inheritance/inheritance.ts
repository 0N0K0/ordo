import { inheritedView, type InheritSource, type InheritState } from '@ordo/shared';

/** State and source of one inherited field, as the API gives it (`inheritance { field state source sourceId }`). */
export interface FieldOriginValue {
  field: string;
  state: InheritState;
  source?: InheritSource | null;
  sourceId?: string | null;
}

/** Item of a screen that may inherit fields from its parent (a task, a routine, as the API gives them). */
export interface InheritingRow {
  parentId?: string | null;
  inheritedFields: readonly string[];
  inheritance: readonly FieldOriginValue[];
}

/** UI strings of the inheritance, the same on every screen. */
export const INHERITANCE_WORDS = {
  clear: 'Vider',
  inherit: 'Rétablir l’héritage',
  cleared: 'Vidé exprès',
  /**
   * « Hérité de #12 Écrire le devis » (or « En partie hérité de … : répétition, moments » for a group of fields).
   * @param {string} from Name of the parent.
   * @param {readonly string[]} [parts] Fields of a group inherited, when not all of them are. Optional.
   * @returns {string} Text.
   */
  inherited: (from: string, parts?: readonly string[]) => (parts?.length ? `En partie hérité de ${from} : ${parts.join(', ')}` : `Hérité de ${from}`),
} as const;

/**
 * Origin of a field of an item (inherited, own, emptied on purpose); null for an item without parent (nothing to
 * inherit: nothing shown).
 * @param {InheritingRow} item Item.
 * @param {string} field Field.
 * @returns {FieldOriginValue | null} Origin.
 */
export function originOf(item: InheritingRow, field: string): FieldOriginValue | null {
  if (!item.parentId) return null;
  // eslint-disable-next-line no-restricted-syntax -- originOf itself.
  return item.inheritance.find((origin) => origin.field === field) ?? null;
}

/**
 * Item as it goes once a change gave fields a value of its own (shown at once, before the API answers):
 * those fields leave its inherited list and are its own.
 * @param {T} item Item (of the cache).
 * @param {readonly string[]} fields Fields given a value.
 * @returns {T} Item.
 */
export function ownedFields<T extends InheritingRow>(item: T, fields: readonly string[]): T {
  if (!fields.length) return item;
  const own = new Set(fields);
  return {
    ...item,
    inheritedFields: item.inheritedFields.filter((field) => !own.has(field)),
    inheritance: item.inheritance.map((origin) => (own.has(origin.field) && origin.state === 'INHERITED' ? { ...origin, state: 'OWN' as const, source: 'OWN' as const, sourceId: null } : origin)),
  };
}

/**
 * Row of a screen as it goes: each inherited field takes its effective value (`effective` of the
 * API, through `inheritedView`), so that its cells, filters, sorts, groups and exports read what the item goes by.
 * @param {T} item Item as the API gives it.
 * @param {Partial<Record<string, readonly (keyof T)[]>>} columns Columns of each inherited field.
 * @returns {T} Row.
 */
export function inheritedRow<T extends InheritingRow & { effective: object }>(item: T, columns: Partial<Record<string, readonly (keyof T)[]>>): T {
  return inheritedView(item, item.effective as Partial<T>, columns);
}
