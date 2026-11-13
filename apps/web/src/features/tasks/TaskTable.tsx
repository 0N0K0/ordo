import {
  closestCenter,
  DndContext,
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
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Anchor, Box, Checkbox, ColorSwatch, Group, Table, Text, Tooltip } from '@mantine/core';
import { formatDuration, TASK_COLUMNS, type TaskColumn, type TaskViewConfig } from '@ordo/shared';
import { AlarmIcon, ArrowsClockwiseIcon, CaretRightIcon, ChatCircleIcon, DotsSixVerticalIcon, GithubLogoIcon, SidebarSimpleIcon, TreeViewIcon } from '@phosphor-icons/react';
import { useTaskAlarmCounts } from '../alarms/api';
import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnSizingState,
  type ExpandedState,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { notifyError } from '../../lib/notify';
import type { EventOccurrence } from '../calendar/api';
import { useMoveTask, type Task } from './api';
import classes from './TaskTable.module.css';
import { TaskRef, TaskStateIcon } from './task-ui';
import type { TaskContext } from './use-task-context';
import { TASK_PARAM, useTaskLink } from './use-task-link';
import { CellSelectionContext, type CellSelection } from './views/cell-edit';
import { BULK_EDITABLE_COLUMNS, COLUMN_LABELS, COLUMN_SIZES, LOCKED_COLUMNS } from './views/columns-meta';
import { HeaderMenu } from './views/HeaderMenu';
import { ROW_ACTIONS_WIDTH, RowActions } from '../../components/data-table/RowActions';
import { useTaskActions } from './use-task-actions';
import {
  AssigneesCell,
  BlockedByCell,
  DateCell,
  EffortCell,
  LabelCell,
  MilestoneCell,
  SprintCell,
  TagsCell,
  TitleCell,
} from './views/inline-cells';
import { groupDefaults, type NewTaskDefaults } from './views/new-task-defaults';
import { EventPeopleCell, EventStatusCell, EventTimeCell, EventTitleCell, EventWhenCell } from './views/event-cells';
import { AddTaskRow, SummaryRow } from './views/table-extras';
import type { DisplayRow, TaskRow } from './views/task-rows';
import { contentWidth, useFillHeight } from './column-fit';

// Stable module-level registry. Sorting is applied when building the rows (so it works with groups
// and sub-tasks), the table only holds the sorting state and header interactions.
const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  rowSortingFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  rowSelectionFeature,
});
const column = createColumnHelper<typeof features, DisplayRow>();

const SELECT_COLUMN = 'select';
/** Column of the actions of a row, at the end. */
const ACTIONS_COLUMN = 'actions';
const COLUMN_PREFIX = 'col:';
/** Horizontal offset of one sub-task level, in px (matches the title indentation). */
const INDENT = 20;
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

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
 * Swallows the click fired by releasing the pointer at the end of a drag (it would sort or open a task).
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
  const droppableContainers = args.droppableContainers.filter(
    (container) => String(container.id).startsWith(COLUMN_PREFIX) === draggingColumn,
  );
  return draggingColumn ? pointerWithin({ ...args, droppableContainers }) : closestCenter({ ...args, droppableContainers });
};

/** Task row during a drag: its level and its parent row. */
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
 * Where a dragged task would land, as in the sidebar tree: the place from the hovered row, the level from
 * the horizontal offset (at most one level below the row above, at least the level of the row below).
 * @param {DragItem[]} items Rows during the drag.
 * @param {string} activeId Dragged row.
 * @param {string} overId Hovered row.
 * @param {number} offsetX Horizontal drag offset in px.
 * @returns {{ depth: number, parentId: string | null } | null} Level and parent row, or null when invalid.
 */
function getProjection(items: DragItem[], activeId: string, overId: string, offsetX: number) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
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
 * Links to tasks by number ("#12, #13").
 * @param {object} props Component props.
 * @param {string[]} props.ids Task ids.
 * @param {TaskContext} props.context Task context.
 * @returns {JSX.Element} Links.
 */
function TaskNumbers({ ids, context }: { ids: string[]; context: TaskContext }) {
  const link = useTaskLink();
  const tasks = ids.map((id) => context.taskById.get(id)).filter((task) => task !== undefined);
  return (
    <Group gap={6} wrap="nowrap" style={{ overflow: 'hidden' }}>
      {tasks.map((task) => (
        <Tooltip key={task.id} label={task.title}>
          <Anchor
            component={Link}
            to={link.to(task.id)}
            size="sm"
            td={context.isClosed(task) ? 'line-through' : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            #{task.number}
          </Anchor>
        </Tooltip>
      ))}
    </Group>
  );
}

interface TaskTableProps {
  rows: DisplayRow[];
  config: TaskViewConfig;
  change: (change: (config: TaskViewConfig) => TaskViewConfig) => void;
  context: TaskContext;
  /** User's day (YYYY-MM-DD), for overdue tasks (past their "Date max"). */
  today: string;
  selection: RowSelectionState;
  onSelectionChange: (selection: RowSelectionState) => void;
  cellSelection: CellSelection | null;
  onCellSelectionChange: (selection: CellSelection | null) => void;
  /** "Filtrer selon cette colonne". */
  onFilterColumn: (column: TaskColumn) => void;
  /** Manual reordering of tasks by drag and drop (manual order, no grouping, pointer device). */
  dndEnabled: boolean;
  /** Project of tasks added from the table; without it, adding opens the creation form. */
  createProjectId?: string;
  onOpenCreateForm: (defaults: NewTaskDefaults) => void;
}

/**
 * Number of tasks without sub-tasks among some rows (their own sub-rows included), their total effort, and the
 * time tracked on every listed task (parents included: their time is their own). A task listed in several
 * groups counts once per group.
 * @param {DisplayRow[]} rows Rows.
 * @param {TaskContext} context Task context.
 * @returns {{ count: number, effort: number, tracked: number }} Summary.
 */
function summarize(rows: DisplayRow[], context: TaskContext): { count: number; effort: number; tracked: number } {
  const leaves = new Set<string>();
  const listed = new Set<string>();
  let effort = 0;
  let tracked = 0;
  const walk = (items: DisplayRow[]) => {
    for (const item of items) {
      if (item.kind === 'task' && !listed.has(item.task.id)) {
        listed.add(item.task.id);
        tracked += item.task.trackedSeconds;
        if (context.childrenOf(item.task.id).length === 0) {
          leaves.add(item.task.id);
          effort += item.task.effort ?? 0;
        }
      }
      walk(item.children);
    }
  };
  walk(rows);
  return { count: leaves.size, effort, tracked };
}

/**
 * Task table of a view: column menus, drag-and-drop column order, resizable and hideable columns,
 * multi-sort, expandable sub-tasks and groups, row selection, spreadsheet-like inline and column edits,
 * drag-and-drop task reordering; calendar events listed with the tasks (read only, opened in their form).
 * @param {TaskTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function TaskTable({
  rows,
  config,
  change,
  context,
  today,
  selection,
  onSelectionChange,
  cellSelection,
  onCellSelectionChange,
  onFilterColumn,
  dndEnabled,
  createProjectId,
  onOpenCreateForm,
}: TaskTableProps) {
  const [params] = useSearchParams();
  const openId = params.get(TASK_PARAM);
  const moveTask = useMoveTask();
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const anchorRow = useRef<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [drag, setDrag] = useState<{ activeId: string; overId: string | null; offsetX: number } | null>(null);
  const alarmCounts = useTaskAlarmCounts();
  const taskActions = useTaskActions(context);
  const taskLink = useTaskLink();

  const columns = useMemo(() => {
    const cells: Record<TaskColumn, (task: Task) => ReactNode> = {
      title: (task) => (
        <TitleCell
          task={task}
          context={context}
          prefix={
            <>
              <TaskStateIcon closed={task.closed} blocked={context.isBlocked(task)} />
              {task.githubLinked && (
                <Tooltip label={task.githubNumber ? `Synchronisée avec l’issue GitHub #${task.githubNumber}` : 'Synchronisée avec un brouillon GitHub'}>
                  <GithubLogoIcon aria-label="GitHub" className={classes.recurring} />
                </Tooltip>
              )}
              {(task.recurrence || task.seriesId) && (
                <Tooltip label={task.seriesId ? 'Occurrence d’une tâche récurrente' : 'Tâche récurrente'}>
                  <ArrowsClockwiseIcon aria-label="Récurrente" className={classes.recurring} />
                </Tooltip>
              )}
              {alarmCounts.has(task.id) && (
                <Tooltip label={`${alarmCounts.get(task.id)} alerte(s) active(s)`}>
                  <AlarmIcon aria-label="Alertes" className={classes.recurring} />
                </Tooltip>
              )}
            </>
          }
        />
      ),
      project: (task) => (
        <Text size="sm" truncate title={context.projectLabel(task.projectId)}>
          {context.projectById.get(task.projectId)?.title}
        </Text>
      ),
      status: (task) => <LabelCell task={task} column="status" labels={context.statuses} />,
      priority: (task) => <LabelCell task={task} column="priority" labels={context.priorities} />,
      type: (task) => <LabelCell task={task} column="type" labels={context.types} />,
      assignees: (task) => <AssigneesCell task={task} context={context} />,
      tags: (task) => <TagsCell task={task} context={context} />,
      effort: (task) => <EffortCell task={task} />,
      trackedTime: (task) =>
        task.trackedSeconds > 0 ? (
          <Text size="sm" ta="right">
            {formatDuration(task.trackedSeconds)}
          </Text>
        ) : null,
      startDate: (task) => <DateCell task={task} column="startDate" />,
      endDate: (task) => <DateCell task={task} column="endDate" />,
      deadline: (task) => (
        <DateCell task={task} column="deadline" alert={task.deadline !== null && task.deadline < today && !context.isClosed(task)} />
      ),
      parent: (task) => {
        const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
        return parent ? (
          <Box onClick={(event) => event.stopPropagation()} style={{ minWidth: 0 }}>
            <TaskRef task={parent} blocked={context.isBlocked(parent)} />
          </Box>
        ) : null;
      },
      milestone: (task) => <MilestoneCell task={task} context={context} />,
      sprint: (task) => <SprintCell task={task} context={context} />,
      blockedBy: (task) => <BlockedByCell task={task} context={context} />,
      blocking: (task) => <TaskNumbers ids={task.blockingIds} context={context} />,
      related: (task) => <TaskNumbers ids={task.relatedIds} context={context} />,
      comments: (task) =>
        task.commentCount > 0 ? (
          <Group gap={4} wrap="nowrap" c="dimmed">
            <ChatCircleIcon aria-hidden />
            <Text size="sm">{task.commentCount}</Text>
          </Group>
        ) : null,
      createdAt: (task) => <Text size="sm">{dateTimeFormat.format(new Date(task.createdAt))}</Text>,
      updatedAt: (task) => <Text size="sm">{dateTimeFormat.format(new Date(task.updatedAt))}</Text>,
    };

    // Events only have a title, a project, people and dates.
    const eventCells: Partial<Record<TaskColumn, (event: EventOccurrence) => ReactNode>> = {
      title: (event) => <EventTitleCell event={event} context={context} />,
      project: (event) =>
        event.projectId ? (
          <Text size="sm" truncate title={context.projectLabel(event.projectId)}>
            {context.projectById.get(event.projectId)?.title}
          </Text>
        ) : null,
      assignees: (event) => <EventPeopleCell event={event} context={context} />,
      // Where it stands (read only), the time of its timers, and its start and end, edited in place.
      status: (event) => <EventStatusCell event={event} />,
      trackedTime: (event) => <EventTimeCell event={event} />,
      startDate: (event) => <EventWhenCell event={event} side="start" />,
      endDate: (event) => <EventWhenCell event={event} side="end" />,
    };

    return column.columns([
      column.display({
        id: SELECT_COLUMN,
        size: 64,
        enableResizing: false,
        enableHiding: false,
        enableSorting: false,
        // Same layout as the rows (drag handle space, then checkbox) so the checkboxes line up.
        // Every task of the view is selected, sub-tasks and collapsed rows included.
        header: ({ table }) => {
          const rows = table.getCoreRowModel().flatRows.filter((row) => row.original.kind === 'task');
          const ids = rows.map((row) => row.id);
          const count = rows.filter((row) => row.getIsSelected()).length;
          return (
            <Group gap={2} wrap="nowrap">
              <span className={classes.handleSpacer} />
              <Checkbox
                size="xs"
                aria-label="Tout sélectionner"
                checked={ids.length > 0 && count === ids.length}
                indeterminate={count > 0 && count < ids.length}
                onChange={(event) =>
                  table.setRowSelection(event.currentTarget.checked ? Object.fromEntries(ids.map((id) => [id, true])) : {})
                }
              />
            </Group>
          );
        },
        cell: () => null,
      }),
      column.display({ id: ACTIONS_COLUMN, size: ROW_ACTIONS_WIDTH, enableResizing: false, enableHiding: false, enableSorting: false, header: () => null, cell: () => null }),
      // An accessor makes the column sortable; values are not read (rows are sorted when built).
      ...TASK_COLUMNS.map((id) =>
        column.accessor(() => 0, {
          id,
          header: COLUMN_LABELS[id],
          size: COLUMN_SIZES[id],
          minSize: 60,
          enableHiding: !LOCKED_COLUMNS.includes(id),
          cell: ({ row }) =>
            row.original.kind === 'task'
              ? cells[id](row.original.task)
              : row.original.kind === 'event'
                ? (eventCells[id]?.(row.original.event) ?? null)
                : null,
        }),
      ),
    ]);
  }, [context, today, alarmCounts]);

  // Full column order: columns added after a view was saved go at the end.
  const order = useMemo(
    () => [...config.columnOrder, ...TASK_COLUMNS.filter((id) => !config.columnOrder.includes(id))],
    [config.columnOrder],
  );
  const columnVisibility = useMemo(
    () => Object.fromEntries(config.hiddenColumns.map((id) => [id, false])),
    [config.hiddenColumns],
  );
  const columnOrder = useMemo(() => [SELECT_COLUMN, ...order, ACTIONS_COLUMN], [order]);

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    manualSorting: true,
    // Rows change with every filter keystroke: keep what the user expanded or collapsed.
    autoResetExpanded: false,
    enableMultiSort: true,
    enableRowSelection: (row) => row.original.kind === 'task',
    enableSubRowSelection: false,
    columnResizeMode: 'onChange',
    state: {
      sorting: config.sorting as SortingState,
      columnVisibility,
      columnOrder,
      columnSizing: config.columnSizing as ColumnSizingState,
      expanded,
      rowSelection: selection,
    },
    onSortingChange: (updater) =>
      change((current) => ({
        ...current,
        sorting: apply(updater, current.sorting as SortingState) as TaskViewConfig['sorting'],
      })),
    onColumnSizingChange: (updater) =>
      change((current) => {
        const sizing = apply(updater, current.columnSizing as ColumnSizingState);
        // Rounded and clamped like the saved schema.
        return {
          ...current,
          columnSizing: Object.fromEntries(
            Object.entries(sizing).map(([id, size]) => [id, Math.min(1200, Math.max(40, Math.round(size)))]),
          ),
        };
      }),
    onExpandedChange: (updater) => setExpanded((current) => apply(updater, current)),
    onRowSelectionChange: (updater) => onSelectionChange(apply(updater, selection)),
  });

  const [fillRef, fillHeight] = useFillHeight();
  const tableRef = useRef<HTMLTableElement>(null);

  // Width each column was fitted to: a second double click, the column unchanged, gives back its default width.
  const fitted = useRef(new Map<string, number>());

  /**
   * Double click on the edge of a column: fitted to its content, or back to its default width when it already is.
   * @param {string} id Column.
   * @param {number} index Index of the column among the cells of a row.
   * @param {number} size Current width.
   * @param {() => void} reset Back to the default width.
   * @returns {void}
   */
  const fitColumn = (id: string, index: number, size: number, reset: () => void) => {
    if (!tableRef.current) return;
    // Clamped like the saved widths.
    const fit = Math.min(1200, Math.max(40, contentWidth(tableRef.current, index) + 2));
    if (fitted.current.get(id) === size || Math.abs(fit - size) <= 2) {
      fitted.current.delete(id);
      reset();
      return;
    }
    fitted.current.set(id, fit);
    table.setColumnSizing((sizing) => ({ ...sizing, [id]: fit }));
  };

  const visibleRows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const taskRows = visibleRows.filter((row) => row.original.kind === 'task');
  const taskRowIds = taskRows.map((row) => row.id);
  const grouped = config.groupBy !== null;

  // While a task is dragged, its expanded sub-tasks are hidden: they move with it.
  const allDragItems: DragItem[] = taskRows.map((row) => ({ id: row.id, depth: row.depth, parentId: row.parentId ?? null }));
  const dragItems = drag ? withoutDescendants(allDragItems, drag.activeId) : allDragItems;
  const draggedAlong = new Set(drag ? allDragItems.filter((item) => !dragItems.includes(item)).map((item) => item.id) : []);
  const projection = drag?.overId ? getProjection(dragItems, drag.activeId, drag.overId, drag.offsetX) : null;

  // Only shown cells stay selected (filtered-out or collapsed tasks are never edited).
  const shownTasks = new Map(taskRows.map((row) => [row.id, (row.original as TaskRow).task.id]));
  const shownRowIds = cellSelection?.rowIds.filter((id) => shownTasks.has(id)) ?? [];
  const effectiveCellSelection: CellSelection | null =
    cellSelection && shownRowIds.length > 0
      ? { ...cellSelection, rowIds: shownRowIds, taskIds: [...new Set(shownRowIds.map((id) => shownTasks.get(id)!))] }
      : null;

  // Escape clears the cell selection.
  useEffect(() => {
    if (!cellSelection) return;
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onCellSelectionChange(null);
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cellSelection, onCellSelectionChange]);

  /**
   * Selects every shown cell of a column.
   * @param {TaskColumn} id Column.
   * @returns {void}
   */
  const selectColumn = (id: TaskColumn) => {
    anchorRow.current = taskRowIds[0] ?? null;
    onCellSelectionChange({ column: id, rowIds: taskRowIds, taskIds: [] });
  };

  /**
   * Cell selection with the keyboard modifiers: Ctrl / ⌘ + click toggles a cell, Shift + click selects a
   * range in the column. A plain click outside the selection clears it.
   * @param {MouseEvent} event Click event (capture phase, before the cell editor).
   * @param {string} rowId Row id.
   * @param {TaskColumn} id Column.
   * @returns {void}
   */
  const handleCellClick = (event: MouseEvent, rowId: string, id: TaskColumn) => {
    const modifier = event.ctrlKey || event.metaKey || event.shiftKey;
    if (!modifier) {
      if (effectiveCellSelection && !(effectiveCellSelection.column === id && effectiveCellSelection.rowIds.includes(rowId))) {
        onCellSelectionChange(null);
      }
      return;
    }
    if (!BULK_EDITABLE_COLUMNS.includes(id)) return;
    event.preventDefault();
    event.stopPropagation();
    const sameColumn = effectiveCellSelection?.column === id ? effectiveCellSelection.rowIds : [];
    let rowIds: string[];
    if (event.shiftKey && anchorRow.current && taskRowIds.includes(anchorRow.current)) {
      const [from, to] = [taskRowIds.indexOf(anchorRow.current), taskRowIds.indexOf(rowId)].sort((a, b) => a - b);
      rowIds = [...new Set([...sameColumn, ...taskRowIds.slice(from, to + 1)])];
    } else {
      rowIds = sameColumn.includes(rowId) ? sameColumn.filter((item) => item !== rowId) : [...sameColumn, rowId];
      anchorRow.current = rowId;
    }
    onCellSelectionChange(rowIds.length ? { column: id, rowIds, taskIds: [] } : null);
  };

  /**
   * Moves a dragged column, or a dragged task with its sub-tasks: vertically to choose the place,
   * horizontally to choose the level (inside the task above, or out of its parent).
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    suppressClickAfterDrop();
    if (!over) return;
    const activeId = String(active.id);

    if (activeId.startsWith(COLUMN_PREFIX)) {
      if (active.id === over.id) return;
      const from = activeId.slice(COLUMN_PREFIX.length) as TaskColumn;
      const to = String(over.id).slice(COLUMN_PREFIX.length) as TaskColumn;
      change((current) => ({ ...current, columnOrder: arrayMove(order, order.indexOf(from), order.indexOf(to)) }));
      return;
    }

    if (!projection) return;
    const original = dragItems.find((item) => item.id === activeId)!;
    const moved = arrayMove(
      dragItems,
      dragItems.findIndex((item) => item.id === activeId),
      dragItems.findIndex((item) => item.id === over.id),
    );
    const index = moved.findIndex((item) => item.id === activeId);
    const reparented = projection.parentId !== original.parentId;
    if (!reparented && over.id === activeId) return;
    // Placed before the row now following it; the parent only changes when the level changed (a sub-task
    // shown alone by a filter keeps its hidden parent).
    const next = moved[index + 1];
    const taskOf = (rowId: string) => (visibleRows.find((row) => row.id === rowId)?.original as TaskRow).task.id;
    const parentTaskId = projection.parentId ? taskOf(projection.parentId) : null;
    moveTask.mutate(
      { id: taskOf(activeId), beforeId: next ? taskOf(next.id) : null, ...(reparented && { parentId: parentTaskId }) },
      { onError: (error) => notifyError(error.message) },
    );
    // The new parent opens to show its new sub-task.
    if (projection.parentId) {
      const parentRowId = projection.parentId;
      setExpanded((current) => (current === true ? current : { ...current, [parentRowId]: true }));
    }
  };

  const columnIds = visibleColumns.map((item) => item.id);
  const extraProps = {
    columnCount: visibleColumns.length,
    titleIndex: columnIds.indexOf('title'),
    context,
  };
  const effortIndex = columnIds.indexOf('effort');
  const trackedIndex = columnIds.indexOf('trackedTime');

  /**
   * Add row and subtotal closing a group.
   * @param {string} groupRowId Group row id ("g:<key>").
   * @param {DisplayRow[]} groupRows Rows of the group.
   * @returns {ReactNode} Rows.
   */
  const groupEnd = (groupRowId: string, groupRows: DisplayRow[]) => {
    const summary = summarize(groupRows, context);
    return [
      <AddTaskRow
        key={`${groupRowId}-add`}
        {...extraProps}
        defaults={config.groupBy ? groupDefaults(config.groupBy, groupRowId.slice(2), context) : {}}
        projectId={createProjectId}
        onOpenForm={onOpenCreateForm}
      />,
      <SummaryRow key={`${groupRowId}-sum`} {...extraProps} effortIndex={effortIndex} trackedIndex={trackedIndex} {...summary} />,
    ];
  };

  const tableRows = visibleRows.map((row) => {
    const original = row.original;
    if (draggedAlong.has(row.id)) return null;
    if (original.kind === 'group') {
      return (
        <Table.Tr key={row.id} className={classes.groupRow}>
          <Table.Td colSpan={visibleColumns.length}>
            <Group gap="xs" wrap="nowrap" className={classes.groupLabel}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={row.getIsExpanded() ? 'Replier le groupe' : 'Déplier le groupe'}
                aria-expanded={row.getIsExpanded()}
                onClick={row.getToggleExpandedHandler()}
              >
                <CaretRightIcon className={classes.chevron} data-expanded={row.getIsExpanded() || undefined} aria-hidden />
              </ActionIcon>
              {original.color && <ColorSwatch color={original.color} size={10} />}
              <Text size="sm" fw={600}>
                {original.label}
              </Text>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    }
    if (original.kind === 'event') {
      return (
        <Table.Tr key={row.id} className={classes.row}>
          {row.getVisibleCells().map((cell) => {
            const id = cell.column.id;
            if (id === SELECT_COLUMN) {
              return (
                <Table.Td key={cell.id}>
                  <span className={classes.handleSpacer} />
                </Table.Td>
              );
            }
            if (id === ACTIONS_COLUMN) return <Table.Td key={cell.id} />;
            return (
              <Table.Td
                key={cell.id}
                style={id === 'title' ? ({ '--row-depth': row.depth - (grouped ? 1 : 0) } as CSSProperties) : undefined}
                className={id === 'title' ? classes.titleCell : undefined}
              >
                {id === 'title' ? (
                  <Group gap={4} wrap="nowrap" style={{ minWidth: 0, width: '100%' }}>
                    <span className={classes.chevronSpacer} />
                    <table.FlexRender cell={cell} />
                  </Group>
                ) : (
                  <table.FlexRender cell={cell} />
                )}
              </Table.Td>
            );
          })}
        </Table.Tr>
      );
    }
    return (
      <SortableRow
        key={row.id}
        id={row.id}
        disabled={!dndEnabled}
        dropTarget={projection?.parentId === row.id}
        active={original.task.id === openId}
        archived={original.task.archived}
        selected={row.getIsSelected()}
      >
        {(handle) =>
          row.getVisibleCells().map((cell) => {
            const id = cell.column.id;
            if (id === SELECT_COLUMN) {
              return (
                <Table.Td key={cell.id} onClick={(event) => event.stopPropagation()}>
                  <Group gap={2} wrap="nowrap">
                    {handle}
                    <Checkbox
                      size="xs"
                      aria-label={`Sélectionner la tâche #${original.task.number}`}
                      checked={row.getIsSelected()}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </Group>
                </Table.Td>
              );
            }
            if (id === ACTIONS_COLUMN) {
              const task = original.task;
              return (
                <Table.Td key={cell.id} onClick={(event) => event.stopPropagation()}>
                  <RowActions
                    name={`la tâche #${task.number}`}
                    primary={{ label: 'Ouvrir', icon: <SidebarSimpleIcon aria-hidden />, onClick: () => taskLink.open(task.id) }}
                    items={[{ label: 'Ajouter une sous-tâche', icon: <TreeViewIcon aria-hidden />, onClick: () => taskActions.create({ projectId: task.projectId ?? undefined, parentId: task.id }) }, 'divider', ...taskActions.menu(task)]}
                  />
                </Table.Td>
              );
            }
            const columnId = id as TaskColumn;
            const cellSelected =
              effectiveCellSelection?.column === columnId && effectiveCellSelection.rowIds.includes(row.id);
            const depth = row.id === drag?.activeId && projection ? projection.depth : row.depth - (grouped ? 1 : 0);
            return (
              <Table.Td
                key={cell.id}
                style={id === 'title' ? ({ '--row-depth': depth } as CSSProperties) : undefined}
                className={id === 'title' ? classes.titleCell : undefined}
                data-cell-selected={cellSelected || undefined}
                aria-selected={cellSelected || undefined}
                onClickCapture={(event) => handleCellClick(event, row.id, columnId)}
              >
                {id === 'title' ? (
                  <Group gap={4} wrap="nowrap" style={{ minWidth: 0, width: '100%' }}>
                    {row.getCanExpand() ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={row.getIsExpanded() ? 'Replier les sous-tâches' : 'Déplier les sous-tâches'}
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
                    <table.FlexRender cell={cell} />
                  </Group>
                ) : (
                  <table.FlexRender cell={cell} />
                )}
              </Table.Td>
            );
          })
        }
      </SortableRow>
    );
  });

  // Each expanded group ends with its add row and subtotal; without groups, the add row ends the table.
  const body: ReactNode[] = [];
  let openGroup: { id: string; rows: DisplayRow[] } | null = null;
  visibleRows.forEach((row, index) => {
    if (row.original.kind === 'group') {
      if (openGroup) body.push(...groupEnd(openGroup.id, openGroup.rows));
      openGroup = row.getIsExpanded() ? { id: row.id, rows: row.original.children } : null;
    }
    body.push(tableRows[index]);
  });
  const lastGroup = openGroup as { id: string; rows: DisplayRow[] } | null;
  if (lastGroup) body.push(...groupEnd(lastGroup.id, lastGroup.rows));
  if (!grouped) {
    body.push(
      <AddTaskRow key="add" {...extraProps} defaults={{}} projectId={createProjectId} onOpenForm={onOpenCreateForm} />,
    );
  }

  return (
    // The drag context renders accessibility nodes: it must wrap the table, not sit inside it.
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
      <CellSelectionContext.Provider value={effectiveCellSelection}>
        {/* Scrolling both ways inside the height left by the page, its scrollbars counted in: the header stays on top. */}
        <div ref={fillRef} className={classes.scroller} style={{ maxHeight: fillHeight }}>
          <Table
            ref={tableRef}
            highlightOnHover
            stickyHeader
            verticalSpacing={4}
            className={classes.table}
            style={{ width: table.getTotalSize() }}
          >
            <Table.Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <SortableContext
                  key={headerGroup.id}
                  // Only rendered columns: hidden ones would skew the drop position.
                  items={order.filter((id) => !config.hiddenColumns.includes(id)).map((id) => `${COLUMN_PREFIX}${id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  <Table.Tr>
                    {headerGroup.headers.map((header) => {
                      const id = header.column.id;
                      if (id === SELECT_COLUMN || id === ACTIONS_COLUMN) {
                        return (
                          <Table.Th key={header.id} style={{ width: header.column.getSize() }} className={classes.header}>
                            <table.FlexRender header={header} />
                          </Table.Th>
                        );
                      }
                      const columnId = id as TaskColumn;
                      const sorted = header.column.getIsSorted();
                      return (
                        <SortableHeader key={header.id} id={columnId} width={header.column.getSize()} sorted={sorted}>
                          <Group gap={2} wrap="nowrap" className={classes.headerContent}>
                            <button
                              type="button"
                              className={classes.sortButton}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <table.FlexRender header={header} />
                              {sorted && (
                                <span className={classes.sortMark}>
                                  {sorted === 'asc' ? '↑' : '↓'}
                                  {config.sorting.length > 1 && <sub>{header.column.getSortIndex() + 1}</sub>}
                                </span>
                              )}
                            </button>
                            <span className={classes.headerMenu}>
                              <HeaderMenu
                                column={columnId}
                                config={config}
                                change={change}
                                order={order}
                                onSelectColumn={() => selectColumn(columnId)}
                                onFilter={() => onFilterColumn(columnId)}
                              />
                            </span>
                          </Group>
                          {header.column.getCanResize() && (
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={`Redimensionner la colonne ${COLUMN_LABELS[columnId]}`}
                              className={classes.resizer}
                              data-resizing={header.column.getIsResizing() || undefined}
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onDoubleClick={() => fitColumn(header.column.id, headerGroup.headers.indexOf(header), header.column.getSize(), () => header.column.resetSize())}
                            />
                          )}
                        </SortableHeader>
                      );
                    })}
                  </Table.Tr>
                </SortableContext>
              ))}
            </Table.Thead>
            <SortableContext items={dragItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <Table.Tbody>{body}</Table.Tbody>
            </SortableContext>
            <Table.Tfoot>
              <SummaryRow
                {...extraProps}
                effortIndex={effortIndex}
                trackedIndex={trackedIndex}
                {...summarize(rows, context)}
                total
              />
            </Table.Tfoot>
          </Table>
        </div>
      </CellSelectionContext.Provider>
    </DndContext>
  );
}

interface SortableHeaderProps {
  id: TaskColumn;
  width: number;
  sorted: false | 'asc' | 'desc';
  children: ReactNode;
}

/**
 * Column header, draggable to reorder the columns.
 * @param {SortableHeaderProps} props Component props.
 * @returns {JSX.Element} Header cell.
 */
function SortableHeader({ id, width, sorted, children }: SortableHeaderProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: `${COLUMN_PREFIX}${id}` });
  return (
    <Table.Th
      ref={setNodeRef}
      style={{ width, transform: CSS.Translate.toString(transform), transition }}
      className={classes.header}
      data-dragging={isDragging || undefined}
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
      title="Glisser pour déplacer la colonne"
      {...listeners}
    >
      {children}
    </Table.Th>
  );
}

interface SortableRowProps {
  id: string;
  disabled: boolean;
  /** Future parent of the dragged task. */
  dropTarget: boolean;
  active: boolean;
  archived: boolean;
  selected: boolean;
  /** Cells, receiving the drag handle to place in the first cell. */
  children: (handle: ReactNode) => ReactNode;
}

/**
 * Task row, draggable by its handle when manual reordering is enabled (with its sub-tasks, to another place
 * or level). Only the title opens the task.
 * @param {SortableRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function SortableRow({ id, disabled, dropTarget, active, archived, selected, children }: SortableRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = disabled ? (
    <span className={classes.handleSpacer} />
  ) : (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      className={classes.handle}
      aria-label="Déplacer la tâche (horizontalement pour changer de niveau)"
      {...attributes}
      {...listeners}
    >
      <DotsSixVerticalIcon aria-hidden />
    </ActionIcon>
  );
  return (
    <Table.Tr
      ref={setNodeRef}
      className={classes.row}
      // Vertical only: the level being chosen shows through the title indentation.
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      data-active={active || undefined}
      data-archived={archived || undefined}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-drop-target={dropTarget || undefined}
    >
      {children(handle)}
    </Table.Tr>
  );
}
