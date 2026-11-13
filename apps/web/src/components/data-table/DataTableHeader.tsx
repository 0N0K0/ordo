import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Group, Table } from '@mantine/core';
import type { ColumnLayout, TableSort } from '@ordo/shared';
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { contentWidth } from '../../features/tasks/column-fit';
import { ColumnHeaderMenu, type ColumnMenuExtras, type ColumnMove } from './ColumnHeaderMenu';
import { clampWidth, columnOrder, toggleSort, withOrder, withVisibility, type DataColumn, type ShownColumn } from './data-table';
import classes from './DataTable.module.css';

interface HeaderCellProps<R> {
  column: ShownColumn<R>;
  index: number;
  sort: TableSort | undefined;
  sortCount: number;
  sortIndex: number;
  /** Shown columns (to move one left or right). */
  shown: ShownColumn<R>[];
  onSort: (multi: boolean) => void;
  onSortBy: (desc: boolean | null) => void;
  onHide: () => void;
  onMove: (where: ColumnMove) => void;
  onResize: (width: number) => void;
  onFit: () => void;
  /** Filter and group actions of the column. Optional. */
  extras?: ColumnMenuExtras;
}

/**
 * Header of a column: dragged to move it, clicked to sort (Shift: one more sort), its menu (sort, hide, move), its
 * right edge dragged to resize it (double click: fitted to its content).
 * @param {HeaderCellProps<R>} props Component props.
 * @returns {JSX.Element} Header cell.
 */
function HeaderCell<R>({ column, index, sort, sortCount, sortIndex, shown, onSort, onSortBy, onHide, onMove, onResize, onFit, extras }: HeaderCellProps<R>) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: column.id });
  const start = useRef<{ x: number; width: number } | null>(null);
  const sortable = Boolean(column.sortValue);

  /**
   * Starts resizing the column from its right edge.
   * @param {ReactPointerEvent<HTMLDivElement>} event Pointer down.
   * @returns {void}
   */
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width: column.width };
  };

  return (
    <Table.Th
      ref={setNodeRef}
      style={{ width: column.width, transform: CSS.Translate.toString(transform), transition }}
      className={classes.header}
      data-dragging={isDragging || undefined}
      data-numeric={column.numeric || undefined}
      aria-sort={sort ? (sort.desc ? 'descending' : 'ascending') : undefined}
      title="Glisser pour déplacer la colonne"
      {...listeners}
    >
      <Group gap={2} wrap="nowrap" className={classes.headerContent}>
        {sortable ? (
          <button type="button" className={classes.sortButton} onClick={(event) => onSort(event.shiftKey)}>
            <span className={classes.label}>{column.label}</span>
            {sort && (
              <span className={classes.sortMark}>
                {sort.desc ? '↓' : '↑'}
                {sortCount > 1 && <sub>{sortIndex + 1}</sub>}
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
            onSortBy={onSortBy}
            {...extras}
            onHide={column.locked ? undefined : onHide}
            index={index}
            count={shown.length}
            onMove={onMove}
          />
        </span>
      </Group>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner la colonne ${column.label}`}
        className={classes.resizer}
        onPointerDown={startResize}
        onPointerMove={(event) => start.current && onResize(clampWidth(start.current.width + event.clientX - start.current.x))}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
        onDoubleClick={onFit}
      />
    </Table.Th>
  );
}

interface DataTableHeaderProps<R> {
  columns: readonly DataColumn<R>[];
  shown: ShownColumn<R>[];
  layout: ColumnLayout;
  onLayoutChange: (layout: ColumnLayout) => void;
  sorting: readonly TableSort[];
  onSortingChange: (sorting: TableSort[]) => void;
  /** Table measured to fit a column to its content. */
  tableRef: RefObject<HTMLTableElement | null>;
  /** Header cells before the columns (selection…). Optional. */
  leading?: ReactNode;
  /** Number of the cells before the columns, in each row. Optional. Default = 0 (1 with `leading`). */
  leadingCount?: number;
  /** Header cells after the columns (actions…). Optional. */
  trailing?: ReactNode;
  /** Filter and group actions of a column, in its menu. Optional. */
  columnExtras?: (id: string) => ColumnMenuExtras | undefined;
}

/**
 * Header of a data table, as the one of the tasks: columns moved by drag and drop (or their menu), sorted by a click
 * on their title (Shift + click: one more sort), hidden, resized by their right edge (double click: fitted to their
 * content).
 * @param {DataTableHeaderProps<R>} props Component props.
 * @returns {JSX.Element} Header.
 */
export function DataTableHeader<R>({ columns, shown, layout, onLayoutChange, sorting, onSortingChange, tableRef, leading, leadingCount, trailing, columnExtras }: DataTableHeaderProps<R>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const order = columnOrder(columns, layout);
  // Width each column was fitted to: a second double click, the column unchanged, gives back its default width.
  const fitted = useRef(new Map<string, number>());
  const before = leadingCount ?? (leading ? 1 : 0);

  /**
   * Moves a dropped header before or after the one under it.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onLayoutChange(withOrder(columns, layout, arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))));
  };

  /**
   * Moves a column to the start, the end, or by one shown column.
   * @param {string} id Column.
   * @param {ColumnMove} where Where.
   * @returns {void}
   */
  const move = (id: string, where: ColumnMove) => {
    const others = order.filter((item) => item !== id);
    const index = shown.findIndex((column) => column.id === id);
    let at: number;
    if (where === 'start') at = 0;
    else if (where === 'end') at = others.length;
    else {
      const neighbour = shown[where === 'left' ? index - 1 : index + 1].id;
      at = others.indexOf(neighbour) + (where === 'right' ? 1 : 0);
    }
    onLayoutChange(withOrder(columns, layout, [...others.slice(0, at), id, ...others.slice(at)]));
  };

  /**
   * Fits a column to its content, or gives it back its default width when it already is.
   * @param {ShownColumn<R>} column Column.
   * @param {number} index Index among the shown columns.
   * @returns {void}
   */
  const fit = (column: ShownColumn<R>, index: number) => {
    if (!tableRef.current) return;
    const width = clampWidth(contentWidth(tableRef.current, before + index) + 2);
    const { [column.id]: _dropped, ...others } = layout.columnSizing; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (fitted.current.get(column.id) === column.width || Math.abs(width - column.width) <= 2) {
      fitted.current.delete(column.id);
      onLayoutChange({ ...layout, columnSizing: others });
      return;
    }
    fitted.current.set(column.id, width);
    onLayoutChange({ ...layout, columnSizing: { ...others, [column.id]: width } });
  };

  return (
    <Table.Thead className={classes.head}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={shown.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
          <Table.Tr>
            {leading}
            {shown.map((column, index) => {
              const sort = sorting.find((item) => item.id === column.id);
              return (
                <HeaderCell
                  key={column.id}
                  column={column}
                  index={index}
                  sort={sort}
                  sortCount={sorting.length}
                  sortIndex={sorting.findIndex((item) => item.id === column.id)}
                  shown={shown}
                  onSort={(multi) => onSortingChange(toggleSort(sorting, column.id, multi))}
                  onSortBy={(desc) => onSortingChange(desc === null ? sorting.filter((item) => item.id !== column.id) : [{ id: column.id, desc }])}
                  onHide={() => onLayoutChange(withVisibility(columns, layout, column.id, false))}
                  onMove={(where) => move(column.id, where)}
                  onResize={(width) => onLayoutChange({ ...layout, columnSizing: { ...layout.columnSizing, [column.id]: width } })}
                  onFit={() => fit(column, index)}
                  extras={columnExtras?.(column.id)}
                />
              );
            })}
            {trailing}
          </Table.Tr>
        </SortableContext>
      </DndContext>
    </Table.Thead>
  );
}
