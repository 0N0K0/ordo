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
import { ActionIcon, Badge, Checkbox, ColorSwatch, Group, Menu, Paper, Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { entrySeconds, formatClock, formatDuration, routineSchema } from '@ordo/shared';
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
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
import { useState, type ReactElement } from 'react';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import addClasses from '../tasks/views/table-extras.module.css';
import type { TaskContext } from '../tasks/use-task-context';
import { useRunningTimer, useTimeMutations, type TimeEntry } from '../time/api';
import { useNow } from '../time/use-now';
import { useStopTimer } from '../time/use-stop-timer';
import { confirmDestructive } from '../shopping/list-modals';
import { useRoutineMutations, type Routine, type RoutineCategory, type RoutinePatchValues, type RoutinePlace } from './api';
import { AssigneesCell, EstimateCell, RequiresCell, TitleCell } from './routine-cells';
import { openRoutineForm } from './open-routine-form';
import { DAILY, isDone, NO_CATEGORY, routineRows, ruleOf, stateOf, visibleRoutineRows, waitingFor, type RoutineRow } from './routine-format';
import classes from './Routines.module.css';

/** Columns of the table. */
const COLUMNS = 10;

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Short date of a calendar date: "lun. 10 nov.".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
const dayText = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

/** What a routine is dropped on: a category heading (or the one without), or another routine. */
type DropData = { kind: 'group'; categoryId: string | null } | { kind: 'routine'; routine: Routine };

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
 * Where a routine stands today: due, late since a date, done, or its next date.
 * @param {{ routine: Routine, today: string }} props Component props.
 * @returns {JSX.Element} Badge or text.
 */
function StateCell({ routine, today }: { routine: Routine; today: string }) {
  const state = stateOf(routine, today);
  const next = routine.nextDate ? `Prochaine fois : ${dayText(routine.nextDate)}` : 'Plus d’occurrence à venir';
  return (
    <Tooltip label={next}>
      <span>
        {state === 'done' && (
          <Badge variant="light" color="green" tt="none">
            Fait
          </Badge>
        )}
        {state === 'due' && (
          <Badge variant="light" tt="none">
            Aujourd’hui
          </Badge>
        )}
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
function GroupRow({ row, today, collapsed, over, onToggle }: GroupRowProps) {
  const { setNodeRef } = useDroppable({ id: `group:${row.id ?? NO_CATEGORY}`, data: { kind: 'group', categoryId: row.id } satisfies DropData });
  const left = row.routines.filter((routine) => !routine.archived && ['due', 'late'].includes(stateOf(routine, today))).length;
  return (
    <Table.Tr ref={setNodeRef} className={classes.groupRow} data-depth={row.depth} data-over={over || undefined}>
      <Table.Td colSpan={COLUMNS} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` }}>
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
  onToggle: () => void;
}

/**
 * Row of a routine: moved by its handle (before, after or under another routine, or into a category), ticked for its current occurrence,
 * edited in place.
 * @param {RoutineRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function RoutineRowView({ row, routines, byId, context, today, running, collapsed, drop, onToggle }: RoutineRowProps) {
  const { routine, depth, children } = row;
  const { patch, setDone, setArchived, remove } = useRoutineMutations();
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: routine.id, disabled: routine.archived });
  const { setNodeRef: setDropRef } = useDroppable({ id: `routine:${routine.id}`, data: { kind: 'routine', routine } satisfies DropData });
  const done = isDone(routine);
  const waiting = waitingFor(routine, byId);
  const rule = ruleOf(routine);
  const readOnly = routine.archived;

  /**
   * Saves inline changes.
   * @param {RoutinePatchValues} input Changes.
   * @returns {void}
   */
  const save = (input: RoutinePatchValues) => patch.mutate({ id: routine.id, input }, { onError: (error) => notifyError(error.message) });

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
      <Table.Td w={32} px={4}>
        {!readOnly && (
          <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${routine.title}`} className={classes.handle} {...attributes} {...listeners}>
            <DotsSixVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Table.Td>
      <Table.Td w={36} px={4}>
        <Tooltip label={routine.currentDate ? (done ? 'Décocher' : `Cocher pour le ${dayText(routine.currentDate)}`) : 'Pas encore commencée'}>
          <Checkbox
            aria-label={`${routine.title} faite`}
            checked={done}
            disabled={readOnly || !routine.currentDate}
            onChange={(event) => setDone.mutate({ id: routine.id, done: event.currentTarget.checked }, { onError: (error) => notifyError(error.message) })}
          />
        </Tooltip>
      </Table.Td>
      <Table.Td miw={240} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${Math.max(0, depth - 1)} * var(--mantine-spacing-lg))` }}>
        <Group gap={4} wrap="nowrap">
          {children > 0 ? (
            <ActionIcon variant="subtle" color="gray" size="xs" aria-label={collapsed ? `Déplier ${routine.title}` : `Plier ${routine.title}`} aria-expanded={!collapsed} onClick={onToggle}>
              {collapsed ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
            </ActionIcon>
          ) : (
            depth > 0 && <span style={{ width: 'var(--ai-size-xs, 18px)', flexShrink: 0 }} />
          )}
          <TitleCell value={routine.title} label={`Titre de ${routine.title}`} readOnly={readOnly} onSave={(title) => save({ title })} />
          {waiting.length > 0 && !done && (
            <Tooltip label={`En attente de : ${waiting.map((item) => item.title).join(', ')}`}>
              <HourglassMediumIcon aria-label="En attente" color="var(--mantine-color-orange-6)" />
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <StateCell routine={routine} today={today} />
      </Table.Td>
      <Table.Td miw={160}>
        <UnstyledButton onClick={() => openRoutineForm({ routine })} disabled={readOnly} aria-label={`Modifier la répétition de ${routine.title}`}>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {rule ? describeRecurrence(rule, routine.startDate) : '—'}
          </Text>
        </UnstyledButton>
      </Table.Td>
      <Table.Td miw={140}>
        <AssigneesCell value={routine.assigneeIds} label={`Assignés de ${routine.title}`} readOnly={readOnly} context={context} onSave={(assigneeIds) => save({ assigneeIds })} />
      </Table.Td>
      <Table.Td w={96}>
        <EstimateCell value={routine.estimate} label={`Temps à consacrer à ${routine.title}`} readOnly={readOnly} onSave={(estimate) => save({ estimate })} />
      </Table.Td>
      <Table.Td miw={160}>
        <RequiresCell value={routine.requiredIds} label={`Dépendances de ${routine.title}`} readOnly={readOnly} routine={routine} routines={routines} onSave={(requiredIds) => save({ requiredIds })} />
      </Table.Td>
      <Table.Td>
        <ChronoCell routine={routine} running={running} />
      </Table.Td>
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
              </>
            )}
            <Menu.Item leftSection={<CopyIcon aria-hidden />} onClick={() => openRoutineForm({ routine, copy: true })}>
              Dupliquer
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
 * @param {{ categoryId: string | null, depth: number, groupName: string }} props Component props.
 * @returns {JSX.Element} Row.
 */
function AddRoutineRow({ categoryId, depth, groupName }: { categoryId: string | null; depth: number; groupName: string }) {
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
      { title: result.data, description: null, categoryId, parentId: null, startDate: localToday(), recurrence: DAILY, estimate: null, projectId: null, assigneeIds: [], requiredIds: [] },
      { onSuccess: () => setTitle(''), onError: (error) => notifyError(error.message) },
    );
  };

  return (
    <Table.Tr className={addClasses.addRow}>
      <Table.Td colSpan={2} />
      <Table.Td colSpan={COLUMNS - 2} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${Math.max(0, depth - 1)} * var(--mantine-spacing-lg))` }}>
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
  /** Routines shown (the others stay when one of their sub-routines is). */
  keep: (routine: Routine) => boolean;
  /** Routines can be added in the categories. */
  addable: boolean;
}

/**
 * Routines as a table: the categories as their tree, each followed by its routines, sub-routines under their parent;
 * categories and parent routines fold. A routine is dragged before, after or under another one, or into a category.
 * @param {RoutineTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function RoutineTable({ routines, categories, context, keep, addable }: RoutineTableProps) {
  const { patch, move } = useRoutineMutations();
  const { data: running } = useRunningTimer();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [dragged, setDragged] = useState<Routine | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: RoutinePlace } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const today = localToday();
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const rows = routineRows(routines, categories, keep);
  const shown = visibleRoutineRows(rows, collapsed);

  /**
   * Folds or unfolds a category or a routine.
   * @param {string} key Category id (NO_CATEGORY for none) or routine id.
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
    const moved = byId.get(String(active.id));
    const target = over?.data.current as DropData | undefined;
    if (!moved || !target) return;
    const onError = (error: Error) => notifyError(error.message);
    if (target.kind === 'routine') {
      if (canPlace(moved, target.routine, place)) move.mutate({ id: moved.id, targetId: target.routine.id, place }, { onError });
      return;
    }
    if (moved.parentId === null && moved.categoryId === target.categoryId) return;
    patch.mutate({ id: moved.id, input: { parentId: null, categoryId: target.categoryId } }, { onError });
  };

  /**
   * Where the dragged routine would go on a row, if it is the one under the pointer and the move is allowed.
   * @param {Routine} target Routine of the row.
   * @returns {RoutinePlace | null} Place.
   */
  const dropOn = (target: Routine): RoutinePlace | null => (dragged !== null && drop?.id === `routine:${target.id}` && canPlace(dragged, target, drop.place) ? drop.place : null);

  /**
   * Rows of the body, with the "add" row at the end of each unfolded category.
   * @returns {JSX.Element[]} Rows.
   */
  const body = () => {
    const out: ReactElement[] = [];
    shown.forEach((row, index) => {
      if (row.kind === 'group') {
        const key = row.id ?? NO_CATEGORY;
        out.push(<GroupRow key={`group:${key}`} row={row} today={today} collapsed={collapsed.has(key)} over={dragged !== null && drop?.id === `group:${key}`} onToggle={() => toggle(key)} />);
      } else {
        out.push(
          <RoutineRowView
            key={row.routine.id}
            row={row}
            routines={routines}
            byId={byId}
            context={context}
            today={today}
            running={running}
            collapsed={collapsed.has(row.routine.id)}
            drop={dropOn(row.routine)}
            onToggle={() => toggle(row.routine.id)}
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
      out.push(<AddRoutineRow key={`add:${group.id ?? NO_CATEGORY}`} categoryId={group.id} depth={group.depth + 1} groupName={group.name} />);
    });
    if (addable && !rows.some((row) => row.kind === 'group')) out.push(<AddRoutineRow key="add" categoryId={null} depth={0} groupName="les routines" />);
    return out;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active }) => setDragged(byId.get(String(active.id)) ?? null)}
      onDragOver={handleDragMove}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null);
        setDrop(null);
      }}
    >
      <div className={classes.scroller}>
        <Table className={classes.table} verticalSpacing={4} miw={1200} aria-label="Routines">
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              <Table.Th>
                <Text span size="xs" c="dimmed">
                  Fait
                </Text>
              </Table.Th>
              <Table.Th>Routine</Table.Th>
              <Table.Th>Quand</Table.Th>
              <Table.Th>Répétition</Table.Th>
              <Table.Th>Assignés</Table.Th>
              <Table.Th>Temps prévu</Table.Th>
              <Table.Th>Dépend de</Table.Th>
              <Table.Th>Chrono</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{body()}</Table.Tbody>
        </Table>
      </div>
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
