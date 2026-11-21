import { isEmptyValue } from '@ordo/shared';
import type { InheritedFieldState } from './InheritedField';

/** What `formInheritance` reads of a form of a sub-item (a new one, or the panel of a routine saved as a whole). */
export interface FormInheritanceOptions<V, F extends string> {
  /** Values of the form now. */
  values: V;
  /** Keys of the form making each inherited field shown (the fields of the form only). */
  columns: Partial<Record<F, readonly (keyof V & string)[]>>;
  /** Values its parent goes by, as the form holds them; null: no parent (nothing inherited). */
  parent: Partial<V> | null;
  /** Fields marked inherited (stored list, or the list of the new item). */
  list: readonly F[];
  /** Puts values and the inherited list in the form together (a single change, saved together). */
  apply: (patch: Partial<V>, list: F[]) => void;
  /** Fields that cannot be emptied (« Vider » not offered). Optional. */
  required?: readonly F[];
}

/** Inheritance of the fields of a form: what each shows, the list to send, a new parent taken. */
export interface FormInheritance<V, F extends string> {
  /** State and actions of a field (`InheritedField`). */
  field: (field: F) => InheritedFieldState;
  /** State and actions of a group of fields edited together (the « quand » of a routine), naming those inherited when not all are. */
  group: (fields: readonly F[], labels: Record<F, string>) => InheritedFieldState;
  /** Fields still inherited with these values (a field given another value than its parent's is its own): sent to the API. */
  inheritedFields: (values: V) => F[];
  /**
   * A new parent chosen: the fields given (default: every field) inherit from it, its values shown; none: nothing
   * inherited, the values stay.
   */
  adopt: (parent: Partial<V> | null, fields?: readonly F[]) => void;
}

/**
 * Same value, compared as JSON (lists, objects).
 * @param {unknown} a Value.
 * @param {unknown} b Value.
 * @returns {boolean} Same.
 */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Empty value of a form key, of the same kind as its value now (a list, a text, else null).
 * @param {unknown} value Value now.
 * @returns {unknown} Empty value.
 */
const emptyOf = (value: unknown) => (Array.isArray(value) ? [] : typeof value === 'string' ? '' : null);

/**
 * Inheritance of the fields of a form of a sub-item, one rule for every form: a field is inherited
 * while it is listed and holds its parent's values (shown greyed, « Hérité de … »); typing or choosing another value
 * makes it own; « Vider » empties it on purpose, « Rétablir l'héritage » takes its parent's values again. The list sent
 * is `inheritedFields(values)`.
 * @param {FormInheritanceOptions<V, F>} options Values, keys of each field, parent's values, list, how to change them.
 * @returns {FormInheritance<V, F>} Inheritance of the form.
 */
export function formInheritance<V extends Record<string, unknown>, F extends string>({ values, columns, parent, list, apply, required = [] }: FormInheritanceOptions<V, F>): FormInheritance<V, F> {
  const fields = Object.keys(columns) as F[];
  const keysOf = (field: F) => columns[field] ?? [];
  const holdsParent = (field: F, of: V) => parent !== null && keysOf(field).every((key) => same(of[key], parent[key]));
  const inherits = (field: F, of: V) => list.includes(field) && holdsParent(field, of);
  const parentPatch = (picked: readonly F[]) => Object.fromEntries(picked.flatMap((field) => keysOf(field).map((key) => [key, parent?.[key] ?? emptyOf(values[key])]))) as Partial<V>;
  const without = (removed: readonly F[]) => fields.filter((field) => list.includes(field) && !removed.includes(field));
  /**
   * State of a field.
   * @param {F} field Field.
   * @returns {'INHERITED' | 'OWN' | 'CLEARED'} State.
   */
  const stateOf = (field: F) => (inherits(field, values) ? 'INHERITED' : keysOf(field).every((key) => isEmptyValue(values[key])) ? 'CLEARED' : 'OWN');
  const inherit = (picked: readonly F[]) => apply(parentPatch(picked), fields.filter((field) => picked.includes(field) || inherits(field, values)));
  return {
    field: (field) =>
      parent === null
        ? { origin: null }
        : {
            origin: { state: stateOf(field) },
            onClear: required.includes(field) ? undefined : () => apply(Object.fromEntries(keysOf(field).map((key) => [key, emptyOf(values[key])])) as Partial<V>, without([field])),
            onInherit: () => inherit([field]),
          },
    group: (picked, labels) => {
      if (parent === null) return { origin: null };
      const inherited = picked.filter((field) => stateOf(field) === 'INHERITED');
      const all = inherited.length === picked.length;
      return {
        origin: { state: inherited.length ? 'INHERITED' : 'OWN' },
        parts: all ? undefined : inherited.map((field) => labels[field]),
        onInherit: all ? undefined : () => inherit(picked),
      };
    },
    inheritedFields: (of) => fields.filter((field) => inherits(field, of)),
    adopt: (next, picked = fields) => {
      if (!next) return apply({}, []);
      const patch = Object.fromEntries(picked.flatMap((field) => keysOf(field).map((key) => [key, next[key] ?? emptyOf(values[key])]))) as Partial<V>;
      apply(patch, fields.filter((field) => picked.includes(field)));
    },
  };
}
