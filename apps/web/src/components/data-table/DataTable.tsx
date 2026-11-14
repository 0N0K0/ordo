import { TableSkeleton } from '../feedback/Skeletons';
import { Paper, Stack, Table, type TableProps, type TableTrProps } from '@mantine/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useRef, useState, type ReactNode } from 'react';
import { tableWidth, type ShownColumn } from './data-table';
import { DataTableHeader } from './DataTableHeader';
import { DataViewBar, type DataViewBarProps } from './DataViewBar';
import { GroupHeaderRow, NoMatch } from './GroupHeaderRow';
import { ROW_ACTIONS_WIDTH } from './RowActions';
import { DRAG_HANDLE_WIDTH, SortableRow } from './SortableRow';
import { TableFooter } from './TableFooter';
import classes from './DataTable.module.css';
import type { DataView } from './use-data-view';

/** Cell before the columns (selection…): its header, its cell in each row, its width. */
export interface LeadingCell<R> {
  header: ReactNode;
  cell: (row: R) => ReactNode;
  width: number;
}

interface DataTableProps<R> extends Omit<TableProps, 'children'> {
  /** Saved views of the table, the current one applied to its rows (useDataView). */
  view: DataView<R>;
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
  /** Rows under the body (totals…), given the columns shown and the rows kept (a cell before them with `leading`, one after). Optional. */
  footer?: (shown: ShownColumn<R>[], rows: R[]) => ReactNode;
  /** What a group heading tells of its rows (a total…), after its count. Optional. */
  groupSummary?: (rows: R[]) => ReactNode;
  /** Tabs and toolbar of the views (search, filters, sorts, options), minus the view. Optional. */
  bar?: Omit<DataViewBarProps<R>, 'view'>;
  /** Table in a bordered paper (under its toolbar). Optional. Default = false. */
  framed?: boolean;
  /** Shown under the toolbar instead of the table when the table has no row at all. Optional. */
  empty?: ReactNode;
}

/**
 * Data table on the model of the tasks: saved views (tabs) with their search, filters, sorts, groups and columns —
 * chosen, moved (drag and drop or their menu), resized (double click: fitted to their content), sorted by a click on
 * their header (Shift + click: one more sort) —, exported as CSV or PDF.
 * @param {DataTableProps<R>} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DataTable<R>({
  view,
  getKey,
  cells,
  actions,
  actionsWidth = ROW_ACTIONS_WIDTH,
  leading,
  rowProps,
  footer,
  groupSummary,
  bar,
  framed = false,
  empty,
  className,
  style,
  ...tableProps
}: DataTableProps<R>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { shown } = view;
  // Without sort, the rows go in the order chosen by hand (dragged, when not grouped); the others after.
  const manual = view.config !== null && view.sorting.length === 0;
  const draggable = manual && !view.groupColumn;
  const rank = new Map((view.config?.manualOrder ?? []).map((key, index) => [key, index]));
  const inOrder = (rows: R[]) =>
    manual && rank.size
      ? rows
          .map((row, index) => ({ row, index, at: rank.get(getKey(row)) ?? Number.MAX_SAFE_INTEGER }))
          .sort((a, b) => a.at - b.at || a.index - b.index)
          .map((item) => item.row)
      : rows;
  const rows = inOrder(view.rows);
  const span = shown.length + 1 + (leading ? 1 : 0) + (draggable ? 1 : 0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  /**
   * Saves the order of the rows after one was dragged (those hidden by the filters keep their place after).
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const keys = rows.map(getKey);
    const moved = arrayMove(keys, keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
    const others = (view.config?.manualOrder ?? []).filter((key) => !keys.includes(key));
    view.change((current) => ({ ...current, manualOrder: [...moved, ...others] }));
  };

  /**
   * Row of the table.
   * @param {R} row Row.
   * @returns {JSX.Element} Row.
   */
  const renderRow = (row: R) => {
    const content = cells(row);
    const inside = (
      <>
        {leading && <Table.Td>{leading.cell(row)}</Table.Td>}
        {shown.map((column) => (
          <Table.Td key={column.id} className={classes.cell} data-numeric={column.numeric || undefined} ff={column.numeric ? 'monospace' : undefined}>
            {content[column.id]}
          </Table.Td>
        ))}
        <Table.Td>{actions?.(row)}</Table.Td>
      </>
    );
    return draggable ? (
      <SortableRow key={getKey(row)} id={getKey(row)} {...rowProps?.(row)}>
        {inside}
      </SortableRow>
    ) : (
      <Table.Tr key={getKey(row)} {...rowProps?.(row)}>
        {inside}
      </Table.Tr>
    );
  };

  /**
   * Folds or unfolds a group.
   * @param {string} key Group.
   * @returns {void}
   */
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const table = (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draggable ? rows.map(getKey) : []} strategy={verticalListSortingStrategy}>
          <Table
            ref={tableRef}
            {...tableProps}
            className={[classes.table, className].filter(Boolean).join(' ')}
            style={{ width: tableWidth(shown, actionsWidth + (leading?.width ?? 0) + (draggable ? DRAG_HANDLE_WIDTH : 0)), minWidth: '100%', ...(typeof style === 'object' ? style : {}) }}
          >
            <DataTableHeader
              columns={view.columns}
              shown={shown}
              layout={view.layout}
              onLayoutChange={view.setLayout}
              sorting={view.sorting}
              onSortingChange={view.setSorting}
              tableRef={tableRef}
              leading={
                (draggable || leading) && (
                  <>
                    {draggable && <Table.Th w={DRAG_HANDLE_WIDTH} />}
                    {leading && <Table.Th w={leading.width}>{leading.header}</Table.Th>}
                  </>
                )
              }
              leadingCount={(draggable ? 1 : 0) + (leading ? 1 : 0)}
              trailing={<Table.Th w={actionsWidth} />}
              columnExtras={view.columnExtras}
            />
            <Table.Tbody>
              {view.groupColumn
                ? view.groups.flatMap((group) => [
                    <GroupHeaderRow
                      key={`group:${group.key}`}
                      label={group.label}
                      count={group.rows.length}
                      summary={groupSummary?.(group.rows)}
                      span={span}
                      collapsed={collapsed.has(group.key)}
                      onToggle={() => toggle(group.key)}
                    />,
                    ...(collapsed.has(group.key) ? [] : inOrder(group.rows).map(renderRow)),
                  ])
                : rows.map(renderRow)}
            </Table.Tbody>
            {footer?.(shown, rows)}
            {view.config?.footer && (
              <TableFooter
                shown={shown}
                rows={rows}
                totals={view.config.footer}
                onChange={(totals) => view.change((current) => ({ ...current, footer: totals }))}
                before={(draggable ? 1 : 0) + (leading ? 1 : 0)}
                after={1}
              />
            )}
          </Table>
        </SortableContext>
      </DndContext>
    </div>
  );

  /**
   * Content under the toolbar: loading, empty, nothing kept, or the table.
   * @returns {ReactNode} Content.
   */
  const content = () => {
    if (!view.config) return <TableSkeleton />;
    if (empty !== undefined && view.total === 0) return empty;
    if (view.rows.length === 0) return <NoMatch view={view} />;
    return framed ? (
      <Paper withBorder radius="md">
        {table}
      </Paper>
    ) : (
      table
    );
  };

  return (
    <Stack gap="sm">
      <DataViewBar view={view} {...bar} />
      {content()}
    </Stack>
  );
}
