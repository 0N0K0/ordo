import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react';
import { notifyError } from '../../../lib/notify';
import classes from './EditableCells.module.css';

/** Borderless field filling the cell; a border shows on hover and focus. */
export const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/**
 * Justification of a row of elements in a cell (a `Group`: a count and its icon, a badge and its button): as the cells
 * of its column are aligned (DataTable.module.css), at the start out of a table.
 */
export const CELL_JUSTIFY = 'var(--cell-justify, flex-start)';

/**
 * Text alignment of a value or a field in a cell: as the cells of its column are aligned (DataTable.module.css), else
 * `fallback` out of a table.
 * @param {'left' | 'right'} fallback Alignment out of a table (a number field: right).
 * @returns {{ textAlign: CSSProperties['textAlign'] }} Style.
 */
// eslint-disable-next-line no-restricted-syntax -- the one place a cell's text takes its column's alignment.
export const cellTextAlign = (fallback: 'left' | 'right'): { textAlign: CSSProperties['textAlign'] } => ({ textAlign: `var(--cell-text-align, ${fallback})` as CSSProperties['textAlign'] });

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
    // The border of the other cells on hover and focus; its click kept from the row.
    ...stoppedCellField,
    placeholder: readOnly ? undefined : '—',
    readOnly,
    clearable: !readOnly,
    comboboxProps: { withinPortal: true },
  }) as const;

/** Draft of a typed cell (see useCellDraft). */
export interface CellDraft<T> {
  /** Value being typed; null: none (the saved value shows). */
  draft: T | null;
  setDraft: (draft: T | null) => void;
  /** Takes the draft to save it when leaving the field: null when none, or given up by Escape. */
  take: () => T | null;
  /** Keys: Enter saves (by leaving the field), Escape gives up the draft and leaves the field without saving. */
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Draft of a typed field, saved when leaving the field. The draft is also kept in a ref, set at once: the blur that
 * Enter or Escape triggers, and a value the field gives on its blur (a number clamped to its bounds), are read before
 * the next render. A field that goes away while typed (its popover or its panel closed) has no blur: `onGone` saves it.
 * @param {(draft: T) => void} [onGone] Save of the draft when the field goes away while typed. Optional.
 * @returns {CellDraft<T>} Draft, its setter, its taker for the blur and the key handler.
 */
export function useCellDraft<T>(onGone?: (draft: T) => void): CellDraft<T> {
  const [draft, setShown] = useState<T | null>(null);
  const pending = useRef<T | null>(null);
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });
  useEffect(
    () => () => {
      if (pending.current !== null) gone.current?.(pending.current);
    },
    [],
  );

  /**
   * Sets the draft (null: none).
   * @param {T | null} next Draft.
   * @returns {void}
   */
  const setDraft = useCallback((next: T | null) => {
    pending.current = next;
    setShown(next);
  }, []);

  /**
   * Takes the draft (and clears it), unless Escape gave it up.
   * @returns {T | null} Draft to save, or null.
   */
  const take = () => {
    const given = pending.current;
    setDraft(null);
    return given;
  };

  /**
   * Enter leaves the field (which saves); Escape gives up the draft, then leaves the field.
   * @param {KeyboardEvent<HTMLInputElement>} event Key event.
   * @returns {void}
   */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  return { draft, setDraft, take, onKeyDown };
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
