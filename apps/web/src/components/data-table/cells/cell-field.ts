import type { KeyboardEvent, SyntheticEvent } from 'react';
import { notifyError } from '../../../lib/notify';
import classes from './EditableCells.module.css';

/** Borderless field filling the cell; a border shows on hover and focus. */
export const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/** Select fields: dropdown as wide as its options. */
export const cellCombobox = { ...cellField, comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' } } as const;

/**
 * Stops a click from reaching the row (which would open it).
 * @param {SyntheticEvent} event Event.
 * @returns {void}
 */
export const stopClick = (event: SyntheticEvent) => event.stopPropagation();

/** Borderless field of a row that opens on a click: its click kept from the row. */
// eslint-disable-next-line no-restricted-syntax -- stoppedCellField itself.
export const stoppedCellField = { ...cellField, onClick: stopClick } as const;

/** Select field of a row that opens on a click: its click kept from the row. */
// eslint-disable-next-line no-restricted-syntax -- stoppedCellCombobox itself.
export const stoppedCellCombobox = { ...cellCombobox, onClick: stopClick } as const;

/**
 * Props of a picker in a cell (a parent, a link): borderless, « — » when empty, cleared unless read only, its click kept
 * from the row, its dropdown above the table.
 * @param {boolean} readOnly Shown only.
 * @returns {object} Select props.
 */
export const cellPicker = (readOnly: boolean) =>
  ({
    variant: 'unstyled',
    size: 'xs',
    placeholder: readOnly ? undefined : '—',
    readOnly,
    clearable: !readOnly,
    onClick: stopClick,
    comboboxProps: { withinPortal: true },
  }) as const;

/**
 * Keys of a typed cell: Enter saves (by leaving the field), Escape gives up the draft.
 * @param {KeyboardEvent<HTMLInputElement>} event Key event.
 * @param {() => void} cancel Gives up the draft.
 * @returns {void}
 */
export function cellKeys(event: KeyboardEvent<HTMLInputElement>, cancel: () => void): void {
  if (event.key === 'Enter') event.currentTarget.blur();
  if (event.key === 'Escape') {
    cancel();
    event.currentTarget.blur();
  }
}

/** Rule of a field (a zod schema of `@ordo/shared`): its value checked and normalized. */
export interface CellSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: readonly { message: string }[] } };
}

/**
 * Checks a value before it is saved: an error stops the save (and is told), nothing lets it through.
 * @param {string | null | undefined} error Error, if any.
 * @returns {boolean} The value can be saved.
 */
export function accepted(error: string | null | undefined): boolean {
  if (!error) return true;
  notifyError(`${error} Rien n’a été modifié.`);
  return false;
}

/**
 * Value checked by the rule of its field: its normalized value, or nothing when refused (the error is told).
 * @param {CellSchema<T>} schema Rule.
 * @param {unknown} value Value typed.
 * @param {string} fallback Message when the rule gives none.
 * @returns {{ value: T } | null} Value, or null when refused.
 */
export function checked<T>(schema: CellSchema<T>, value: unknown, fallback: string): { value: T } | null {
  const result = schema.safeParse(value);
  if (result.success) return { value: result.data };
  accepted(result.error.issues[0]?.message ?? fallback);
  return null;
}

/**
 * Accessible label of a cell field, the same in every table: « Statut de la tâche #12 », or, on a selection,
 * « Statut (appliqué aux 3 cellules sélectionnées) ».
 * @param {string} field Field name.
 * @param {string} of Its item (« de la tâche #12 », « de Ménage »).
 * @param {number} count Number of rows the edit applies to.
 * @returns {string} Label.
 */
export function cellLabel(field: string, of: string, count: number): string {
  return count > 1 ? `${field} (appliqué aux ${count} cellules sélectionnées)` : `${field} ${of}`;
}

/**
 * Accessible label of a cell field of a named item, the same for tasks and routines: « Statut de la tâche #12 »,
 * « Lieu de « Ménage » » (see cellLabel).
 * @param {string} field Field name.
 * @param {string} item Item, named: « la tâche #12 », « « Ménage » ».
 * @param {number} count Number of rows the edit applies to.
 * @returns {string} Label.
 */
export function itemCellLabel(field: string, item: string, count: number): string {
  return cellLabel(field, `de ${item}`, count);
}
