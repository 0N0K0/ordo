import type { KeyboardEvent, SyntheticEvent } from 'react';
import { notifyError } from '../../lib/notify';
import classes from './EditableCells.module.css';

/** Borderless field filling the cell; a border shows on hover and focus. */
export const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/** Select fields: dropdown as wide as its options. */
export const cellCombobox = { ...cellField, comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' } } as const;

/** Multi-select fields: their values as pills, on one line. */
export const cellMulti = { ...cellCombobox, classNames: { ...cellField.classNames, pillsList: classes.pills } } as const;

/**
 * Stops a click from reaching the row (which would open it).
 * @param {SyntheticEvent} event Event.
 * @returns {void}
 */
export const stopClick = (event: SyntheticEvent) => event.stopPropagation();

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
