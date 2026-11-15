import { useEffect, useRef, useState, type MouseEvent } from 'react';

/** Cells selected in one column, to edit them in bulk. */
export interface BulkSelection {
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
    cellProps: (column, key) => {
      const selected = selection?.column === column && selection.keys.includes(key);
      return {
        'data-bulk-selected': selected || undefined,
        onClickCapture: (event) => {
          const modifier = event.ctrlKey || event.metaKey || event.shiftKey;
          if (!modifier || !isBulk(column)) {
            if (selection && !selected) setSelection(null);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const same = selection?.column === column ? selection.keys : [];
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
