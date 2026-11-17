import { TableSkeleton } from '../feedback/Skeletons';
import { ActionIcon, Group, Paper, Stack, Table, type TableProps, type TableTrProps } from '@mantine/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CaretRightIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import {
  columnResizingFeature,
  columnSizingFeature,
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ColumnSizingState,
  type ExpandedState,
  type Updater,
} from '@tanstack/react-table';
import { Fragment, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { contentWidth } from '../../features/tasks/column-fit';
import { ColumnHeaderMenu, type ColumnMove } from './ColumnHeaderMenu';
import { clampWidth, columnOrder, MAX_WIDTH, MIN_WIDTH, toggleSort, withOrder, withVisibility, type ShownColumn } from './data-table';
import { DataViewBar, type DataViewBarProps } from './DataViewBar';
import { GroupHeaderRow, NoMatch } from './GroupHeaderRow';
import { ROW_ACTIONS_WIDTH } from './RowActions';
import { GroupFooter, TableFooter } from './TableFooter';
import classes from './DataTable.module.css';
import { AllRowsCheck, ROW_CHECK_WIDTH, RowCheck } from './RowCheck';
import { SelectionBar, type SelectionAction } from './SelectionBar';
import { selectedLabel } from './selection-label';
import { useTableHeight } from './table-height';
import type { RowGroup } from './table-engine';
import type { DataView } from './use-data-view';

/** Cell before the columns (selection…): its header, its cell in each row, its width. */
export interface LeadingCell<R> {
  header: ReactNode;
  cell: (row: R) => ReactNode;
  width: number;
}

/** Where a dragged row goes: before a row (null: last), under a parent (tree tables, when its level changed). */
export interface RowMove {
  key: string;
  beforeKey: string | null;
  /** New parent (null: top level); undefined: unchanged. */
  parentKey?: string | null;
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
  /** What a group heading tells of its rows (a total…), after its count. Optional. */
  groupSummary?: (rows: R[]) => ReactNode;
  /** Tabs and toolbar of the views (search, filters, sorts, options), minus the view. Optional. */
  bar?: Omit<DataViewBarProps<R>, 'view'>;
  /** Table in a bordered paper (under its toolbar). Optional. Default = false. */
  framed?: boolean;
  /** Shown under the toolbar instead of the table when the table has no row at all. Optional. */
  empty?: ReactNode;
  /** Content unfolded under a row, across the table (its details); nothing for none. Optional. */
  details?: (row: R) => ReactNode;
  /** Actions on the rows checked that the columns cannot do (archive, delete…), in a bar under the table. Optional. */
  selectionActions?: (rows: R[], clear: () => void) => SelectionAction[];
  /** Rows checked, told ("3 fiches sélectionnées"). Optional. Default = lignes. */
  selectionLabel?: (count: number) => string;
  /** Parent of a row: the rows show as a tree under their parent (a row whose parent is not shown at the top). Optional. */
  parentKey?: (row: R) => string | null;
  /**
   * Saves a row dragged by hand (its place, its level in a tree). Optional: without, the order is that of the view
   * (its manual order).
   */
  onMoveRow?: (move: RowMove) => void;
  /** Row adding one, at the end of the table (group null) and of each group. Optional. */
  addRow?: (group: RowGroup<R> | null) => ReactNode;
  /** The row is open in the side panel (highlighted). Optional. */
  isActive?: (row: R) => boolean;
  /** The row is archived (dimmed). Optional. */
  isArchived?: (row: R) => boolean;
}

/** A row of the table: a heading of a group, or a row of data (with its sub-rows). */
type Item<R> = { kind: 'group'; id: string; group: RowGroup<R>; children: Item<R>[] } | { kind: 'row'; id: string; row: R; children: Item<R>[] };

const features = tableFeatures({ columnSizingFeature, columnResizingFeature, rowExpandingFeature, expandedRowModel: createExpandedRowModel() });

/** Column of the cells before the columns (drag handle, check box, leading cell) and of the row actions. */
const LEAD_COLUMN = '__lead';
const ACTIONS_COLUMN = '__actions';
/** Drag ids of the columns (the rows have theirs). */
const COLUMN_PREFIX = 'col:';
/** Prefix of the group rows. */
const GROUP_PREFIX = 'g:';
/** Offset of one level of a tree, in px (that of the title indentation). */
const INDENT = 20;
/** Width of the drag handle (and of its room when there is none). */
const HANDLE_WIDTH = 26;

/**
 * Applies a TanStack updater (value or function) to the current value.
 * @param {Updater<T>} updater Updater.
 * @param {T} current Current value.
 * @returns {T} Next value.
 */
function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;
}

/**
 * Swallows the click fired by releasing the pointer at the end of a drag (it would sort or open a row).
 * @returns {void}
 */
function suppressClickAfterDrop(): void {
  const swallow = (event: globalThis.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
}

// Columns only meet columns (the header under the pointer: widths vary a lot), rows only meet rows.
const collisionDetection: CollisionDetection = (args) => {
  const draggingColumn = String(args.active.id).startsWith(COLUMN_PREFIX);
  const droppableContainers = args.droppableContainers.filter((container) => String(container.id).startsWith(COLUMN_PREFIX) === draggingColumn);
  return draggingColumn ? pointerWithin({ ...args, droppableContainers }) : closestCenter({ ...args, droppableContainers });
};

/** Row during a drag: its level and its parent row. */
interface DragItem {
  id: string;
  depth: number;
  parentId: string | null;
}

/**
 * Removes the rows nested under a row (they move with it).
 * @param {DragItem[]} items Rows.
 * @param {string} id Row whose descendants are removed.
 * @returns {DragItem[]} Remaining rows.
 */
function withoutDescendants(items: DragItem[], id: string): DragItem[] {
  const removed = new Set([id]);
  return items.filter((item) => {
    if (item.parentId && removed.has(item.parentId)) {
      removed.add(item.id);
      return false;
    }
    return true;
  });
}

/**
 * Where a dragged row would land, as in the sidebar tree: the place from the hovered row, the level from the
 * horizontal offset (at most one level below the row above, at least the level of the row below).
 * @param {DragItem[]} items Rows during the drag.
 * @param {string} activeId Dragged row.
 * @param {string} overId Hovered row.
 * @param {number} offsetX Horizontal drag offset in px.
 * @param {boolean} tree Levels can change.
 * @returns {{ depth: number, parentId: string | null } | null} Level and parent row, or null when invalid.
 */
function getProjection(items: DragItem[], activeId: string, overId: string, offsetX: number, tree: boolean) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
  if (!tree) return { depth: items[activeIndex].depth, parentId: items[activeIndex].parentId };
  const moved = arrayMove(items, activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const maxDepth = previous ? previous.depth + 1 : 0;
  const minDepth = Math.min(next?.depth ?? 0, maxDepth);
  const depth = Math.max(minDepth, Math.min(items[activeIndex].depth + Math.round(offsetX / INDENT), maxDepth));
  if (depth === 0) return { depth, parentId: null };
  for (let index = overIndex - 1; index >= 0; index -= 1) {
    if (moved[index].depth === depth - 1) return { depth, parentId: moved[index].id };
  }
  return null;
}

/**
 * Rows as a tree: each under its parent when its parent is shown, at the top otherwise; their order kept.
 * @param {R[]} rows Rows, in order.
 * @param {(row: R) => string} getKey Key of a row.
 * @param {((row: R) => string | null) | undefined} parentKey Parent of a row (none: flat).
 * @returns {Item<R>[]} Items.
 */
function treeOf<R>(rows: R[], getKey: (row: R) => string, parentKey: ((row: R) => string | null) | undefined): Item<R>[] {
  const items = rows.map((row): Item<R> => ({ kind: 'row', id: getKey(row), row, children: [] }));
  if (!parentKey) return items;
  const byKey = new Map(items.map((item) => [item.id, item]));
  const roots: Item<R>[] = [];
  for (const item of items) {
    const parent = parentKey((item as Extract<Item<R>, { kind: 'row' }>).row);
    const holder = parent !== null && parent !== item.id ? byKey.get(parent) : undefined;
    if (holder) holder.children.push(item);
    else roots.push(item);
  }
  return roots;
}

/**
 * Data table of Ordo, the same for every table: saved views (tabs) with their search, filters, sorts, groups and
 * columns — moved by drag and drop (or their menu), resized by their right edge (double click: fitted to their
 * content), sorted by a click on their header (Shift + click: one more sort), hidden —, exported as CSV or PDF; rows
 * as a tree (sub-rows folded or unfolded), put in order by hand by drag and drop (horizontally: their level), checked
 * for actions on several, their cells selected to edit them together; a row adding one at the end and in each group;
 * totals in its footer. It scrolls both ways in its own area, its header sticking to its top, as tall as the page
 * allows.
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
  groupSummary,
  bar,
  framed = false,
  empty,
  details,
  selectionActions,
  selectionLabel = (count) => selectedLabel(count),
  parentKey,
  onMoveRow,
  addRow,
  isActive,
  isArchived,
  className,
  style,
  ...tableProps
}: DataTableProps<R>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [heightRef, maxHeight] = useTableHeight();
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [drag, setDrag] = useState<{ activeId: string; overId: string | null; offsetX: number } | null>(null);
  // Width each column was fitted to: a second double click, the column unchanged, gives back its default width.
  const fitted = useRef(new Map<string, number>());
  const { shown, layout } = view;
  // Without sort, the rows go in the order chosen by hand; dragged when not grouped.
  const manual = view.config !== null && view.sorting.length === 0;
  const draggable = manual && !view.groupColumn;
  const tree = Boolean(parentKey);
  const rank = useMemo(() => new Map((view.config?.manualOrder ?? []).map((key, index) => [key, index])), [view.config?.manualOrder]);
  /**
   * Rows in the order chosen by hand (without sort and without own saving), else as they are.
   * @param {R[]} rows Rows.
   * @returns {R[]} Rows.
   */
  const inOrder = (rows: R[]) =>
    manual && !onMoveRow && rank.size
      ? rows
          .map((row, index) => ({ row, index, at: rank.get(getKey(row)) ?? Number.MAX_SAFE_INTEGER }))
          .sort((a, b) => a.at - b.at || a.index - b.index)
          .map((item) => item.row)
      : rows;
  // Check boxes of the rows, to act on several (a table without its own leading cell).
  const checks = leading ? null : view.rowSelection;
  const leadWidth = (draggable || tree ? HANDLE_WIDTH : 0) + (checks ? ROW_CHECK_WIDTH : 0) + (leading?.width ?? 0);
  const hasLead = leadWidth > 0;
  const before = hasLead ? 1 : 0;
  const span = shown.length + 1 + before;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const items = useMemo((): Item<R>[] => {
    if (!view.groupColumn) return treeOf(inOrder(view.rows), getKey, parentKey);
    return view.groups.map((group) => ({ kind: 'group', id: `${GROUP_PREFIX}${group.key}`, group, children: treeOf(inOrder(group.rows), getKey, parentKey) }));
    // inOrder reads the manual order (rank) and the sort: both in its deps through them.
  }, [view.rows, view.groups, view.groupColumn, getKey, parentKey, rank, manual, onMoveRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => {
    const helper = createColumnHelper<typeof features, Item<R>>();
    return helper.columns([
      ...(hasLead ? [helper.display({ id: LEAD_COLUMN, size: leadWidth, enableResizing: false, header: () => null, cell: () => null })] : []),
      ...shown.map((column) => helper.display({ id: column.id, header: column.label, size: column.width, minSize: MIN_WIDTH, maxSize: MAX_WIDTH, cell: () => null })),
      helper.display({ id: ACTIONS_COLUMN, size: actionsWidth, enableResizing: false, header: () => null, cell: () => null }),
    ]);
  }, [hasLead, leadWidth, shown, actionsWidth]);
  const columnSizing = useMemo(() => Object.fromEntries(shown.map((column) => [column.id, column.width])), [shown]);

  const table = useTable({
    features,
    columns,
    data: items,
    getRowId: (item) => item.id,
    getSubRows: (item) => item.children,
    // Rows change with every filter keystroke: keep what was folded or unfolded.
    autoResetExpanded: false,
    columnResizeMode: 'onChange',
    state: { columnSizing, expanded },
    onColumnSizingChange: (updater) => {
      const sizing = apply(updater, columnSizing as ColumnSizingState);
      view.setLayout({ ...layout, columnSizing: { ...layout.columnSizing, ...Object.fromEntries(Object.entries(sizing).map(([id, size]) => [id, clampWidth(size)])) } });
    },
    onExpandedChange: (updater) => setExpanded((current) => apply(updater, current)),
  });

  const order = columnOrder(view.columns, layout);
  const visibleRows = table.getRowModel().rows;
  const dataRows = visibleRows.filter((row) => row.original.kind === 'row');
  // While a row is dragged, its unfolded sub-rows are hidden: they move with it.
  const grouped = Boolean(view.groupColumn);
  const allDragItems: DragItem[] = dataRows.map((row) => ({
    id: row.id,
    depth: row.depth - (grouped ? 1 : 0),
    parentId: row.parentId && !row.parentId.startsWith(GROUP_PREFIX) ? row.parentId : null,
  }));
  const dragItems = drag ? withoutDescendants(allDragItems, drag.activeId) : allDragItems;
  const draggedAlong = new Set(drag ? allDragItems.filter((item) => !dragItems.includes(item)).map((item) => item.id) : []);
  const projection = drag?.overId ? getProjection(dragItems, drag.activeId, drag.overId, drag.offsetX, tree && Boolean(onMoveRow)) : null;
  const rowDrag = draggable || (tree && Boolean(onMoveRow) && manual && !grouped);

  /**
   * Moves a column to the start, the end, or by one shown column.
   * @param {string} id Column.
   * @param {ColumnMove} where Where.
   * @returns {void}
   */
  const moveColumn = (id: string, where: ColumnMove) => {
    const others = order.filter((item) => item !== id);
    const index = shown.findIndex((column) => column.id === id);
    let at: number;
    if (where === 'start') at = 0;
    else if (where === 'end') at = others.length;
    else {
      const neighbour = shown[where === 'left' ? index - 1 : index + 1].id;
      at = others.indexOf(neighbour) + (where === 'right' ? 1 : 0);
    }
    view.setLayout(withOrder(view.columns, layout, [...others.slice(0, at), id, ...others.slice(at)]));
  };

  /**
   * Fits a column to its content, or gives it back its default width when it already is.
   * @param {ShownColumn<R>} column Column.
   * @param {number} index Index among the shown columns.
   * @returns {void}
   */
  const fitColumn = (column: ShownColumn<R>, index: number) => {
    if (!tableRef.current) return;
    const width = clampWidth(contentWidth(tableRef.current, before + index) + 2);
    const { [column.id]: _dropped, ...others } = layout.columnSizing; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (fitted.current.get(column.id) === column.width || Math.abs(width - column.width) <= 2) {
      fitted.current.delete(column.id);
      view.setLayout({ ...layout, columnSizing: others });
      return;
    }
    fitted.current.set(column.id, width);
    view.setLayout({ ...layout, columnSizing: { ...others, [column.id]: width } });
  };

  /**
   * Moves a dragged column, or a dragged row with its sub-rows: vertically to choose its place, horizontally its level
   * (in a tree).
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    suppressClickAfterDrop();
    if (!over) return;
    const activeId = String(active.id);
    if (activeId.startsWith(COLUMN_PREFIX)) {
      if (active.id === over.id) return;
      const from = activeId.slice(COLUMN_PREFIX.length);
      const to = String(over.id).slice(COLUMN_PREFIX.length);
      view.setLayout(withOrder(view.columns, layout, arrayMove(order, order.indexOf(from), order.indexOf(to))));
      return;
    }
    if (!projection) return;
    const original = dragItems.find((item) => item.id === activeId)!;
    const moved = arrayMove(
      dragItems,
      dragItems.findIndex((item) => item.id === activeId),
      dragItems.findIndex((item) => item.id === over.id),
    );
    const reparented = projection.parentId !== original.parentId;
    if (!reparented && over.id === activeId) return;
    if (!onMoveRow) {
      // Saved in the view: the rows hidden by the filters keep their place after.
      const keys = moved.map((item) => item.id);
      const others = (view.config?.manualOrder ?? []).filter((key) => !keys.includes(key));
      view.change((current) => ({ ...current, manualOrder: [...keys, ...others] }));
      return;
    }
    // Placed before the row now following it; the parent only changes when the level changed (a sub-row shown alone
    // by a filter keeps its hidden parent).
    const index = moved.findIndex((item) => item.id === activeId);
    const next = moved[index + 1];
    onMoveRow({ key: activeId, beforeKey: next?.id ?? null, ...(reparented && { parentKey: projection.parentId }) });
    // The new parent opens to show its new sub-row.
    if (projection.parentId) {
      const parentRowId = projection.parentId;
      setExpanded((current) => (current === true ? current : { ...current, [parentRowId]: true }));
    }
  };

  /**
   * Row adding one, across the table.
   * @param {RowGroup<R> | null} group Group it adds to (null: the table).
   * @returns {ReactNode} Row.
   */
  const addRowOf = (group: RowGroup<R> | null) => {
    const content = addRow?.(group);
    if (!content) return null;
    return (
      <Table.Tr key={`add:${group?.key ?? ''}`} className={classes.addRow}>
        {hasLead && <Table.Td />}
        <Table.Td colSpan={shown.length + 1}>{content}</Table.Td>
      </Table.Tr>
    );
  };

  const body: ReactNode[] = [];
  let openGroup: RowGroup<R> | null = null;
  /**
   * Closes the group open: its add row and its totals.
   * @returns {void}
   */
  const closeGroup = () => {
    if (!openGroup) return;
    body.push(addRowOf(openGroup));
    if (view.config?.footer)
      body.push(<GroupFooter key={`footer:${openGroup.key}`} shown={shown} rows={openGroup.rows} totals={view.config.footer} label={openGroup.label} before={before} after={1} />);
    openGroup = null;
  };
  for (const row of visibleRows) {
    const item = row.original;
    if (item.kind === 'group') {
      closeGroup();
      body.push(
        <GroupHeaderRow
          key={row.id}
          label={item.group.label}
          count={item.group.rows.length}
          summary={groupSummary?.(item.group.rows)}
          span={span}
          collapsed={!row.getIsExpanded()}
          onToggle={row.getToggleExpandedHandler()}
        />,
      );
      if (row.getIsExpanded()) openGroup = item.group;
      continue;
    }
    if (draggedAlong.has(row.id)) continue;
    const data = item.row;
    const key = item.id;
    const content = cells(data);
    const depth = row.id === drag?.activeId && projection ? projection.depth : row.depth - (grouped ? 1 : 0);
    const own = rowProps?.(data) ?? {};
    const unfolded = details?.(data);
    body.push(
      <Fragment key={key}>
        <DataRow
          id={key}
          draggable={rowDrag}
          dropTarget={projection?.parentId === key}
          active={isActive?.(data) ?? false}
          archived={isArchived?.(data) ?? false}
          checked={checks?.isChecked(key) ?? false}
          rowProps={own}
        >
          {(handle) => (
            <>
              {hasLead && (
                <Table.Td px={4} onClick={(event) => event.stopPropagation()}>
                  <Group gap={2} wrap="nowrap">
                    {(draggable || tree) && handle}
                    {checks && <RowCheck selection={checks} rowKey={key} label={shown[0]?.text?.(data) || 'la ligne'} />}
                    {leading?.cell(data)}
                  </Group>
                </Table.Td>
              )}
              {shown.map((column, index) => {
                const first = index === 0 && tree;
                return (
                  <Table.Td
                    key={column.id}
                    className={first ? `${classes.cell} ${classes.titleCell}` : classes.cell}
                    style={first ? ({ '--row-depth': depth } as CSSProperties) : undefined}
                    data-numeric={column.numeric || undefined}
                    ff={column.numeric ? 'monospace' : undefined}
                    {...view.cellProps(column.id, key)}
                  >
                    {first ? (
                      <Group gap={4} wrap="nowrap" style={{ minWidth: 0, width: '100%' }}>
                        {row.getCanExpand() ? (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            aria-label={row.getIsExpanded() ? 'Replier les sous-éléments' : 'Déplier les sous-éléments'}
                            aria-expanded={row.getIsExpanded()}
                            onClick={(event) => {
                              event.stopPropagation();
                              row.toggleExpanded();
                            }}
                          >
                            <CaretRightIcon className={classes.chevron} data-expanded={row.getIsExpanded() || undefined} aria-hidden />
                          </ActionIcon>
                        ) : (
                          <span className={classes.chevronSpacer} />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>{content[column.id]}</div>
                      </Group>
                    ) : (
                      content[column.id]
                    )}
                  </Table.Td>
                );
              })}
              <Table.Td onClick={(event) => event.stopPropagation()}>{actions?.(data)}</Table.Td>
            </>
          )}
        </DataRow>
        {unfolded && (
          <Table.Tr className={classes.details}>
            <Table.Td colSpan={span} className={classes.detailsCell}>
              {unfolded}
            </Table.Td>
          </Table.Tr>
        )}
      </Fragment>,
    );
  }
  closeGroup();
  if (!grouped) body.push(addRowOf(null));

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const tableElement = (
    // Scrolling both ways inside its own area, its header sticking to the top of it.
    <div ref={heightRef} className={classes.scroller} style={{ maxHeight }}>
      {/* The drag context renders accessibility nodes: it wraps the table, not sits inside it. */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }: DragStartEvent) => {
          const id = String(active.id);
          if (!id.startsWith(COLUMN_PREFIX)) setDrag({ activeId: id, overId: id, offsetX: 0 });
        }}
        onDragMove={({ delta }: DragMoveEvent) => setDrag((current) => current && { ...current, offsetX: delta.x })}
        onDragOver={({ over }: DragOverEvent) => setDrag((current) => current && { ...current, overId: over ? String(over.id) : null })}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDrag(null);
          suppressClickAfterDrop();
        }}
      >
        <Table
          ref={tableRef}
          stickyHeader
          highlightOnHover
          {...tableProps}
          className={[classes.table, className].filter(Boolean).join(' ')}
          data-checking={(checks && checks.keys.some((key) => checks.isChecked(key))) || undefined}
          style={{ width: table.getTotalSize(), ...(typeof style === 'object' ? style : {}) }}
        >
          <Table.Thead className={classes.head}>
            <SortableContext items={shown.map((column) => `${COLUMN_PREFIX}${column.id}`)} strategy={horizontalListSortingStrategy}>
              <Table.Tr>
                {headers.map((header) => {
                  const id = header.column.id;
                  if (id === LEAD_COLUMN) {
                    return (
                      <Table.Th key={header.id} px={4} style={{ width: header.column.getSize() }}>
                        <Group gap={2} wrap="nowrap">
                          {(draggable || tree) && <span className={classes.handleSpacer} />}
                          {checks && <AllRowsCheck selection={checks} />}
                          {leading?.header}
                        </Group>
                      </Table.Th>
                    );
                  }
                  if (id === ACTIONS_COLUMN) return <Table.Th key={header.id} style={{ width: header.column.getSize() }} />;
                  const index = shown.findIndex((column) => column.id === id);
                  const column = shown[index];
                  const sort = view.sorting.find((item) => item.id === id);
                  const sortable = Boolean(column.sortValue);
                  return (
                    <HeaderCell key={header.id} id={id} width={header.column.getSize()} numeric={column.numeric} sort={sort}>
                      <Group gap={2} wrap="nowrap" className={classes.headerContent}>
                        {sortable ? (
                          <button type="button" className={classes.sortButton} onClick={(event) => view.setSorting(toggleSort(view.sorting, id, event.shiftKey))}>
                            <span className={classes.label}>{column.label}</span>
                            {sort && (
                              <span className={classes.sortMark}>
                                {sort.desc ? '↓' : '↑'}
                                {view.sorting.length > 1 && <sub>{view.sorting.findIndex((item) => item.id === id) + 1}</sub>}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className={classes.label}>{column.label}</span>
                        )}
                        <span className={classes.headerMenu}>
                          <ColumnHeaderMenu
                            label={column.label}
                            sort={sortable ? (sort ?? null) : undefined}
                            onSortBy={(desc) => view.setSorting(desc === null ? view.sorting.filter((item) => item.id !== id) : [{ id, desc }])}
                            {...view.columnExtras(id)}
                            onHide={column.locked ? undefined : () => view.setLayout(withVisibility(view.columns, layout, id, false))}
                            index={index}
                            count={shown.length}
                            onMove={(where) => moveColumn(id, where)}
                          />
                        </span>
                      </Group>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionner la colonne ${column.label}`}
                        className={classes.resizer}
                        data-resizing={header.column.getIsResizing() || undefined}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => fitColumn(column, index)}
                      />
                    </HeaderCell>
                  );
                })}
              </Table.Tr>
            </SortableContext>
          </Table.Thead>
          <SortableContext items={rowDrag ? dragItems.map((item) => item.id) : []} strategy={verticalListSortingStrategy}>
            <Table.Tbody>{body}</Table.Tbody>
          </SortableContext>
          {view.config?.footer && (
            <TableFooter shown={shown} rows={view.rows} totals={view.config.footer} onChange={(totals) => view.change((current) => ({ ...current, footer: totals }))} before={before} after={1} />
          )}
        </Table>
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
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        {tableElement}
      </Paper>
    ) : (
      tableElement
    );
  };

  // Rows checked, for the actions of the bar.
  const checked = checks ? view.rows.filter((row) => checks.isChecked(getKey(row))) : [];
  /**
   * Unchecks every row.
   * @returns {void}
   */
  const clear = () => checks?.check(checks.keys, false);
  return (
    <Stack gap="sm">
      <DataViewBar view={view} {...bar} />
      {content()}
      {selectionActions && checked.length > 0 && <SelectionBar label={selectionLabel(checked.length)} actions={selectionActions(checked, clear)} onClear={clear} />}
    </Stack>
  );
}

interface HeaderCellProps {
  id: string;
  width: number;
  numeric?: boolean;
  sort: { desc: boolean } | undefined;
  children: ReactNode;
}

/**
 * Header of a column, dragged to move the column.
 * @param {HeaderCellProps} props Component props.
 * @returns {JSX.Element} Header cell.
 */
function HeaderCell({ id, width, numeric, sort, children }: HeaderCellProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: `${COLUMN_PREFIX}${id}` });
  return (
    <Table.Th
      ref={setNodeRef}
      style={{ width, transform: CSS.Translate.toString(transform), transition }}
      className={classes.header}
      data-dragging={isDragging || undefined}
      data-numeric={numeric || undefined}
      aria-sort={sort ? (sort.desc ? 'descending' : 'ascending') : undefined}
      title="Glisser pour déplacer la colonne"
      {...listeners}
    >
      {children}
    </Table.Th>
  );
}

interface DataRowProps {
  id: string;
  draggable: boolean;
  /** Future parent of the dragged row. */
  dropTarget: boolean;
  active: boolean;
  archived: boolean;
  checked: boolean;
  rowProps: TableTrProps;
  /** Cells, receiving the drag handle to place in the first cell. */
  children: (handle: ReactNode) => ReactNode;
}

/**
 * Row of data, dragged by its handle when put in order by hand (with its sub-rows, to another place or level;
 * keyboard too).
 * @param {DataRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function DataRow({ id, draggable, dropTarget, active, archived, checked, rowProps, children }: DataRowProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const { className, style, ...props } = rowProps;
  const handle = draggable ? (
    <ActionIcon
      ref={setActivatorNodeRef}
      variant="subtle"
      color="gray"
      size="sm"
      className={classes.handle}
      aria-label="Déplacer la ligne (horizontalement : son niveau)"
      {...attributes}
      {...listeners}
    >
      <DotsSixVerticalIcon aria-hidden />
    </ActionIcon>
  ) : (
    <span className={classes.handleSpacer} />
  );
  return (
    <Table.Tr
      ref={setNodeRef}
      {...props}
      className={[classes.row, className].filter(Boolean).join(' ')}
      // Vertical only: the level being chosen shows through the indentation.
      style={{ ...(typeof style === 'object' ? style : {}), transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      data-active={active || undefined}
      data-archived={archived || undefined}
      data-selected={checked || undefined}
      data-dragging={isDragging || undefined}
      data-drop-target={dropTarget || undefined}
    >
      {children(handle)}
    </Table.Tr>
  );
}
