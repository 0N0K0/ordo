import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { ActionIcon, Badge, Checkbox, ColorSwatch, Group, Menu, Paper, Stack, Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { entrySeconds, formatClock, formatDuration, routineSchema } from '@ordo/shared';
import {
  ArchiveIcon,
  ArrowBendUpRightIcon,
  ArrowCounterClockwiseIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  DotsSixVerticalIcon,
  DotsThreeVerticalIcon,
  HourglassMediumIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  TrashIcon,
  TreeViewIcon,
} from '@phosphor-icons/react';
import type { ColumnLayout, TableSort } from '@ordo/shared';
import { useEffect, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { ColumnsMenu } from '../../components/data-table/ColumnsMenu';
import { shownColumns, tableWidth, type DataColumn, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { Link } from 'react-router';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import addClasses from '../tasks/views/table-extras.module.css';
import type { TaskContext } from '../tasks/use-task-context';
import { useRunningTimer, useTimeMutations, type TimeEntry } from '../time/api';
import { useNow } from '../time/use-now';
import { useStopTimer } from '../time/use-stop-timer';
import { confirmDestructive } from '../shopping/list-modals';
import { useRoutineMutations, type Routine, type RoutineCategory, type RoutinePlace } from './api';
import { AssigneesCell, CategoriesCell, TimeWindowCell, EstimateCell, ProjectCell, RepetitionCell, RepetitionText, RequiresCell, TitleCell } from './routine-cells';
import { RoutineCellSelectionContext, type RoutineCellSelection, type RoutineColumn } from './routine-cell-edit';
import { RoutineBulkBar } from './RoutineBulkBar';
import { RoutineDoneToggles } from './DoneToggle';
import { openRoutineForm } from './open-routine-form';
import { openRoutineMove } from './open-routine-move';
import { usePostponeRoutine } from './use-routine-move';
import {
  DAILY,
  isDone,
  type RoutineGrouping,
  movableOccurrence,
  moveTo,
  NO_CATEGORY,
  routineRows,
  scheduleOf,
  stateOf,
  visibleRoutineRows,
  waitingFor,
  windowOf,
  windowText,
  type RoutineRow,
} from './routine-format';
import classes from './Routines.module.css';

/** Columns of the table. */
/** Width of the cells around the columns: handle and selection before, actions after. */
const LEAD_WIDTH = 64;
const ACTIONS_WIDTH = 48;

/** Columns of the routine table (ids: the sort keys of the views, when sortable). */
const ROUTINE_COLUMNS: DataColumn<Routine>[] = [
  { id: 'title', label: 'Routine', size: 320, locked: true, sortValue: () => null },
  { id: 'currentDate', label: 'Échéance', size: 200, sortValue: () => null },
  { id: 'firstDate', label: 'Première échéance', size: 150, sortValue: () => null },
  { id: 'nextDate', label: 'Échéance suivante', size: 150, hiddenByDefault: true, sortValue: () => null },
  { id: 'repetition', label: 'Répétition', size: 200, hiddenByDefault: true, sortValue: () => null },
  { id: 'estimate', label: 'Temps estimé', size: 110, sortValue: () => null },
  { id: 'time', label: 'Horaires', size: 150 },
  { id: 'trackedTime', label: 'Chrono', size: 120, sortValue: () => null },
  { id: 'lastDoneAt', label: 'Faite pour la dernière fois', size: 170, hiddenByDefault: true, sortValue: () => null },
  { id: 'assignees', label: 'Assignés', size: 160, sortValue: () => null },
  { id: 'categories', label: 'Catégories', size: 180, sortValue: () => null },
  { id: 'requires', label: 'Dépend de', size: 180 },
  { id: 'project', label: 'Projet', size: 180, sortValue: () => null },
];

/** Bulk-editable columns and their cell selection column. */
const CELL_COLUMNS: Record<string, RoutineColumn> = {
  currentDate: 'repetition',
  estimate: 'estimate',
  time: 'time',
  assignees: 'assignees',
  categories: 'categories',
  requires: 'requires',
  project: 'project',
};

const lastDoneFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Short date of a calendar date: "lun. 10 nov.".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
const dayText = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

/** What a routine is dropped on: a category heading (or the one without), or another routine. */
type DropData = { kind: 'group'; categoryId: string | null } | { kind: 'routine'; routine: Routine; groupId: string | null };

/** Routine dragged, with the category it is dragged from. */
interface DragData {
  routine: Routine;
  groupId: string | null;
}

/**
 * Categories of a routine moved from a category to another: the one it leaves is replaced by the one it goes to (none:
 * without any category).
 * @param {string[]} categoryIds Its categories.
 * @param {string | null} from Category it leaves.
 * @param {string | null} to Category it goes to.
 * @returns {string[]} New categories.
 */
function movedCategories(categoryIds: string[], from: string | null, to: string | null): string[] {
  if (to === null) return [];
  return [...new Set([...categoryIds.filter((id) => id !== from), to])];
}

/**
 * Where a dragged routine goes: the heading or row under the pointer; with the keyboard, the closest one.
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

/**
 * Badge of a routine due today: past its latest time (late), time to leave (its way there has started), or its time window
 * (grey before it opens).
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Badge.
 */
function DueBadge({ routine }: { routine: Routine }) {
  const now = new Date().toTimeString().slice(0, 5);
  const { fromTime, dueTime } = windowOf(routine);
  const { leaveAt } = scheduleOf(routine);
  if (dueTime && now > dueTime) {
    return (
      <Badge variant="light" color="red" tt="none">
        Après {dueTime}
      </Badge>
    );
  }
  if (leaveAt && now >= leaveAt) {
    return (
      <Badge variant="filled" color="orange" tt="none">
        Partir maintenant
      </Badge>
    );
  }
  const window = windowText({ fromTime, dueTime });
  return (
    <Badge variant="light" color={fromTime && now < fromTime ? 'gray' : undefined} tt="none">
      Aujourd’hui{window ? ` ${window}` : ''}
    </Badge>
  );
}

/**
 * Where a routine stands today: due, late since a date, done, or its next date.
 * @param {{ routine: Routine, today: string }} props Component props.
 * @returns {JSX.Element} Badge or text.
 */
function StateCell({ routine, today }: { routine: Routine; today: string }) {
  const state = stateOf(routine, today);
  const next = routine.nextDate ? `Prochaine fois : ${dayText(routine.nextDate)}` : 'Plus d’occurrence à venir';
  // The occurrence shown comes from another day (an exception).
  const moved = moveTo(routine, state === 'upcoming' ? routine.nextDate : routine.currentDate);
  const label = moved ? `${next} · ${moved.to > moved.from ? 'reportée' : 'avancée'} (prévue le ${dayText(moved.from)})` : next;
  return (
    <Tooltip label={label}>
      <span className={classes.nowrap}>
        {moved && <ArrowBendUpRightIcon aria-label={moved.to > moved.from ? 'Reportée' : 'Avancée'} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
        {state === 'done' && (
          <Badge variant="light" color="green" tt="none">
            Fait
          </Badge>
        )}
        {state === 'due' && <DueBadge routine={routine} />}
        {state === 'late' && (
          <Badge variant="light" color="orange" tt="none">
            Depuis {dayText(routine.currentDate!)}
          </Badge>
        )}
        {state === 'upcoming' && (
          <Text size="xs" c="dimmed" className={classes.nowrap}>
            {routine.nextDate ? dayText(routine.nextDate) : '—'}
          </Text>
        )}
      </span>
    </Tooltip>
  );
}

/**
 * Chrono of a routine: its tracked time, and a button starting the timer on it (or stopping it while it runs on it).
 * @param {{ routine: Routine, running: TimeEntry | null | undefined }} props Component props.
 * @returns {JSX.Element} Cell.
 */
function ChronoCell({ routine, running }: { routine: Routine; running: TimeEntry | null | undefined }) {
  const { start } = useTimeMutations();
  const { stopTimer, isPending } = useStopTimer();
  const mine = running?.routineId === routine.id ? running : null;
  const now = useNow(Boolean(mine) && !mine?.pausedAt);
  return (
    <Group gap={4} wrap="nowrap">
      {mine ? (
        <Tooltip label="Arrêter le chrono">
          <ActionIcon variant="light" color="red" size="sm" loading={isPending} aria-label={`Arrêter le chrono de ${routine.title}`} onClick={() => stopTimer(mine)}>
            <StopIcon weight="fill" aria-hidden />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label={running ? 'Démarrer le chrono (celui en cours s’arrête)' : 'Démarrer le chrono'}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            loading={start.isPending}
            disabled={routine.archived}
            aria-label={`Démarrer le chrono de ${routine.title}`}
            onClick={() => start.mutate({ routineId: routine.id, taskIds: [] }, { onSuccess: () => notifySuccess('Chrono démarré.'), onError: (error) => notifyError(error.message) })}
          >
            <PlayIcon weight="fill" aria-hidden />
          </ActionIcon>
        </Tooltip>
      )}
      <Text size="xs" c={mine ? undefined : 'dimmed'} className={classes.nowrap}>
        {mine ? formatClock(entrySeconds(mine, now)) : routine.trackedSeconds ? formatDuration(routine.trackedSeconds) : ''}
      </Text>
    </Group>
  );
}

interface GroupRowProps {
  /** Cells it spans. */
  span: number;
  /** A routine dropped on it moves into it (category groups). */
  receives: boolean;
  row: Extract<RoutineRow, { kind: 'group' }>;
  today: string;
  collapsed: boolean;
  /** A routine is dragged over it. */
  over: boolean;
  onToggle: () => void;
}

/**
 * Heading of a category (indented as its tree), folding its routines; a routine dropped on it moves into it.
 * @param {GroupRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function GroupRow({ span, receives, row, today, collapsed, over, onToggle }: GroupRowProps) {
  const { setNodeRef } = useDroppable({ id: `group:${row.id ?? NO_CATEGORY}`, data: { kind: 'group', categoryId: row.id } satisfies DropData, disabled: !receives });
  const left = row.routines.filter((routine) => !routine.archived && ['due', 'late'].includes(stateOf(routine, today))).length;
  return (
    <Table.Tr ref={setNodeRef} className={classes.groupRow} data-depth={row.depth} data-over={over || undefined}>
      <Table.Td colSpan={span} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` }}>
        <UnstyledButton onClick={onToggle} aria-expanded={!collapsed}>
          <Group gap="xs" wrap="nowrap">
            {collapsed ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
            {row.color && <ColorSwatch color={row.color} size={12} />}
            <Text size="sm" fw={row.depth === 0 ? 700 : 600}>
              {row.name}
            </Text>
            <Badge size="sm" variant={left ? 'filled' : 'light'} color={left ? undefined : 'green'} aria-label={`${left} à faire`}>
              {left}
            </Badge>
          </Group>
        </UnstyledButton>
      </Table.Td>
    </Table.Tr>
  );
}

interface RoutineRowProps {
  row: Extract<RoutineRow, { kind: 'routine' }>;
  routines: Routine[];
  byId: Map<string, Routine>;
  context: TaskContext;
  today: string;
  running: TimeEntry | null | undefined;
  collapsed: boolean;
  /** Where the dragged routine would go on it (before, after or under it), null when not over it. */
  drop: RoutinePlace | null;
  /** It can be moved by drag and drop (manual order). */
  movable: boolean;
  /** Columns shown. */
  shown: ShownColumn<Routine>[];
  onToggle: () => void;
  categories: RoutineCategory[];
  /** Checked in the row selection (bulk actions). */
  selected: boolean;
  onSelect: (selected: boolean) => void;
  /** Props of a bulk-editable cell: its selected state and the Ctrl / Shift + click selecting it. */
  cell: (column: RoutineColumn) => ComponentProps<'td'>;
}

/**
 * Row of a routine: moved by its handle (before, after or under another routine, or into a category), ticked for its current occurrence,
 * edited in place.
 * @param {RoutineRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function RoutineRowView({ row, routines, byId, context, today, running, collapsed, drop, movable, shown, onToggle, categories, selected, onSelect, cell }: RoutineRowProps) {
  const postpone = usePostponeRoutine();
  const { routine, depth, children } = row;
  const { setArchived, remove } = useRoutineMutations();
  const {
    setNodeRef: setDragRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({
    id: row.key,
    data: { routine, groupId: row.groupId } satisfies DragData,
    disabled: routine.archived || !movable,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: `routine:${row.key}`, data: { kind: 'routine', routine, groupId: row.groupId } satisfies DropData });
  const done = isDone(routine);
  const waiting = waitingFor(routine, byId);
  const readOnly = routine.archived;
  const cells: Record<string, ReactNode> = {
    title: (
      <Group gap={4} wrap="nowrap">
        {children > 0 ? (
          <ActionIcon variant="subtle" color="gray" size="xs" aria-label={collapsed ? `Déplier ${routine.title}` : `Plier ${routine.title}`} aria-expanded={!collapsed} onClick={onToggle}>
            {collapsed ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
          </ActionIcon>
        ) : (
          depth > 0 && <span style={{ width: 'var(--ai-size-xs, 18px)', flexShrink: 0 }} />
        )}
        <RoutineDoneToggles routine={routine} dateLabel={routine.currentDate ? dayText(routine.currentDate) : undefined} disabled={readOnly} />
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <TitleCell routine={routine} readOnly={readOnly} />
          <RepetitionText routine={routine} />
        </Stack>
        {waiting.length > 0 && !done && (
          <Tooltip label={`En attente de : ${waiting.map((item) => item.title).join(', ')}`}>
            <HourglassMediumIcon aria-label="En attente" color="var(--mantine-color-orange-6)" />
          </Tooltip>
        )}
      </Group>
    ),
    currentDate: (
      <RepetitionCell routine={routine} readOnly={readOnly}>
        <StateCell routine={routine} today={today} />
      </RepetitionCell>
    ),
    firstDate: routine.firstDate ? (
      <Text size="sm" className={classes.nowrap}>
        {dayText(String(routine.firstDate))}
      </Text>
    ) : null,
    nextDate: routine.nextDate ? (
      <Text size="sm" className={classes.nowrap}>
        {dayText(String(routine.nextDate))}
      </Text>
    ) : null,
    lastDoneAt: routine.lastDoneAt ? (
      <Text size="sm" className={classes.nowrap}>
        {lastDoneFormat.format(new Date(String(routine.lastDoneAt)))}
      </Text>
    ) : null,
    repetition: <RepetitionText routine={routine} />,
    estimate: <EstimateCell routine={routine} readOnly={readOnly} />,
    time: <TimeWindowCell routine={routine} readOnly={readOnly} />,
    trackedTime: <ChronoCell routine={routine} running={running} />,
    assignees: <AssigneesCell routine={routine} readOnly={readOnly} context={context} />,
    categories: <CategoriesCell routine={routine} readOnly={readOnly} categories={categories} />,
    requires: <RequiresCell routine={routine} readOnly={readOnly} routines={routines} />,
    project: <ProjectCell routine={routine} readOnly={readOnly} context={context} />,
  };

  return (
    <Table.Tr
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={classes.row}
      data-drop={drop ?? undefined}
      data-dragging={isDragging || undefined}
      data-done={done || undefined}
      data-archived={routine.archived || undefined}
    >
      <Table.Td w={56} px={4}>
        <Group gap={2} wrap="nowrap">
          {!readOnly && movable ? (
            <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${routine.title}`} className={classes.handle} {...attributes} {...listeners}>
              <DotsSixVerticalIcon weight="bold" aria-hidden />
            </ActionIcon>
          ) : (
            <span style={{ width: 'var(--ai-size-sm, 22px)', flexShrink: 0 }} />
          )}
          <Checkbox size="xs" className={classes.select} aria-label={`Sélectionner ${routine.title}`} checked={selected} onChange={(event) => onSelect(event.currentTarget.checked)} />
        </Group>
      </Table.Td>
      {shown.map((column, index) => {
        const props = column.id in CELL_COLUMNS ? cell(CELL_COLUMNS[column.id]) : {};
        return (
          <Table.Td
            key={column.id}
            {...props}
            className={tableClasses.cell}
            style={index === 0 ? { paddingLeft: `calc(var(--mantine-spacing-xs) + ${Math.max(0, depth - 1)} * var(--mantine-spacing-lg))` } : undefined}
          >
            {cells[column.id]}
          </Table.Td>
        );
      })}
      <Table.Td w={1}>
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions de ${routine.title}`}>
              <DotsThreeVerticalIcon weight="bold" aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!readOnly && (
              <>
                <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openRoutineForm({ routine })}>
                  Modifier
                </Menu.Item>
                <Menu.Item leftSection={<TreeViewIcon aria-hidden />} onClick={() => openRoutineForm({ parent: routine })}>
                  Ajouter une sous-routine
                </Menu.Item>
                {movableOccurrence(routine) && (
                  <>
                    <Menu.Divider />
                    <Menu.Item leftSection={<ArrowBendUpRightIcon aria-hidden />} onClick={() => postpone(routine)}>
                      Reporter au lendemain
                    </Menu.Item>
                    <Menu.Item leftSection={<CalendarDotsIcon aria-hidden />} onClick={() => openRoutineMove(routine)}>
                      Reporter ou avancer…
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
              </>
            )}
            <Menu.Item leftSection={<CopyIcon aria-hidden />} onClick={() => openRoutineForm({ routine, copy: true })}>
              Dupliquer
            </Menu.Item>
            <Menu.Item leftSection={<ClockCounterClockwiseIcon aria-hidden />} component={Link} to={`/routines?tab=history&routine=${routine.id}`}>
              Historique
            </Menu.Item>
            <Menu.Item
              leftSection={readOnly ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
              onClick={() =>
                setArchived.mutate(
                  { id: routine.id, archived: !routine.archived },
                  { onSuccess: () => notifySuccess(routine.archived ? 'Routine restaurée.' : 'Routine archivée.'), onError: (error) => notifyError(error.message) },
                )
              }
            >
              {readOnly ? 'Restaurer' : 'Archiver'}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<TrashIcon aria-hidden />}
              onClick={() =>
                confirmDestructive(
                  'Supprimer la routine',
                  `« ${routine.title} » sera supprimée définitivement avec l’historique de ses coches. Ses sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible.`,
                  () => remove.mutate(routine.id, { onSuccess: () => notifySuccess('Routine supprimée.'), onError: (error) => notifyError(error.message) }),
                )
              }
            >
              Supprimer
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Row at the end of a category (or of the table): a title typed then Enter adds a routine in it, every day from today.
 * @param {{ categoryId: string | null, projectId: string | null, depth: number, groupName: string }} props Component props (the
 *   category and the project of the routines added).
 * @returns {JSX.Element} Row.
 */
function AddRoutineRow({ span, categoryId, projectId, depth, groupName }: { span: number; categoryId: string | null; projectId: string | null; depth: number; groupName: string }) {
  const { create } = useRoutineMutations();
  const [title, setTitle] = useState('');

  /**
   * Creates the typed routine, then stays ready for the next one.
   * @returns {void}
   */
  const submit = () => {
    const result = routineSchema.shape.title.safeParse(title);
    if (!result.success) {
      if (title.trim()) notifyError(result.error.issues[0]?.message ?? 'Titre invalide.');
      return;
    }
    create.mutate(
      {
        title: result.data,
        description: null,
        categoryIds: categoryId ? [categoryId] : [],
        parentId: null,
        startDate: localToday(),
        recurrence: DAILY,
        estimate: null,
        projectId,
        assigneeIds: [],
        requiredIds: [],
      },
      { onSuccess: () => setTitle(''), onError: (error) => notifyError(error.message) },
    );
  };

  return (
    <Table.Tr className={addClasses.addRow}>
      <Table.Td />
      <Table.Td colSpan={span - 1} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${Math.max(0, depth - 1)} * var(--mantine-spacing-lg))` }}>
        <TextInput
          variant="unstyled"
          size="xs"
          classNames={{ input: addClasses.addInput }}
          leftSection={<PlusIcon aria-hidden />}
          placeholder="Ajouter une routine (tous les jours ; Entrée pour valider)"
          aria-label={`Ajouter une routine dans ${groupName}`}
          value={title}
          disabled={create.isPending}
          onChange={(event) => setTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') setTitle('');
          }}
          w={420}
          maw="100%"
        />
      </Table.Td>
    </Table.Tr>
  );
}

interface RoutineTableProps {
  /** Every routine (for the dependencies). */
  routines: Routine[];
  categories: RoutineCategory[];
  context: TaskContext;
  /** Routines shown, in their order (as rows: without parent when the sub-routines are flat). */
  layout: Routine[];
  /** Routines shown (the others stay when one of their sub-routines is). */
  keep: (routine: Routine) => boolean;
  /** Groups of the rows, null for none. */
  grouping: RoutineGrouping | null;
  /** Routines move by drag and drop (manual order). */
  reorderable: boolean;
  /** A routine dropped on a group, or next to a routine of another group, moves into it (category groups). */
  groupDrop: boolean;
  /** Routines can be added in the groups (category groups, or none). */
  addable: boolean;
  /** Columns (order, hidden ones, widths) and their change. */
  columns: ColumnLayout;
  onColumnsChange: (layout: ColumnLayout) => void;
  /** Sorts of the view and their change (a click on a header). */
  sorting: readonly TableSort[];
  onSortingChange: (sorting: TableSort[]) => void;
  /** Project of the routines added (on a project page). Optional. */
  projectId?: string | null;
}

/**
 * Routines as a table: the categories as their tree, each followed by its routines, sub-routines under their parent;
 * categories and parent routines fold. A routine is dragged before, after or under another one, or into a category.
 * @param {RoutineTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function RoutineTable({
  routines,
  layout,
  categories,
  context,
  keep,
  grouping,
  reorderable,
  groupDrop,
  addable,
  projectId = null,
  columns,
  onColumnsChange,
  sorting,
  onSortingChange,
}: RoutineTableProps) {
  const shownCols = shownColumns(ROUTINE_COLUMNS, columns);
  const span = shownCols.length + 2;
  const tableRef = useRef<HTMLTableElement>(null);
  const { patch, move } = useRoutineMutations();
  const { data: running } = useRunningTimer();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [draggedRow, setDragged] = useState<DragData | null>(null);
  const dragged = draggedRow?.routine ?? null;
  const [drop, setDrop] = useState<{ id: string; place: RoutinePlace } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const today = localToday();
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const rows = routineRows(layout, grouping, keep);
  const shown = visibleRoutineRows(rows, collapsed);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [cellSelection, setCellSelection] = useState<{ column: RoutineColumn; rowKeys: string[] } | null>(null);
  const anchorRow = useRef<string | null>(null);

  // Only shown routines stay selected (filtered-out or folded ones are never edited).
  const routineRowsShown = shown.filter((row): row is Extract<RoutineRow, { kind: 'routine' }> => row.kind === 'routine');
  const rowKeys = routineRowsShown.map((row) => row.key);
  const routineOfRow = new Map(routineRowsShown.map((row) => [row.key, row.routine.id]));
  const shownIds = new Set(routineOfRow.values());
  const selectedRoutines = routines.filter((routine) => selected.has(routine.id) && shownIds.has(routine.id));
  const shownKeys = cellSelection?.rowKeys.filter((key) => routineOfRow.has(key)) ?? [];
  const effectiveCellSelection: RoutineCellSelection | null =
    cellSelection && shownKeys.length > 0 ? { ...cellSelection, rowKeys: shownKeys, routineIds: [...new Set(shownKeys.map((key) => routineOfRow.get(key)!))] } : null;

  // Escape clears the cell selection.
  useEffect(() => {
    if (!cellSelection) return;
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && setCellSelection(null);
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cellSelection]);

  /**
   * Cell selection with the keyboard modifiers: Ctrl / ⌘ + click toggles a cell, Shift + click selects a range in the
   * column. A plain click outside the selection clears it.
   * @param {MouseEvent} event Click event (capture phase, before the cell editor).
   * @param {string} rowKey Row key.
   * @param {RoutineColumn} column Column.
   * @returns {void}
   */
  const handleCellClick = (event: MouseEvent, rowKey: string, column: RoutineColumn) => {
    const modifier = event.ctrlKey || event.metaKey || event.shiftKey;
    if (!modifier) {
      if (effectiveCellSelection && !(effectiveCellSelection.column === column && effectiveCellSelection.rowKeys.includes(rowKey))) setCellSelection(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sameColumn = effectiveCellSelection?.column === column ? effectiveCellSelection.rowKeys : [];
    let keys: string[];
    if (event.shiftKey && anchorRow.current && rowKeys.includes(anchorRow.current)) {
      const [from, to] = [rowKeys.indexOf(anchorRow.current), rowKeys.indexOf(rowKey)].sort((a, b) => a - b);
      keys = [...new Set([...sameColumn, ...rowKeys.slice(from, to + 1)])];
    } else {
      keys = sameColumn.includes(rowKey) ? sameColumn.filter((key) => key !== rowKey) : [...sameColumn, rowKey];
      anchorRow.current = rowKey;
    }
    setCellSelection(keys.length ? { column, rowKeys: keys } : null);
  };

  /**
   * Props of a bulk-editable cell of a row.
   * @param {string} rowKey Row key.
   * @returns {(column: RoutineColumn) => ComponentProps<'td'>} Props by column.
   */
  const cellOf =
    (rowKey: string) =>
    (column: RoutineColumn): ComponentProps<'td'> => {
      const cellSelected = effectiveCellSelection?.column === column && effectiveCellSelection.rowKeys.includes(rowKey);
      return {
        'data-cell-selected': cellSelected || undefined,
        'aria-selected': cellSelected || undefined,
        onClickCapture: (event) => handleCellClick(event.nativeEvent, rowKey, column),
      } as ComponentProps<'td'>;
    };

  /**
   * Checks or unchecks routines in the row selection.
   * @param {string[]} ids Routine ids.
   * @param {boolean} checked Target state.
   * @returns {void}
   */
  const select = (ids: string[], checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const allSelected = shownIds.size > 0 && [...shownIds].every((id) => selected.has(id));

  /**
   * Folds or unfolds a category or a routine.
   * @param {string} key Category id (NO_CATEGORY for none) or routine row key.
   * @returns {void}
   */
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /**
   * Whether the dragged routine can go before, after or under a routine: never next to or under itself or one of its
   * sub-routines (it would be its own parent), nor under its parent already.
   * @param {Routine} moved Dragged routine.
   * @param {Routine} target Routine dropped on.
   * @param {RoutinePlace} place Where.
   * @returns {boolean} Allowed.
   */
  const canPlace = (moved: Routine, target: Routine, place: RoutinePlace) => {
    if (moved.id === target.id || target.archived) return false;
    if (place === 'INSIDE' && moved.parentId === target.id) return false;
    for (let current: Routine | undefined = target; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
      if (current.id === moved.id) return false;
    }
    return true;
  };

  /**
   * Updates where the dragged routine would go, from the pointer over a row: its top third before it, its bottom third
   * after it, the middle under it (with the keyboard: under it).
   * @param {DragMoveEvent | DragOverEvent} event Drag event.
   * @returns {void}
   */
  const handleDragMove = ({ over, activatorEvent, delta }: DragMoveEvent | DragOverEvent) => {
    const target = over?.data.current as DropData | undefined;
    if (!over || !target) return setDrop(null);
    if (target.kind === 'group') return setDrop((current) => (current?.id === over.id ? current : { id: String(over.id), place: 'INSIDE' }));
    const pointer = 'clientY' in activatorEvent ? (activatorEvent as PointerEvent).clientY + delta.y : null;
    const ratio = pointer === null ? 0.5 : (pointer - over.rect.top) / Math.max(1, over.rect.height);
    const place: RoutinePlace = ratio < 0.3 ? 'BEFORE' : ratio > 0.7 ? 'AFTER' : 'INSIDE';
    setDrop((current) => (current?.id === over.id && current.place === place ? current : { id: String(over.id), place }));
  };

  /**
   * Moves the dropped routine before, after or under the routine it was dropped on, or into the category.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const place = drop?.place ?? 'INSIDE';
    setDragged(null);
    setDrop(null);
    const source = active.data.current as DragData | undefined;
    const target = over?.data.current as DropData | undefined;
    if (!source || !target) return;
    const moved = source.routine;
    const onError = (error: Error) => notifyError(error.message);
    if (target.kind === 'routine') {
      if (!canPlace(moved, target.routine, place)) return;
      // Next to a top routine of another category: it moves to that category.
      const changesCategory = groupDrop && place !== 'INSIDE' && target.routine.parentId === null && target.groupId !== source.groupId;
      const categoryIds = changesCategory ? movedCategories(moved.categoryIds, source.groupId, target.groupId) : null;
      move.mutate({ id: moved.id, targetId: target.routine.id, place, categoryIds }, { onError });
      return;
    }
    if (moved.parentId === null && source.groupId === target.categoryId) return;
    patch.mutate({ id: moved.id, input: { parentId: null, categoryIds: movedCategories(moved.categoryIds, source.groupId, target.categoryId) } }, { onError });
  };

  /**
   * Where the dragged routine would go on a row, if it is the one under the pointer and the move is allowed.
   * @param {Extract<RoutineRow, { kind: 'routine' }>} row Row.
   * @returns {RoutinePlace | null} Place.
   */
  const dropOn = (row: Extract<RoutineRow, { kind: 'routine' }>): RoutinePlace | null =>
    dragged !== null && drop?.id === `routine:${row.key}` && canPlace(dragged, row.routine, drop.place) ? drop.place : null;

  /**
   * Rows of the body, with the "add" row at the end of each unfolded category.
   * @returns {JSX.Element[]} Rows.
   */
  const body = () => {
    const out: ReactElement[] = [];
    shown.forEach((row, index) => {
      if (row.kind === 'group') {
        const key = row.id ?? NO_CATEGORY;
        out.push(
          <GroupRow
            key={`group:${key}`}
            span={span}
            receives={groupDrop}
            row={row}
            today={today}
            collapsed={collapsed.has(key)}
            over={dragged !== null && drop?.id === `group:${key}`}
            onToggle={() => toggle(key)}
          />,
        );
      } else {
        out.push(
          <RoutineRowView
            key={row.key}
            row={row}
            routines={routines}
            byId={byId}
            context={context}
            today={today}
            running={running}
            collapsed={collapsed.has(row.key)}
            drop={dropOn(row)}
            movable={reorderable}
            shown={shownCols}
            onToggle={() => toggle(row.key)}
            categories={categories}
            selected={selected.has(row.routine.id)}
            onSelect={(checked) => select([row.routine.id], checked)}
            cell={cellOf(row.key)}
          />,
        );
      }
      // End of the own routines of a category: the next row is a heading (or the end).
      const next = shown[index + 1];
      if (!addable || (next && next.kind !== 'group')) return;
      const group = shown
        .slice(0, index + 1)
        .reverse()
        .find((item): item is Extract<RoutineRow, { kind: 'group' }> => item.kind === 'group');
      if (!group || collapsed.has(group.id ?? NO_CATEGORY)) return;
      out.push(<AddRoutineRow key={`add:${group.id ?? NO_CATEGORY}`} span={span} categoryId={group.id} projectId={projectId} depth={group.depth + 1} groupName={group.name} />);
    });
    if (addable && !rows.some((row) => row.kind === 'group')) out.push(<AddRoutineRow key="add" span={span} categoryId={null} projectId={projectId} depth={0} groupName="les routines" />);
    return out;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active }) => setDragged((active.data.current as DragData | undefined) ?? null)}
      onDragOver={handleDragMove}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null);
        setDrop(null);
      }}
    >
      <div className={classes.scroller}>
        <Table
          ref={tableRef}
          className={`${classes.table} ${tableClasses.table}`}
          style={{ width: tableWidth(shownCols, LEAD_WIDTH + ACTIONS_WIDTH), minWidth: '100%' }}
          data-selecting={selectedRoutines.length > 0 || undefined}
          verticalSpacing={4}
          aria-label="Routines"
        >
          <DataTableHeader
            columns={ROUTINE_COLUMNS}
            shown={shownCols}
            layout={columns}
            onLayoutChange={onColumnsChange}
            sorting={sorting}
            onSortingChange={onSortingChange}
            tableRef={tableRef}
            leading={
              <Table.Th px={4} w={LEAD_WIDTH}>
                <Group gap={2} wrap="nowrap">
                  <span style={{ width: 'var(--ai-size-sm, 22px)', flexShrink: 0 }} />
                  <Checkbox
                    size="xs"
                    className={classes.select}
                    aria-label="Sélectionner toutes les routines affichées"
                    checked={allSelected}
                    indeterminate={!allSelected && selectedRoutines.length > 0}
                    onChange={(event) => select([...shownIds], event.currentTarget.checked)}
                  />
                </Group>
              </Table.Th>
            }
            trailing={
              <Table.Th w={ACTIONS_WIDTH}>
                <ColumnsMenu columns={ROUTINE_COLUMNS} layout={columns} onLayoutChange={onColumnsChange} />
              </Table.Th>
            }
          />
          <RoutineCellSelectionContext.Provider value={effectiveCellSelection}>
            <Table.Tbody>{body()}</Table.Tbody>
          </RoutineCellSelectionContext.Provider>
        </Table>
      </div>
      {selectedRoutines.length > 0 && <RoutineBulkBar routines={selectedRoutines} all={routines} categories={categories} context={context} onClear={() => setSelected(new Set())} />}
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <Paper shadow="md" radius="sm" px="sm" py={4} withBorder className={classes.overlay}>
            <Group gap="xs" wrap="nowrap">
              <DotsSixVerticalIcon weight="bold" aria-hidden />
              <Text size="sm" fw={500}>
                {dragged.title}
              </Text>
            </Group>
          </Paper>
        )}
      </DragOverlay>
    </DndContext>
  );
}
