import { Paper, Stack, Table, type TableProps, type TableTrProps } from '@mantine/core';
import type { TableSort } from '@ordo/shared';
import { useRef, type ReactNode } from 'react';
import { DataColumnsPanel } from './ColumnsPanel';
import { shownColumns, sortRows, tableWidth, type DataColumn, type ShownColumn } from './data-table';
import { DataTableHeader } from './DataTableHeader';
import { ROW_ACTIONS_WIDTH } from './RowActions';
import { TableOptions, TableToolbar, type ToolbarSearch } from './TableToolbar';
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
  /** Width of the actions column. Optional. Default = ROW_ACTIONS_WIDTH. */
  actionsWidth?: number;
  /** Cell before the columns. Optional. */
  leading?: LeadingCell<R>;
  /** Props of a row (click, style…). Optional. */
  rowProps?: (row: R) => TableTrProps;
  /** Sorts before any choice. Optional. */
  initialSorting?: TableSort[];
  /** Rows under the body (totals…), given the columns shown (a cell before them with `leading`, one after). Optional. */
  footer?: (shown: ShownColumn<R>[]) => ReactNode;
  /** Quick search of the toolbar. Optional. */
  search?: ToolbarSearch;
  /** Tools of the toolbar, before its options (period, filters…). Optional. */
  tools?: ReactNode;
  /** Display options and exports of the options menu. Optional. */
  displayOptions?: ReactNode;
  exports?: ReactNode;
  /** Table in a bordered paper (under its toolbar). Optional. Default = false. */
  framed?: boolean;
  /** Shown under the toolbar instead of the table, without rows. Optional. */
  empty?: ReactNode;
}

/**
 * Data table on the model of the tasks: columns chosen, moved (drag and drop or their menu), resized (double click:
 * fitted to their content) and sorted by a click on their header (Shift + click: one more sort), remembered in this
 * browser; above it, the toolbar of every table (search, tools, « Options » with the columns).
 * @param {DataTableProps<R>} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DataTable<R>({
  tableKey,
  columns,
  rows,
  getKey,
  cells,
  actions,
  actionsWidth = ROW_ACTIONS_WIDTH,
  leading,
  rowProps,
  initialSorting,
  footer,
  search,
  tools,
  displayOptions,
  exports,
  framed = false,
  empty,
  className,
  style,
  ...tableProps
}: DataTableProps<R>) {
  const { layout, setLayout, sorting, setSorting } = useTableLayout(tableKey, initialSorting);
  const tableRef = useRef<HTMLTableElement>(null);
  const shown = shownColumns(columns, layout);
  const sorted = sortRows(rows, sorting, columns);
  const table = (
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
          trailing={<Table.Th w={actionsWidth} />}
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
  return (
    <Stack gap="sm">
      <TableToolbar search={search} options={<TableOptions display={displayOptions} exports={exports} columns={<DataColumnsPanel columns={columns} layout={layout} onLayoutChange={setLayout} />} />}>
        {tools}
      </TableToolbar>
      {empty !== undefined && rows.length === 0 ? (
        empty
      ) : framed ? (
        <Paper withBorder radius="md">
          {table}
        </Paper>
      ) : (
        table
      )}
    </Stack>
  );
}
