import { Table, type TableProps, type TableTrProps } from '@mantine/core';
import type { TableSort } from '@ordo/shared';
import { useRef, type ReactNode } from 'react';
import { ColumnsMenu } from './ColumnsMenu';
import { shownColumns, sortRows, tableWidth, type DataColumn, type ShownColumn } from './data-table';
import { DataTableHeader } from './DataTableHeader';
import classes from './DataTable.module.css';
import { useTableLayout } from './use-table-layout';

/** Cell before the columns (selection…): its header, its cell in each row, its width. */
export interface LeadingCell<R> {
  header: ReactNode;
  cell: (row: R) => ReactNode;
  width: number;
}

interface DataTableProps<R> extends Omit<TableProps, 'children'> {
  /** Name of the table, remembering its columns and sorts in this browser. */
  tableKey: string;
  columns: readonly DataColumn<R>[];
  rows: readonly R[];
  getKey: (row: R) => string;
  /** Content of the cells of a row, by column id. */
  cells: (row: R) => Record<string, ReactNode>;
  /** Actions at the end of a row. Optional. */
  actions?: (row: R) => ReactNode;
  /** Width of the actions column. Optional. Default = 48. */
  actionsWidth?: number;
  /** Cell before the columns. Optional. */
  leading?: LeadingCell<R>;
  /** Props of a row (click, style…). Optional. */
  rowProps?: (row: R) => TableTrProps;
  /** Sorts before any choice. Optional. */
  initialSorting?: TableSort[];
  /** Rows under the body (totals…), given the columns shown (a cell before them with `leading`, one after). Optional. */
  footer?: (shown: ShownColumn<R>[]) => ReactNode;
}

/**
 * Data table on the model of the tasks: columns chosen, moved (drag and drop or their menu), resized (double click:
 * fitted to their content) and sorted by a click on their header (Shift + click: one more sort), remembered in this
 * browser; the columns panel in the header of the actions.
 * @param {DataTableProps<R>} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DataTable<R>({ tableKey, columns, rows, getKey, cells, actions, actionsWidth = 48, leading, rowProps, initialSorting, footer, className, style, ...tableProps }: DataTableProps<R>) {
  const { layout, setLayout, sorting, setSorting } = useTableLayout(tableKey, initialSorting);
  const tableRef = useRef<HTMLTableElement>(null);
  const shown = shownColumns(columns, layout);
  const sorted = sortRows(rows, sorting, columns);
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <Table
        ref={tableRef}
        {...tableProps}
        className={[classes.table, className].filter(Boolean).join(' ')}
        style={{ width: tableWidth(shown, actionsWidth + (leading?.width ?? 0)), minWidth: '100%', ...(typeof style === 'object' ? style : {}) }}
      >
        <DataTableHeader
          columns={columns}
          shown={shown}
          layout={layout}
          onLayoutChange={setLayout}
          sorting={sorting}
          onSortingChange={setSorting}
          tableRef={tableRef}
          leading={leading && <Table.Th w={leading.width}>{leading.header}</Table.Th>}
          trailing={
            <Table.Th w={actionsWidth}>
              <ColumnsMenu columns={columns} layout={layout} onLayoutChange={setLayout} />
            </Table.Th>
          }
        />
        <Table.Tbody>
          {sorted.map((row) => {
            const content = cells(row);
            return (
              <Table.Tr key={getKey(row)} {...rowProps?.(row)}>
                {leading && <Table.Td>{leading.cell(row)}</Table.Td>}
                {shown.map((column) => (
                  <Table.Td key={column.id} className={classes.cell} data-numeric={column.numeric || undefined} ff={column.numeric ? 'monospace' : undefined}>
                    {content[column.id]}
                  </Table.Td>
                ))}
                <Table.Td>{actions?.(row)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
        {footer?.(shown)}
      </Table>
    </div>
  );
}
