import { fittedLayout, movedColumnOrder } from './column-fit';
import { dropProjection, withoutDescendants } from '../../tree/tree-dnd';
import { TableSkeleton } from '../../feedback/Skeletons';
import { Group, Paper, Stack, Table, type TableProps, type TableTrProps } from '@mantine/core';
import { closestCenter, DndContext, pointerWithin, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
import { memo, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { ColumnHeaderMenu, type ColumnMove } from '../toolbar/ColumnHeaderMenu';
import { clampWidth, columnOrder, MAX_WIDTH, MIN_WIDTH, toggleSort, withOrder, withVisibility, type ShownColumn, type TreeGroup } from './data-table';
import { columnFilter, LAST_RANK, NO_VALUE_LABEL } from './table-engine';
import { DataViewBar, type DataViewBarProps } from '../toolbar/DataViewBar';
import { GroupHeaderRow } from './GroupHeaderRow';
import { NoMatch } from './NoMatch';
import { ROW_ACTIONS_WIDTH } from '../cells/RowActions';
import { GroupFooter, TableFooter } from './TableFooter';
import classes from './DataTable.module.css';
import { AllRowsCheck, ROW_CHECK_WIDTH, RowCheck } from './RowCheck';
import { SelectionBar, type SelectionAction } from '../selection/SelectionBar';
import { selectedLabel } from '../selection/selection-label';
import { useTableHeight } from './table-height';
import { BulkTableContext } from '../selection/bulk-edit';
import type { RowGroup } from './table-engine';
import type { DataView } from '../views/use-data-view';
import { suppressClickAfterDrop, useDragSensors } from '../../dnd/drag';
import { DragHandle } from '../../dnd/DragHandle';
import { FoldButton } from '../../actions/FoldButton';
import { taggedKey } from '../../../lib/tagged-key';

/** Cell before the columns (selection…): its header, its cell in each row, its width. */
interface LeadingCell<R> {
  header: ReactNode;
  cell: (row: R) => ReactNode;
  width: number;
  /** Its id in the bulk selection: its cells selected and edited together (a toggle). Optional. */
  id?: string;
}

/** Where a dragged row goes: before a row (null: last), under a parent (tree tables, when its level changed). */
export interface RowMove {
  key: string;
  beforeKey: string | null;
  /** New parent (null: top level); undefined: unchanged. */
  parentKey?: string | null;
  /** Group it was dropped in (the key of its value, '' the one without), when it changed; undefined: the same. */
  groupKey?: string;
  /** Group it was dragged from, when it changed group. */
  fromGroupKey?: string;
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
  /** The row is done, closed or left out (dimmed, as an archived one). Optional. */
  isDone?: (row: R) => boolean;
  /** The row is struck through (its label: a done routine, a cancelled task). Optional. */
  isStruck?: (row: R) => boolean;
  /** The row is read only (shown among the others: no drag, no check, no cell selection). Optional. */
  readOnly?: (row: R) => boolean;
  /** Rows still loading: a skeleton in place of the table. Optional. Default = false. */
  loading?: boolean;
  /** Tabs of the views and toolbar shown (none in a form: a list to tick…). Optional. Default = true. */
  toolbar?: boolean;
  /** Height of its scrolling area at most, in place of the room of the page (a table in a form). Optional. */
  maxHeight?: number | string;
}

/** Props given to each row of the body: its index and its measure (the rows shown are those in view). */
interface RowAttrs {
  'data-index': number;
  ref: (element: HTMLTableRowElement | null) => void;
}

/** A row of the body, rendered with its measure. */
interface Entry {
  key: string;
  render: (attrs: RowAttrs) => ReactNode;
}

/**
 * Rows from which only those in view (and many around) are rendered: below, every row is drawn once and scrolling does
 * nothing (rows full of editors drawn while scrolling would make it jerky). Not lower: a virtual table still draws the
 * rows in view and 40 on each side, about 110 rows.
 */
const VIRTUAL_FROM = 150;
/** Height of a row before it is measured. */
const ROW_ESTIMATE = 37;

/** A row of the table: a heading of a group, or a row of data (with its sub-rows). */
type Item<R> =
  | { kind: 'group'; id: string; level: number; color: string | null; group: RowGroup<R>; own: R[]; children: Item<R>[] }
  | { kind: 'row'; id: string; key: string; level: number; row: R; children: Item<R>[] };

/** Tree of groups the rows are put in when the view groups them by a column with a `groupTree`. */
interface GroupTree<R> {
  groups: readonly TreeGroup[];
  /** Groups of a row (several: shown in each; none: the group without, last). */
  groupOf: (row: R) => readonly string[];
  /** Name of the group without. */
  noneLabel: string;
}

/** Key of the group without. */
const NO_GROUP = '';
/** Between the group and the key of a row in the id of its row (a row may be in several groups). */
const ROW_SEPARATOR = '\u0000';

const features = tableFeatures({ columnSizingFeature, columnResizingFeature, rowExpandingFeature, expandedRowModel: createExpandedRowModel() });

/** Column of the cells before the columns (drag handle, check box, leading cell) and of the row actions. */
const LEAD_COLUMN = '__lead';
/** Column of the cell of its own a table puts before its columns. */
const LEADING_COLUMN = '__leading';
const ACTIONS_COLUMN = '__actions';
/** Drag ids of the columns (the rows have theirs). */
const COLUMN_PREFIX = 'col:';
/** Prefix of the group rows. */
const GROUP_PREFIX = 'g:';
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
  if (!tree) {
    const active = items.find((item) => item.id === activeId);
    return active && items.some((item) => item.id === overId) ? { depth: active.depth, parentId: active.parentId } : null;
  }
  return dropProjection(items, activeId, overId, offsetX, (_, previous, next) => {
    const max = previous ? previous.depth + 1 : 0;
    return { min: Math.min(next?.depth ?? 0, max), max };
  });
}

/**
 * Rows as a tree: each under its parent when its parent is shown, at the top otherwise; their order kept.
 * @param {R[]} rows Rows, in order.
 * @param {(row: R) => string} getKey Key of a row.
 * @param {((row: R) => string | null) | undefined} parentKey Parent of a row (none: flat).
 * @param {number} [level] Groups it is in. Optional. Default = 0.
 * @param {string} [prefix] Start of the ids of its rows (a row in several groups has an id in each). Optional. Default = ''.
 * @returns {Item<R>[]} Items.
 */
function treeOf<R>(rows: R[], getKey: (row: R) => string, parentKey: ((row: R) => string | null) | undefined, level = 0, prefix = ''): Item<R>[] {
  const items = rows.map((row): Extract<Item<R>, { kind: 'row' }> => ({ kind: 'row', id: `${prefix}${getKey(row)}`, key: getKey(row), level, row, children: [] }));
  if (!parentKey) return items;
  const byKey = new Map(items.map((item) => [item.key, item]));
  const roots: Item<R>[] = [];
  for (const item of items) {
    const parent = parentKey(item.row);
    const holder = parent !== null && parent !== item.key ? byKey.get(parent) : undefined;
    if (holder) holder.children.push(item);
    else roots.push(item);
  }
  return roots;
}

/**
 * Rows in a tree of groups: each group with its own rows (as a tree) then its sub-groups, the group without last; the
 * groups without rows always left out (also while a row is dragged: a row is dropped on a group that has some).
 * @param {R[]} rows Rows, in order.
 * @param {GroupTree<R>} tree Groups.
 * @param {(row: R) => string} getKey Key of a row.
 * @param {((row: R) => string | null) | undefined} parentKey Parent of a row (none: flat).
 * @returns {Item<R>[]} Items.
 */
function groupTreeOf<R>(rows: R[], tree: GroupTree<R>, getKey: (row: R) => string, parentKey: ((row: R) => string | null) | undefined): Item<R>[] {
  const known = new Set(tree.groups.map((group) => group.key));
  const byGroup = new Map<string, R[]>();
  for (const row of rows) {
    const keys = tree.groupOf(row).filter((key) => known.has(key));
    for (const at of keys.length ? keys : [NO_GROUP]) byGroup.set(at, [...(byGroup.get(at) ?? []), row]);
  }
  const children = new Map<string | null, TreeGroup[]>();
  for (const group of tree.groups) {
    const parent = group.parentKey !== null && known.has(group.parentKey) ? group.parentKey : null;
    children.set(parent, [...(children.get(parent) ?? []), group]);
  }
  /**
   * Item of a group, with its rows and sub-groups; null when empty (and not shown).
   * @param {TreeGroup} group Group.
   * @param {number} level Its depth.
   * @returns {Item<R> | null} Item.
   */
  const make = (group: TreeGroup, level: number): Item<R> | null => {
    const own = byGroup.get(group.key) ?? [];
    const subs = (children.get(group.key) ?? []).flatMap((child) => make(child, level + 1) ?? []);
    const all = [...own, ...subs.flatMap((sub) => (sub.kind === 'group' ? sub.group.rows : []))];
    if (!all.length) return null;
    return {
      kind: 'group',
      id: `${GROUP_PREFIX}${group.key}`,
      level,
      color: group.color ?? null,
      own,
      group: { key: group.key, label: group.label, rows: all },
      children: [...treeOf(own, getKey, parentKey, level + 1, `${group.key}${ROW_SEPARATOR}`), ...subs],
    };
  };
  const roots = (children.get(null) ?? []).flatMap((group) => make(group, 0) ?? []);
  const none = byGroup.get(NO_GROUP) ?? [];
  if (none.length) {
    roots.push({
      kind: 'group',
      id: `${GROUP_PREFIX}${NO_GROUP}`,
      level: 0,
      color: null,
      own: none,
      group: { key: NO_GROUP, label: tree.noneLabel, rows: none },
      children: treeOf(none, getKey, parentKey, 1, `${NO_GROUP}${ROW_SEPARATOR}`),
    });
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
  isDone,
  isStruck,
  readOnly,
  loading = false,
  toolbar = true,
  maxHeight: ownHeight,
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
  // A tree unless shown flat (an option of the view).
  const tree = Boolean(parentKey) && !view.config?.flat;
  const treeKey = tree ? parentKey : undefined;
  const rank = useMemo(() => new Map((view.config?.manualOrder ?? []).map((key, index) => [key, index])), [view.config?.manualOrder]);
  /**
   * Rows in the order chosen by hand (without sort and without own saving), else as they are.
   * @param {R[]} rows Rows.
   * @returns {R[]} Rows.
   */
  const inOrder = (rows: R[]) =>
    manual && !onMoveRow && rank.size
      ? rows
          .map((row, index) => ({ row, index, at: rank.get(getKey(row)) ?? LAST_RANK }))
          .sort((a, b) => a.at - b.at || a.index - b.index)
          .map((item) => item.row)
      : rows;
  // Check boxes of the rows, to act on several (a table without its own leading cell).
  const checks = view.rowSelection;
  const bulkTable = useMemo(() => ({ selection: view.selection, keyOf: getKey as (row: unknown) => string, rows: view.rows as readonly unknown[] }), [view.selection, getKey, view.rows]);
  const rowDrag = onMoveRow ? manual || Boolean(view.groupColumn) : draggable;
  const leadWidth = (rowDrag || tree ? HANDLE_WIDTH : 0) + (checks ? ROW_CHECK_WIDTH : 0);
  const hasLead = leadWidth > 0;
  const before = (hasLead ? 1 : 0) + (leading ? 1 : 0);
  const span = shown.length + 1 + before;
  const sensors = useDragSensors('sortable');

  const items = useMemo((): Item<R>[] => {
    const tree = view.groupColumn?.groupTree;
    if (view.groupColumn && tree) {
      // Grouped by a column of a tree of groups: its values as that tree.
      const filter = columnFilter(view.groupColumn);
      const groupValue = view.groupColumn.groupValue;
      const groupOf = (row: R): readonly string[] => {
        if (groupValue) return groupValue(row);
        if (filter?.kind === 'choices') return filter.value(row);
        if (filter?.kind === 'choice') {
          const value = filter.value(row);
          return value ? [value] : [];
        }
        return [];
      };
      return groupTreeOf(inOrder(view.rows), { groups: tree, groupOf, noneLabel: view.groupColumn.groupNoneLabel ?? NO_VALUE_LABEL }, getKey, treeKey);
    }
    if (view.groupColumn) {
      return view.groups.map((group) => ({
        kind: 'group',
        id: `${GROUP_PREFIX}${group.key}`,
        level: 0,
        color: null,
        group,
        own: group.rows,
        children: treeOf(inOrder(group.rows), getKey, treeKey, 1),
      }));
    }
    return treeOf(inOrder(view.rows), getKey, treeKey);
    // inOrder reads the manual order (rank) and the sort: both in its deps through them.
  }, [view.rows, view.groups, view.groupColumn, getKey, treeKey, rank, manual, onMoveRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => {
    const helper = createColumnHelper<typeof features, Item<R>>();
    return helper.columns([
      ...(hasLead ? [helper.display({ id: LEAD_COLUMN, size: leadWidth, enableResizing: false, header: () => null, cell: () => null })] : []),
      ...(leading ? [helper.display({ id: LEADING_COLUMN, size: leading.width, enableResizing: false, header: () => null, cell: () => null })] : []),
      ...shown.map((column) => helper.display({ id: column.id, header: column.label, size: column.width, minSize: MIN_WIDTH, maxSize: MAX_WIDTH, cell: () => null })),
      helper.display({ id: ACTIONS_COLUMN, size: actionsWidth, enableResizing: false, header: () => null, cell: () => null }),
    ]);
  }, [hasLead, leadWidth, leading, shown, actionsWidth]);
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
  /**
   * Groups a row is in (its level), to indent it by its own level only.
   * @param {{ original: Item<R> }} row Row.
   * @returns {number} Level.
   */
  const levelOf = (row: { original: Item<R> }) => (row.original.kind === 'row' ? row.original.level : 0);
  const allDragItems: DragItem[] = dataRows.map((row) => ({
    id: row.id,
    depth: row.depth - levelOf(row),
    parentId: row.parentId && !row.parentId.startsWith(GROUP_PREFIX) ? row.parentId : null,
  }));
  // Key of the data of each row shown (a row in several groups has a row in each).
  const keyOfId = new Map(dataRows.map((row) => [row.id, (row.original as Extract<Item<R>, { kind: 'row' }>).key]));
  /**
   * Key of the data of a row shown.
   * @param {string} id Row id.
   * @returns {string} Key.
   */
  const keyOf = (id: string) => keyOfId.get(id) ?? id;
  const dragItems = drag ? withoutDescendants(allDragItems, drag.activeId) : allDragItems;
  const draggedAlong = new Set(drag ? allDragItems.filter((item) => !dragItems.includes(item)).map((item) => item.id) : []);
  const projection = drag?.overId ? getProjection(dragItems, drag.activeId, drag.overId, drag.offsetX, tree && Boolean(onMoveRow)) : null;

  /**
   * Moves a column to the start, the end, or by one shown column.
   * @param {string} id Column.
   * @param {ColumnMove} where Where.
   * @returns {void}
   */
  const moveColumn = (id: string, where: ColumnMove) => view.setLayout(withOrder(view.columns, layout, movedColumnOrder(order, shown, id, where)));

  /**
   * Fits a column to its content, or gives it back its default width when it already is.
   * @param {ShownColumn<R>} column Column.
   * @param {number} index Index among the shown columns.
   * @returns {void}
   */
  const fitColumn = (column: ShownColumn<R>, index: number) => tableRef.current && view.setLayout(fittedLayout(tableRef.current, layout, column, before + index, fitted.current));

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
    const overId = String(over.id);
    // Dropped on the heading of a group: first in it.
    if (overId.startsWith(GROUP_PREFIX)) {
      const groupKey = overId.slice(GROUP_PREFIX.length);
      const fromGroupKey = groupOfRow.get(activeId);
      const first = firstOfGroup.get(groupKey);
      if (groupKey !== fromGroupKey) onMoveRow?.({ key: keyOf(activeId), beforeKey: first ? keyOf(first) : null, groupKey, ...(fromGroupKey !== undefined && { fromGroupKey }) });
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
      const keys = [...new Set(moved.map((item) => keyOf(item.id)))];
      const others = (view.config?.manualOrder ?? []).filter((key) => !keys.includes(key));
      view.change((current) => ({ ...current, manualOrder: [...keys, ...others] }));
      return;
    }
    // Placed before the row now following it; the parent only changes when the level changed (a sub-row shown alone
    // by a filter keeps its hidden parent).
    const index = moved.findIndex((item) => item.id === activeId);
    const next = moved[index + 1];
    const groupKey = groupOfRow.get(overId);
    onMoveRow({
      key: keyOf(activeId),
      beforeKey: next ? keyOf(next.id) : null,
      ...(reparented && { parentKey: projection.parentId ? keyOf(projection.parentId) : null }),
      ...(groupKey !== undefined && groupKey !== groupOfRow.get(activeId) && { groupKey, fromGroupKey: groupOfRow.get(activeId) }),
    });
    // The new parent opens to show its new sub-row.
    if (projection.parentId) {
      const parentRowId = projection.parentId;
      setExpanded((current) => (current === true ? current : { ...current, [parentRowId]: true }));
    }
  };

  // Group of each row shown, and the first row of each group (a row dropped on its heading goes there).
  const groupOfRow = new Map<string, string>();
  const firstOfGroup = new Map<string, string>();
  {
    const path: { key: string; depth: number }[] = [];
    for (const row of visibleRows) {
      while (path.length && path[path.length - 1].depth >= row.depth) path.pop();
      if (row.original.kind === 'group') path.push({ key: row.original.group.key, depth: row.depth });
      else if (path.length) {
        const current = path[path.length - 1].key;
        groupOfRow.set(row.id, current);
        if (!firstOfGroup.has(current)) firstOfGroup.set(current, row.id);
      }
    }
  }

  /**
   * Row adding one, across the table.
   * @param {RowGroup<R> | null} group Group it adds to (null: the table).
   * @returns {Entry | null} Row.
   */
  const addRowOf = (group: RowGroup<R> | null): Entry | null => {
    const content = addRow?.(group);
    if (!content) return null;
    const key = taggedKey('add', group?.key ?? '');
    return {
      key,
      render: (attrs) => (
        <Table.Tr key={key} {...attrs} className={classes.addRow}>
          {before > 0 && <Table.Td colSpan={before} />}
          <Table.Td colSpan={shown.length + 1}>{content}</Table.Td>
        </Table.Tr>
      ),
    };
  };

  const entries: Entry[] = [];
  // Groups open (unfolded), the innermost last: each ends with its add row and its totals.
  const open: { item: Extract<Item<R>, { kind: 'group' }>; depth: number }[] = [];
  /**
   * Closes the groups open at a depth or deeper.
   * @param {number} depth Depth.
   * @returns {void}
   */
  const closeTo = (depth: number) => {
    while (open.length && open[open.length - 1].depth >= depth) closeGroup(open.pop()!.item);
  };
  /**
   * Closes a group: its add row and the totals of its own rows.
   * @param {Extract<Item<R>, { kind: 'group' }>} item Group.
   * @returns {void}
   */
  const closeGroup = (item: Extract<Item<R>, { kind: 'group' }>) => {
    const group = item.group;
    const add = addRowOf(group);
    if (add) entries.push(add);
    const footer = view.config?.footer;
    if (footer && shown.some((column) => footer[column.id])) {
      const key = taggedKey('footer', group.key);
      entries.push({ key, render: (attrs) => <GroupFooter key={key} trProps={{ ...attrs }} shown={shown} rows={item.own} totals={footer} label={group.label} before={before} after={1} /> });
    }
  };
  for (const row of visibleRows) {
    const item = row.original;
    closeTo(row.depth);
    if (item.kind === 'group') {
      const expandedGroup = row.getIsExpanded();
      entries.push({
        key: row.id,
        render: (attrs) => (
          <GroupHeading
            key={row.id}
            id={row.id}
            droppable={rowDrag && Boolean(onMoveRow)}
            attrs={attrs}
            label={item.group.label}
            color={item.color}
            depth={item.level}
            count={item.group.rows.length}
            summary={groupSummary?.(item.group.rows)}
            span={span}
            collapsed={!expandedGroup}
            onToggle={row.getToggleExpandedHandler()}
          />
        ),
      });
      if (expandedGroup) open.push({ item, depth: row.depth });
      continue;
    }
    if (draggedAlong.has(row.id)) continue;
    const data = item.row;
    const key = item.key;
    const locked = readOnly?.(data) ?? false;
    const depth = row.id === drag?.activeId && projection ? projection.depth : row.depth - levelOf(row);
    entries.push({
      key: row.id,
      render: (attrs) => {
        const content = cells(data);
        /**
         * Content of a cell: from the table's `cells`, else the column's own (a shared column).
         * @param {ShownColumn<R>} column Column.
         * @returns {ReactNode} Content.
         */
        const cellOf = (column: ShownColumn<R>) => (column.id in content ? content[column.id] : column.cell?.(data));
        return (
          <DataRow
            key={row.id}
            id={row.id}
            attrs={attrs}
            draggable={rowDrag && !locked}
            dropTarget={projection?.parentId === row.id}
            active={isActive?.(data) ?? false}
            archived={isArchived?.(data) ?? false}
            done={isDone?.(data) ?? false}
            struck={isStruck?.(data) ?? false}
            checked={checks?.isChecked(key) ?? false}
            rowProps={rowProps?.(data) ?? {}}
          >
            {(handle) => (
              <>
                {hasLead && (
                  <Table.Td px={4} onClick={(event) => event.stopPropagation()}>
                    <Group gap={2} wrap="nowrap">
                      {(rowDrag || tree) && handle}
                      {checks && (locked ? <span style={{ width: ROW_CHECK_WIDTH - 8, flex: 'none' }} /> : <RowCheck selection={checks} rowKey={key} name={shown[0]?.text?.(data) || undefined} />)}
                    </Group>
                  </Table.Td>
                )}
                {leading && (
                  <Table.Td px={4} {...(leading.id && !locked ? view.cellProps(leading.id, key) : {})}>
                    {leading.cell(data)}
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
                      {...(locked ? {} : view.cellProps(column.id, key))}
                    >
                      {first ? (
                        <Group gap={4} wrap="nowrap" style={{ minWidth: 0, width: '100%' }}>
                          {row.getCanExpand() ? (
                            <FoldButton expanded={row.getIsExpanded()} about="les sous-éléments" inRow onToggle={() => row.toggleExpanded()} />
                          ) : (
                            <span className={classes.chevronSpacer} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>{cellOf(column)}</div>
                        </Group>
                      ) : (
                        cellOf(column)
                      )}
                    </Table.Td>
                  );
                })}
                <Table.Td onClick={(event) => event.stopPropagation()}>{actions?.(data)}</Table.Td>
              </>
            )}
          </DataRow>
        );
      },
    });
    const unfolded = details?.(data);
    if (unfolded) {
      const detailsKey = taggedKey('details', row.id);
      entries.push({
        key: detailsKey,
        render: (attrs) => (
          <Table.Tr key={detailsKey} {...attrs} className={classes.details}>
            <Table.Td colSpan={span} className={classes.detailsCell}>
              {unfolded}
            </Table.Td>
          </Table.Tr>
        ),
      });
    }
  }
  closeTo(0);
  // The end of the table adds one without group: not grouped, or grouped as a tree without the group without shown.
  if (!view.groupColumn || (view.groupColumn.groupTree && !visibleRows.some((row) => row.id === `${GROUP_PREFIX}${NO_GROUP}`))) {
    const add = addRowOf(null);
    if (add) entries.push(add);
  }

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const tableElement = (
    // Scrolling both ways inside its own area, its header sticking to the top of it.
    <div ref={heightRef} className={classes.scroller} style={{ maxHeight: ownHeight ?? maxHeight }}>
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
                      <Table.Th key={header.id} px={4} style={{ width: header.column.getSize() }} data-reveal-host>
                        <Group gap={2} wrap="nowrap">
                          {(rowDrag || tree) && <span className={classes.handleSpacer} />}
                          {checks && <AllRowsCheck selection={checks} />}
                        </Group>
                      </Table.Th>
                    );
                  }
                  if (id === LEADING_COLUMN) {
                    return (
                      <Table.Th key={header.id} px={4} style={{ width: header.column.getSize() }}>
                        {leading?.header}
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
                        <span className={classes.headerMenu} data-reveal>
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
                        aria-label={`Redimensionner la colonne « ${column.label} »`}
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
            <Table.Tbody>
              <TableBody entries={entries} scrollRef={heightRef} span={span} />
            </Table.Tbody>
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
    if (!view.config || loading) return <TableSkeleton />;
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
    // Its cells save their edits on its selection (useBulkTable).
    <BulkTableContext.Provider value={bulkTable}>
      <Stack gap="sm">
        {toolbar && <DataViewBar view={view} tree={Boolean(parentKey)} {...bar} />}
        {content()}
        {selectionActions && checked.length > 0 && <SelectionBar label={selectionLabel(checked.length)} actions={selectionActions(checked, clear)} onClear={clear} />}
      </Stack>
    </BulkTableContext.Provider>
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
      data-reveal-host
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
  /** Its index and measure in the body. */
  attrs: RowAttrs;
  draggable: boolean;
  /** Future parent of the dragged row. */
  dropTarget: boolean;
  active: boolean;
  archived: boolean;
  done: boolean;
  /** Its label struck through. */
  struck: boolean;
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
function DataRow({ id, attrs, draggable, dropTarget, active, archived, done, struck, checked, rowProps, children }: DataRowProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
  const { className, style, ...props } = rowProps;
  const handle = draggable ? (
    <DragHandle
      hint="Déplacer (horizontalement : son niveau)"
      size="sm"
      className={classes.handle}
      reveal
      activator={setActivatorNodeRef}
      attributes={attributes}
      listeners={listeners}
      dragging={isDragging}
    />
  ) : (
    <span className={classes.handleSpacer} />
  );
  return (
    <Table.Tr
      {...props}
      data-index={attrs['data-index']}
      ref={(element: HTMLTableRowElement | null) => {
        setNodeRef(element);
        attrs.ref(element);
      }}
      className={[classes.row, className].filter(Boolean).join(' ')}
      data-reveal-host
      // Vertical only: the level being chosen shows through the indentation.
      style={{ ...(typeof style === 'object' ? style : {}), transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      data-active={active || undefined}
      data-archived={archived || undefined}
      data-done={done || undefined}
      data-struck={struck || undefined}
      data-selected={checked || undefined}
      data-dragging={isDragging || undefined}
      data-drop-target={dropTarget || undefined}
    >
      {children(handle)}
    </Table.Tr>
  );
}

interface GroupHeadingProps {
  id: string;
  /** Rows can be dropped on it (into its group). */
  droppable: boolean;
  attrs: RowAttrs;
  label: string;
  color: string | null;
  /** Its depth in a tree of groups. */
  depth: number;
  count: number;
  summary?: ReactNode;
  span: number;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Heading of a group, on which a dragged row can be dropped to go into the group.
 * @param {GroupHeadingProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function GroupHeading({ id, droppable, attrs, ...heading }: GroupHeadingProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });
  return (
    <GroupHeaderRow
      {...heading}
      trProps={{
        'data-index': attrs['data-index'],
        'data-drop-target': (droppable && isOver) || undefined,
        ref: (element: HTMLTableRowElement | null) => {
          setNodeRef(element);
          attrs.ref(element);
        },
      }}
    />
  );
}

/** Measure of a row of a table that is not virtual (nothing measured). */
const NO_MEASURE = () => undefined;

/**
 * A row of the body, drawn again only when it changes (not while the table scrolls).
 * @param {{ entry: Entry, index: number, measure: (element: HTMLTableRowElement | null) => void }} props Row, its index, its measure.
 * @returns {ReactNode} Row.
 */
const EntryRow = memo(function EntryRow({ entry, index, measure }: { entry: Entry; index: number; measure: (element: HTMLTableRowElement | null) => void }) {
  return entry.render({ 'data-index': index, ref: measure });
});

/**
 * Body of a table: its rows, only those in view for a long table (measured as they show, the others standing as their
 * height). Its own component: scrolling draws it again, not the table, and only the rows that come into view.
 * @param {{ entries: Entry[], scrollRef: RefObject<HTMLDivElement | null>, span: number }} props Rows, scrolling area, cells of a row.
 * @returns {JSX.Element} Rows.
 */
function TableBody({ entries, scrollRef, span }: { entries: Entry[]; scrollRef: RefObject<HTMLDivElement | null>; span: number }) {
  const virtual = entries.length > VIRTUAL_FROM;
  const virtualizer = useVirtualizer({
    count: virtual ? entries.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 40,
    getItemKey: (index) => entries[index]?.key ?? index,
  });
  if (!virtual) return entries.map((entry, index) => <EntryRow key={entry.key} entry={entry} index={index} measure={NO_MEASURE} />);
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;
  return (
    <>
      {paddingTop > 0 && (
        <tr aria-hidden style={{ height: paddingTop }}>
          <td colSpan={span} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
      {virtualRows.map((virtualRow) => {
        const entry = entries[virtualRow.index];
        return <EntryRow key={entry.key} entry={entry} index={virtualRow.index} measure={virtualizer.measureElement} />;
      })}
      {paddingBottom > 0 && (
        <tr aria-hidden style={{ height: paddingBottom }}>
          <td colSpan={span} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
    </>
  );
}
