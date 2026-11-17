import { downloadCsv, postTablePdf } from '../../lib/download';
import type { ShownColumn } from './data-table';
import type { RowGroup } from './table-engine';

/** Rows of a table as exported: its groups (or all its rows in one), in their order. */
export interface TableExport<R> {
  title: string;
  /** What is exported (view, date…). */
  subtitle: string;
  /** Columns shown, in their order; those without text are left out. */
  columns: readonly ShownColumn<R>[];
  groups: readonly RowGroup<R>[];
  /** Grouped by a column (else one group of every row, without heading). */
  grouped: boolean;
}

/**
 * Exported columns: the shown ones with a text.
 * @param {TableExport<R>} table Table.
 * @returns {ShownColumn<R>[]} Columns.
 */
const exportedColumns = <R>(table: TableExport<R>) => table.columns.filter((column) => column.text);

/**
 * Downloads a table as CSV, for spreadsheets set in French: semicolons, UTF-8 with BOM, one line per row (with its
 * group when grouped).
 * @param {TableExport<R>} table Table.
 * @returns {void}
 */
export function downloadTableCsv<R>(table: TableExport<R>): void {
  const columns = exportedColumns(table);
  const header = [...(table.grouped ? ['Groupe'] : []), ...columns.map((column) => column.label)];
  const lines = table.groups.flatMap((group) => group.rows.map((row) => [...(table.grouped ? [group.label] : []), ...columns.map((column) => column.text!(row))]));
  downloadCsv([header, ...lines], table.title);
}

/**
 * Downloads a table as PDF (built by the API): its group headings, its rows, the amounts aligned to the right.
 * @param {TableExport<R>} table Table.
 * @returns {Promise<void>}
 */
export async function downloadTablePdf<R>(table: TableExport<R>): Promise<void> {
  const columns = exportedColumns(table);
  const rows = table.groups.flatMap((group) => [
    ...(table.grouped ? [{ kind: 'group' as const, depth: 0, cells: [`${group.label} (${group.rows.length})`] }] : []),
    ...group.rows.map((row) => ({ kind: 'row' as const, depth: 0, cells: columns.map((column) => column.text!(row)) })),
  ]);
  await postTablePdf({ title: table.title, subtitle: table.subtitle, columns: columns.map((column) => column.label), rows, align: columns.map((column) => (column.numeric ? 'right' : 'left')) });
}
