import { useEffect, useRef, useState, type MouseEvent } from 'react';

/** Column of a selection of whole rows (their check boxes): every column edited in bulk. */
export const ALL_COLUMNS = '*';

/** Cells selected in one column (or whole rows checked: every column), to edit them in bulk. */
export interface BulkSelection {
  /** Column, or ALL_COLUMNS for rows checked. */
  column: string;
  /** Keys of their rows. */
  keys: string[];
}

/** Props of a cell taking part in the bulk selection. */
export interface BulkCellProps {
  'data-bulk-selected'?: true;
  onClickCapture?: (event: MouseEvent) => void;
}

/** Bulk selection of a table. */
export interface BulkSelectionState {
  /** Cells selected (among the rows shown), null for none. */
  selection: BulkSelection | null;
  setSelection: (selection: BulkSelection | null) => void;
  /** Selects every shown cell of a column. */
  selectColumn: (column: string) => void;
  /** Props of a cell: its place in the selection, and the clicks selecting it. */
  cellProps: (column: string, key: string) => BulkCellProps;
  /** Whether a row is checked. */
  isChecked: (key: string) => boolean;
  /** Checks or unchecks rows (a selection of one column gives way). */
  check: (keys: readonly string[], on: boolean) => void;
  /** Checks exactly these rows (none: unchecks all). */
  setChecked: (keys: readonly string[]) => void;
  /** Keys of the rows shown (those the check box of the header checks). */
  keys: readonly string[];
}

/**
 * Bulk selection of the cells of a table, in one column at a time: Ctrl / ⌘ + click adds or removes a cell, Shift +
 * click selects the range from the last one, a plain click out of the selection or Escape leaves it. Only the rows
 * shown stay selected.
 * @param {{ keys: readonly string[], isBulk: (column: string) => boolean }} options Keys of the rows shown (in their order), and the columns edited in bulk.
 * @returns {BulkSelectionState} Selection.
 */
export function useBulkSelection({ keys, isBulk }: { keys: readonly string[]; isBulk: (column: string) => boolean }): BulkSelectionState {
  const [picked, setSelection] = useState<BulkSelection | null>(null);
  const anchor = useRef<string | null>(null);
  const shown = new Set(keys);
  const kept = picked ? picked.keys.filter((key) => shown.has(key)) : [];
  const selection = picked && kept.length ? { column: picked.column, keys: kept } : null;
  const selecting = selection !== null;
  useEffect(() => {
    if (!selecting) return;
    /**
     * Escape leaves the selection.
     * @param {KeyboardEvent} event Key.
     * @returns {void}
     */
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelection(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting]);

  return {
    selection,
    setSelection,
    selectColumn: (column) => {
      anchor.current = keys[0] ?? null;
      setSelection(keys.length ? { column, keys: [...keys] } : null);
    },
    isChecked: (key) => selection?.column === ALL_COLUMNS && selection.keys.includes(key),
    check: (changed, on) => {
      const current = selection?.column === ALL_COLUMNS ? selection.keys : [];
      const next = on ? [...new Set([...current, ...changed])] : current.filter((key) => !changed.includes(key));
      setSelection(next.length ? { column: ALL_COLUMNS, keys: keys.filter((key) => next.includes(key)) } : null);
    },
    setChecked: (next) => setSelection(next.length ? { column: ALL_COLUMNS, keys: keys.filter((key) => next.includes(key)) } : null),
    keys,
    cellProps: (column, key) => {
      const rows = selection?.column === ALL_COLUMNS;
      const selected = Boolean(selection && (selection.column === column || (rows && isBulk(column))) && selection.keys.includes(key));
      return {
        'data-bulk-selected': selected || undefined,
        onClickCapture: (event) => {
          const modifier = event.ctrlKey || event.metaKey || event.shiftKey;
          if (!modifier || !isBulk(column)) {
            // Rows checked stay so until unchecked; a column selection gives way to a click out of it.
            if (selection && !selected && !rows) setSelection(null);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const same = selection?.column === column && !rows ? selection.keys : [];
          let next: string[];
          if (event.shiftKey && anchor.current && keys.includes(anchor.current)) {
            const [from, to] = [keys.indexOf(anchor.current), keys.indexOf(key)].sort((a, b) => a - b);
            next = [...new Set([...same, ...keys.slice(from, to + 1)])];
          } else {
            next = same.includes(key) ? same.filter((item) => item !== key) : [...same, key];
            anchor.current = key;
          }
          setSelection(next.length ? { column, keys: next } : null);
        },
      };
    },
  };
}
