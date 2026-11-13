import { useLocalStorage } from '@mantine/hooks';
import { columnLayoutSchema, tableSortSchema, type ColumnLayout, type TableSort } from '@ordo/shared';
import { z } from 'zod';

const storedSchema = z.object({ layout: columnLayoutSchema.default({ columnOrder: [], hiddenColumns: [], columnSizing: {} }), sorting: z.array(tableSortSchema).default([]) });

/** Columns and sorts of a table, and their change. */
export interface TableLayoutState {
  layout: ColumnLayout;
  setLayout: (layout: ColumnLayout) => void;
  sorting: TableSort[];
  setSorting: (sorting: TableSort[]) => void;
}

/**
 * Columns (order, hidden, widths) and sorts of a table without saved views, remembered in this browser.
 * @param {string} key Name of the table.
 * @param {TableSort[]} [initialSorting] Sorts before any choice. Optional.
 * @returns {TableLayoutState} State.
 */
export function useTableLayout(key: string, initialSorting: TableSort[] = []): TableLayoutState {
  const [stored, setStored] = useLocalStorage<unknown>({ key: `ordo.table.${key}`, defaultValue: { sorting: initialSorting }, getInitialValueInEffect: false });
  const parsed = storedSchema.safeParse(stored);
  const state = parsed.success ? parsed.data : storedSchema.parse({ sorting: initialSorting });
  return {
    layout: state.layout as ColumnLayout,
    setLayout: (layout: ColumnLayout) => setStored({ ...state, layout }),
    sorting: state.sorting as TableSort[],
    setSorting: (sorting: TableSort[]) => setStored({ ...state, sorting }),
  };
}
