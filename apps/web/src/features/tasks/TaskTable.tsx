import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ActionIcon,
  Anchor,
  Badge,
  Checkbox,
  ColorSwatch,
  Group,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  TASK_COLUMNS,
  type TaskColumn,
  type TaskViewConfig,
} from "@ordo/shared";
import {
  CaretRightIcon,
  ChatCircleIcon,
  DotsSixVerticalIcon,
  LockIcon,
} from "@phosphor-icons/react";
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
} from "@tanstack/react-table";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { notifyError } from "../../lib/notify";
import { useMoveTask, type Task } from "./api";
import classes from "./TaskTable.module.css";
import { TaskRef } from "./task-ui";
import type { TaskContext } from "./use-task-context";
import {
  COLUMN_LABELS,
  COLUMN_SIZES,
  LOCKED_COLUMNS,
} from "./views/columns-meta";
import { AssigneesCell, DateCell, LabelCell } from "./views/inline-cells";
import type { DisplayRow, TaskRow } from "./views/task-rows";

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

const SELECT_COLUMN = "select";
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
});
const effortFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

/**
 * Applies a TanStack updater (value or function) to the current value.
 * @param {Updater<T>} updater Updater.
 * @param {T} current Current value.
 * @returns {T} Next value.
 */
function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater;
}

/**
 * Links to tasks by number ("#12, #13").
 * @param {object} props Component props.
 * @param {string[]} props.ids Task ids.
 * @param {TaskContext} props.context Task context.
 * @returns {JSX.Element} Links.
 */
function TaskNumbers({
  ids,
  context,
}: {
  ids: string[];
  context: TaskContext;
}) {
  const tasks = ids
    .map((id) => context.taskById.get(id))
    .filter((task) => task !== undefined);
  return (
    <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
      {tasks.map((task) => (
        <Tooltip key={task.id} label={task.title}>
          <Anchor
            component={Link}
            to={`/tasks/${task.number}`}
            size="sm"
            td={context.isClosed(task) ? "line-through" : undefined}
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
  /** User's day (YYYY-MM-DD), for overdue end dates. */
  today: string;
  selection: RowSelectionState;
  onSelectionChange: (selection: RowSelectionState) => void;
  /** Manual reordering by drag and drop (manual order, no grouping, pointer device). */
  dndEnabled: boolean;
}

/**
 * Task table of a view: resizable, reorderable and hideable columns, multi-sort from the headers,
 * expandable sub-tasks and groups, row selection, inline edits and drag-and-drop reordering.
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
  dndEnabled,
}: TaskTableProps) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { number: openNumber } = useParams();
  const moveTask = useMoveTask();
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const columns = useMemo(() => {
    const cells: Record<TaskColumn, (task: Task, row: TaskRow) => ReactNode> = {
      number: (task) => (
        <Text size="sm" c="dimmed" ff="monospace">
          {task.number}
        </Text>
      ),
      title: (task) => {
        const blocked = task.blockedByIds.some((id) => {
          const blocker = context.taskById.get(id);
          return blocker && !blocker.archived && !context.isClosed(blocker);
        });
        const children = context.childrenOf(task.id);
        return (
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            {blocked && (
              <Tooltip label="Bloquée par une tâche ouverte">
                <LockIcon
                  aria-label="Bloquée"
                  color="var(--mantine-color-red-6)"
                  style={{ flex: "none" }}
                />
              </Tooltip>
            )}
            <Anchor
              component={Link}
              to={{ pathname: `/tasks/${task.number}`, search }}
              size="sm"
              c="inherit"
              fw={500}
              td={context.isClosed(task) ? "line-through" : undefined}
              onClick={(event) => event.stopPropagation()}
              truncate
            >
              {task.title}
            </Anchor>
            {children.length > 0 && (
              <Text size="xs" c="dimmed" style={{ flex: "none" }}>
                {children.filter((child) => context.isClosed(child)).length}/
                {children.length}
              </Text>
            )}
          </Group>
        );
      },
      project: (task) => (
        <Text size="sm" truncate title={context.projectLabel(task.projectId)}>
          {context.projectById.get(task.projectId)?.title}
        </Text>
      ),
      status: (task) => (
        <LabelCell
          task={task}
          field="statusId"
          labels={context.statuses}
          name="Statut"
        />
      ),
      priority: (task) => (
        <LabelCell
          task={task}
          field="priorityId"
          labels={context.priorities}
          name="Priorité"
        />
      ),
      type: (task) => (
        <LabelCell
          task={task}
          field="typeId"
          labels={context.types}
          name="Type"
        />
      ),
      assignees: (task) => <AssigneesCell task={task} context={context} />,
      effort: (task) => (
        <Text size="sm">
          {task.effort === null ? "" : effortFormat.format(task.effort)}
        </Text>
      ),
      startDate: (task) => <DateCell task={task} field="startDate" />,
      endDate: (task) => (
        <DateCell
          task={task}
          field="endDate"
          alert={
            task.endDate !== null &&
            task.endDate < today &&
            !context.isClosed(task)
          }
        />
      ),
      parent: (task) => {
        const parent = task.parentId
          ? context.taskById.get(task.parentId)
          : undefined;
        return parent ? (
          <Text size="sm" truncate onClick={(event) => event.stopPropagation()}>
            <TaskRef task={parent} closed={context.isClosed(parent)} />
          </Text>
        ) : null;
      },
      blockedBy: (task) => (
        <TaskNumbers ids={task.blockedByIds} context={context} />
      ),
      blocking: (task) => (
        <TaskNumbers ids={task.blockingIds} context={context} />
      ),
      related: (task) => (
        <TaskNumbers ids={task.relatedIds} context={context} />
      ),
      comments: (task) =>
        task.commentCount > 0 ? (
          <Group gap={4} wrap="nowrap" c="dimmed">
            <ChatCircleIcon aria-hidden />
            <Text size="sm">{task.commentCount}</Text>
          </Group>
        ) : null,
      createdAt: (task) => (
        <Text size="sm">{dateTimeFormat.format(new Date(task.createdAt))}</Text>
      ),
      updatedAt: (task) => (
        <Text size="sm">{dateTimeFormat.format(new Date(task.updatedAt))}</Text>
      ),
    };

    return column.columns([
      column.display({
        id: SELECT_COLUMN,
        size: 64,
        enableResizing: false,
        enableHiding: false,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            size="xs"
            aria-label="Tout sélectionner"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: () => null,
      }),
      // An accessor makes the column sortable; values are not read (rows are sorted when built).
      ...TASK_COLUMNS.map((id) =>
        column.accessor(() => 0, {
          id,
          header: COLUMN_LABELS[id],
          size: COLUMN_SIZES[id],
          minSize: 60,
          enableHiding: !LOCKED_COLUMNS.includes(id),
          cell: ({ row }) =>
            row.original.kind === "task"
              ? cells[id](row.original.task, row.original)
              : null,
        }),
      ),
    ]);
  }, [context, today, search]);

  const columnVisibility = useMemo(
    () => Object.fromEntries(config.hiddenColumns.map((id) => [id, false])),
    [config.hiddenColumns],
  );
  const columnOrder = useMemo(
    () => [
      SELECT_COLUMN,
      ...config.columnOrder,
      ...TASK_COLUMNS.filter((id) => !config.columnOrder.includes(id)),
    ],
    [config.columnOrder],
  );

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
    enableRowSelection: (row) => row.original.kind === "task",
    enableSubRowSelection: false,
    columnResizeMode: "onChange",
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
        sorting: apply(
          updater,
          current.sorting as SortingState,
        ) as TaskViewConfig["sorting"],
      })),
    onColumnSizingChange: (updater) =>
      change((current) => {
        const sizing = apply(
          updater,
          current.columnSizing as ColumnSizingState,
        );
        // Rounded and clamped like the saved schema.
        return {
          ...current,
          columnSizing: Object.fromEntries(
            Object.entries(sizing).map(([id, size]) => [
              id,
              Math.min(1200, Math.max(40, Math.round(size))),
            ]),
          ),
        };
      }),
    onExpandedChange: (updater) =>
      setExpanded((current) => apply(updater, current)),
    onRowSelectionChange: (updater) =>
      onSelectionChange(apply(updater, selection)),
  });

  const visibleRows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const taskRowIds = visibleRows
    .filter((row) => row.original.kind === "task")
    .map((row) => row.id);
  const grouped = config.groupBy !== null;

  /**
   * Moves a dragged task among its siblings (same parent row): placed before the sibling now following it.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeRow = visibleRows.find((row) => row.id === active.id);
    const overRow = visibleRows.find((row) => row.id === over.id);
    if (!activeRow || !overRow || activeRow.parentId !== overRow.parentId) {
      notifyError(
        "Une tâche ne peut être déplacée que parmi les tâches du même niveau.",
      );
      return;
    }
    const siblings = visibleRows.filter(
      (row) =>
        row.parentId === activeRow.parentId && row.original.kind === "task",
    );
    const order = arrayMove(
      siblings,
      siblings.findIndex((row) => row.id === activeRow.id),
      siblings.findIndex((row) => row.id === overRow.id),
    );
    const next = order[order.findIndex((row) => row.id === activeRow.id) + 1];
    const taskId = (activeRow.original as TaskRow).task.id;
    moveTask.mutate(
      {
        id: taskId,
        beforeId: next ? (next.original as TaskRow).task.id : null,
      },
      { onError: (error) => notifyError(error.message) },
    );
  };

  const body = visibleRows.map((row) => {
    const original = row.original;
    if (original.kind === "group") {
      return (
        <Table.Tr key={row.id} className={classes.groupRow}>
          <Table.Td colSpan={visibleColumns.length}>
            <Group gap="xs" wrap="nowrap" className={classes.groupLabel}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={
                  row.getIsExpanded()
                    ? "Replier le groupe"
                    : "Déplier le groupe"
                }
                aria-expanded={row.getIsExpanded()}
                onClick={row.getToggleExpandedHandler()}
              >
                <CaretRightIcon
                  className={classes.chevron}
                  data-expanded={row.getIsExpanded() || undefined}
                  aria-hidden
                />
              </ActionIcon>
              {original.color && (
                <ColorSwatch color={original.color} size={10} />
              )}
              <Text size="sm" fw={600}>
                {original.label}
              </Text>
              <Badge size="sm" variant="light" color="gray" circle>
                {original.count}
              </Badge>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    }
    return (
      <SortableRow
        key={row.id}
        id={row.id}
        disabled={!dndEnabled}
        active={String(original.task.number) === openNumber}
        archived={original.task.archived}
        selected={row.getIsSelected()}
        onOpen={() =>
          navigate({ pathname: `/tasks/${original.task.number}`, search })
        }
      >
        {(handle) =>
          row.getVisibleCells().map((cell) => {
            const id = cell.column.id;
            if (id === SELECT_COLUMN) {
              return (
                <Table.Td
                  key={cell.id}
                  onClick={(event) => event.stopPropagation()}
                >
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
            const depth = row.depth - (grouped ? 1 : 0);
            return (
              <Table.Td
                key={cell.id}
                style={
                  id === "title"
                    ? ({ "--row-depth": depth } as CSSProperties)
                    : undefined
                }
                className={id === "title" ? classes.titleCell : undefined}
              >
                {id === "title" ? (
                  <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                    {row.getCanExpand() ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={
                          row.getIsExpanded()
                            ? "Replier les sous-tâches"
                            : "Déplier les sous-tâches"
                        }
                        aria-expanded={row.getIsExpanded()}
                        onClick={(event) => {
                          event.stopPropagation();
                          row.toggleExpanded();
                        }}
                      >
                        <CaretRightIcon
                          className={classes.chevron}
                          data-expanded={row.getIsExpanded() || undefined}
                          aria-hidden
                        />
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

  return (
    // The drag context renders accessibility nodes: it must wrap the table, not sit inside it.
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Table.ScrollContainer minWidth={table.getTotalSize()}>
        <Table
          highlightOnHover
          stickyHeader
          verticalSpacing={4}
          className={classes.table}
          style={{ width: table.getTotalSize() }}
        >
          <Table.Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortIndex = header.column.getSortIndex();
                  const canSort = header.column.getCanSort();
                  return (
                    <Table.Th
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className={classes.header}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={classes.sortButton}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted && (
                            <span className={classes.sortMark}>
                              {sorted === "asc" ? "↑" : "↓"}
                              {config.sorting.length > 1 && (
                                <sub>{sortIndex + 1}</sub>
                              )}
                            </span>
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                      {header.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Redimensionner la colonne ${String(header.column.columnDef.header)}`}
                          className={classes.resizer}
                          data-resizing={
                            header.column.getIsResizing() || undefined
                          }
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                        />
                      )}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Thead>
          <SortableContext
            items={taskRowIds}
            strategy={verticalListSortingStrategy}
          >
            <Table.Tbody>{body}</Table.Tbody>
          </SortableContext>
        </Table>
      </Table.ScrollContainer>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  disabled: boolean;
  active: boolean;
  archived: boolean;
  selected: boolean;
  onOpen: () => void;
  /** Cells, receiving the drag handle to place in the first cell. */
  children: (handle: ReactNode) => ReactNode;
}

/**
 * Task row, draggable by its handle when manual reordering is enabled.
 * @param {SortableRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function SortableRow({
  id,
  disabled,
  active,
  archived,
  selected,
  onOpen,
  children,
}: SortableRowProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const handle = disabled ? (
    <span className={classes.handleSpacer} />
  ) : (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      className={classes.handle}
      aria-label="Déplacer la tâche"
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
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-active={active || undefined}
      data-archived={archived || undefined}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      onClick={onOpen}
    >
      {children(handle)}
    </Table.Tr>
  );
}
