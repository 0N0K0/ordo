import { PAGES } from '../../../app/pages';
import { scheduleChoices } from '../../calendar/lib/schedule-choices';
import { useSetParams } from '../../../lib/search-params';
import { mapById, byPosition } from '@ordo/shared';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { Group, Stack, Text, Tooltip } from '@mantine/core';
import { ArrowBendUpRightIcon, ArrowsClockwiseIcon, CalendarDotsIcon, ClockCounterClockwiseIcon, HourglassMediumIcon, PencilSimpleIcon, PlusIcon, TreeViewIcon } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { DataTable, type RowMove } from '../../../components/data-table/table/DataTable';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { localToday } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { ON_ERROR } from '../../../lib/notify';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { isDraftRoutine, useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { openRoutineForm } from '../lib/open-routine-form';
import { openRoutineMove } from '../lib/open-routine-move';
import { useWorkSchedules } from '../../calendar/api';
import { useSlotRules, routineDoable } from '../../calendar/hooks/use-slot-rules';
import { RoutineHistory } from '../components/RoutineHistory';
import { RoutineSettings } from '../components/RoutineSettings';
import { useCommentCounts } from '../../comments/api';
import { commentTotal } from '../../comments/lib/comment-column';
import { useBeneficiaries } from '../../beneficiaries/hooks/use-beneficiaries';
import { useRunningTimer } from '../../time/api';
import { routineColumns } from '../lib/routine-columns';
import { routinesLabel } from '../lib/routine-cell-edit';
import { AddRoutineRow, ChronoCell, StateCell } from '../components/routine-table-cells';
import { RoutineDoneToggles } from '../components/DoneToggle';
import { AssigneesCell, CategoriesCell, EstimateCell, ProjectCell, RepetitionCell, RepetitionText, RequiresCell, RoutineBeneficiariesCell, TitleCell } from '../components/routine-cells';
import { BlocksCell, LocationCell, OpensOnCell, ParentRoutineCell, RemindersCell, SubRoutinesCell, TimeOfDayCell, TravelCell } from '../components/extra-cells';
import { isDone, movableOccurrence, waitingFor } from '../lib/routine-format';
import { usePostponeRoutine } from '../hooks/use-routine-move';
import { useRoutineRowsActions, useRoutineSelectionActions } from '../components/RoutineBulkBar';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import classes from '../components/Routines.module.css';
import { plural } from '../../../lib/text';

/** Views made the first time: those to do, all, the archived ones; grouped by category. */
const ROUTINE_VIEWS: FirstTableView[] = [
  {
    name: 'À faire',
    config: { groupBy: 'categories', filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'todo', field: 'state', operator: 'in', value: ['late', 'due'] }] } },
  },
  { name: 'Toutes', config: { groupBy: 'categories' } },
  {
    name: 'Archivées',
    config: {
      groupBy: 'categories',
      includeArchived: true,
      filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'archived', field: 'archived', operator: 'isTrue', value: null }] },
    },
  },
];

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
 * Routines, the data table of every table: tabs of views (« À faire », « Toutes » and « Archivées » made at first,
 * grouped by category as their tree), sub-routines under their parent, each field changed in place (or on a selection of
 * cells, or on the routines checked), moved by drag and drop (to another place or level, or category), a row adding one
 * at the end of each category. On a project page, only the routines of the project (and of its sub-projects), with the
 * views of the project, those added there going to the project.
 * @param {{ projectId?: string, projectIds?: ReadonlySet<string> }} props Component props.
 * @param {string} [props.projectId] Project of the page, given to the routines added. Optional.
 * @param {ReadonlySet<string>} [props.projectIds] Projects whose routines are shown (the project and its sub-projects). Optional.
 * @returns {JSX.Element} Routines.
 */
export function RoutinesPanel({ projectId, projectIds }: { projectId?: string; projectIds?: ReadonlySet<string> }) {
  const { data, isLoading } = useRoutinesData();
  const { context } = useTaskContext();
  const today = localToday();
  const routines = useMemo(() => data?.routines ?? [], [data]);
  const categories = useMemo(() => data?.routineCategories ?? [], [data]);
  const slotRules = useSlotRules();
  const { data: schedules } = useWorkSchedules();
  const { data: running } = useRunningTimer();
  const { move, patch } = useRoutineMutations();
  const postpone = usePostponeRoutine();
  const selectionActions = useRoutineSelectionActions();
  const rowActionsOf = useRoutineRowsActions();
  // Without those being created (no comment yet): no count asked again for them.
  const comments = useCommentCounts(
    'ROUTINE',
    useMemo(() => routines.filter((routine) => !isDraftRoutine(routine)).map((routine) => routine.id), [routines]),
  );
  const { choices: beneficiaryChoices } = useBeneficiaries();
  const byId = useMemo(() => mapById(routines), [routines]);
  const doable = useMemo(() => (routine: Routine) => slotRules.allowed(routineDoable(routine)), [slotRules]);
  const columns = useMemo(
    () =>
      context
        ? routineColumns({
            today,
            byId,
            categories,
            context,
            doable,
            comments,
            slotKinds: scheduleChoices(schedules).options,
            beneficiaries: beneficiaryChoices,
          })
        : [],
    [today, byId, categories, context, doable, comments, schedules, beneficiaryChoices],
  );
  // Of the project on a project page; in their manual order.
  const rows = useMemo(() => routines.filter((routine) => !projectIds || (routine.projectId && projectIds.has(routine.projectId))), [routines, projectIds]);
  const view = useDataView({
    tableKey: 'routines',
    projectId: projectId ?? null,
    columns,
    rows,
    title: 'Routines',
    first: ROUTINE_VIEWS,
    getKey: (routine) => routine.id,
    archived: (routine) => routine.archived,
    // One being created shows at once (its occurrences, computed once saved, may then take it out of the view).
    alwaysKept: isDraftRoutine,
  });
  const groupedByCategory = view.groupColumn?.id === 'categories';

  /**
   * Saves a routine dragged to another place or level (before the routine that now follows it, under its new parent,
   * or last at the top), or into another category.
   * @param {RowMove} drop Drop.
   * @returns {void}
   */
  const handleMove = ({ key, beforeKey, parentKey, groupKey, fromGroupKey }: RowMove) => {
    const moved = byId.get(key);
    if (!moved || isDraftRoutine(moved)) return;
    const categoryIds = groupedByCategory && groupKey !== undefined ? movedCategories(moved.categoryIds, fromGroupKey || null, groupKey || null) : null;
    const parent = parentKey !== undefined ? parentKey : (moved.parentId ?? null);
    const before = beforeKey ? byId.get(beforeKey) : undefined;
    if (before && before.id !== key && (before.parentId ?? null) === parent) {
      move.mutate({ id: key, targetId: before.id, place: 'BEFORE', categoryIds }, ON_ERROR);
      return;
    }
    if (parent) {
      move.mutate({ id: key, targetId: parent, place: 'INSIDE', categoryIds }, ON_ERROR);
      return;
    }
    const last = routines
      .filter((routine) => routine.parentId === null && routine.id !== key)
      .sort(byPosition)
      .at(-1);
    if (last) move.mutate({ id: key, targetId: last.id, place: 'AFTER', categoryIds }, ON_ERROR);
    else if (categoryIds) patch.mutate({ id: key, input: { categoryIds } }, ON_ERROR);
  };

  /**
   * Cells of a routine, each edited in place.
   * @param {Routine} routine Routine.
   * @returns {Record<string, ReactNode>} Cells, by column.
   */
  const cells = (routine: Routine): Record<string, ReactNode> => {
    if (!context) return {};
    const waiting = waitingFor(routine, byId);
    const done = isDone(routine);
    // Being created: nothing to change on it until it is saved (the server does not know it yet).
    const readOnly = routine.archived || isDraftRoutine(routine);
    return {
      ...Object.fromEntries(columns.filter((column) => column.text).map((column) => [column.id, column.text!(routine)])),
      title: (
        <Group gap={4} wrap="nowrap">
          <RoutineDoneToggles routine={routine} dateLabel={routine.currentDate ? fmt.weekday(routine.currentDate) : undefined} disabled={readOnly} />
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
          <StateCell routine={routine} today={today} doable={doable(routine)} />
        </RepetitionCell>
      ),
      repetition: <RepetitionText routine={routine} />,
      estimate: <EstimateCell routine={routine} readOnly={readOnly} />,
      fromTime: <TimeOfDayCell routine={routine} field="fromTime" readOnly={readOnly} />,
      dueTime: <TimeOfDayCell routine={routine} field="dueTime" readOnly={readOnly} />,
      opensOn: <OpensOnCell routine={routine} readOnly={readOnly} />,
      location: <LocationCell routine={routine} readOnly={readOnly} />,
      travelBefore: <TravelCell routine={routine} field="travelBefore" readOnly={readOnly} />,
      travelAfter: <TravelCell routine={routine} field="travelAfter" readOnly={readOnly} />,
      alarms: <RemindersCell routine={routine} readOnly={readOnly} />,
      blocks: <BlocksCell routine={routine} routines={routines} readOnly={readOnly} />,
      parent: <ParentRoutineCell routine={routine} routines={routines} readOnly={readOnly} />,
      subRoutines: <SubRoutinesCell routine={routine} routines={routines} readOnly={readOnly} />,
      trackedTime: <ChronoCell routine={routine} running={running} />,
      assignees: <AssigneesCell routine={routine} readOnly={readOnly} context={context} />,
      beneficiaries: <RoutineBeneficiariesCell routine={routine} readOnly={readOnly} />,
      categories: <CategoriesCell routine={routine} readOnly={readOnly} categories={categories} />,
      requires: <RequiresCell routine={routine} readOnly={readOnly} routines={routines} />,
      project: <ProjectCell routine={routine} readOnly={readOnly} context={context} />,
      comments: (
        <Text size="sm" c="dimmed" ta="right">
          {commentTotal(comments.get(routine.id), routine.description) || ''}
        </Text>
      ),
      lastDoneAt: routine.lastDoneAt ? (
        <Text size="sm" className={classes.nowrap}>
          {fmt.dateTime(routine.lastDoneAt)}
        </Text>
      ) : null,
    };
  };

  /**
   * Actions of a routine, in its menu.
   * @param {Routine} routine Routine.
   * @returns {ReactNode} Menu.
   */
  const actions = (routine: Routine) => {
    if (isDraftRoutine(routine)) return null;
    const readOnly = routine.archived;
    const rowActions = rowActionsOf([routine]);
    return (
      <RowActions
        name={routine.title}
        primary={!readOnly && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRoutineForm({ routine }) }}
        items={[
          !readOnly && { label: 'Ajouter une sous-routine', icon: <TreeViewIcon aria-hidden />, onClick: () => openRoutineForm({ parent: routine }) },
          !readOnly && movableOccurrence(routine) && 'divider',
          !readOnly && movableOccurrence(routine) && { label: 'Reporter au lendemain', icon: <ArrowBendUpRightIcon aria-hidden />, onClick: () => postpone(routine) },
          !readOnly && movableOccurrence(routine) && { label: 'Reporter, changer l’horaire ou annuler…', icon: <CalendarDotsIcon aria-hidden />, onClick: () => openRoutineMove(routine) },
          'divider',
          !readOnly && rowMenuEntry(rowActions.duplicate),
          { label: 'Historique', icon: <ClockCounterClockwiseIcon aria-hidden />, to: `/routines?tab=history&routine=${routine.id}` },
          rowMenuEntry(rowActions.archive),
          rowMenuEntry(rowActions.remove),
        ]}
      />
    );
  };

  return (
    <DataTable
      view={view}
      getKey={(routine) => routine.id}
      loading={isLoading || !context}
      verticalSpacing={4}
      className={classes.table}
      bar={{
        searchLabel: 'Rechercher (label, description, lieu)',
        actions: (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openRoutineForm({ projectId })}>
            Nouvelle routine
          </ActionButton>
        ),
      }}
      empty={<EmptyState icon={<ArrowsClockwiseIcon aria-hidden />} message="Aucune routine pour le moment. Une routine est une tâche qui revient : laver le linge, arroser les plantes…" />}
      parentKey={(routine) => routine.parentId ?? null}
      onMoveRow={handleMove}
      readOnly={isDraftRoutine}
      isArchived={(routine) => routine.archived}
      rowProps={(routine) => ({ className: classes.row, 'data-done': isDone(routine) || undefined })}
      cells={cells}
      actions={actions}
      addRow={
        !view.groupColumn || groupedByCategory
          ? (group) => <AddRoutineRow categoryId={groupedByCategory && group?.key ? group.key : null} projectId={projectId ?? null} groupName={group?.label ?? 'les routines'} />
          : undefined
      }
      selectionLabel={(count) => `${routinesLabel(count)} ${plural(count, 'sélectionnée')}`}
      selectionActions={selectionActions}
    />
  );
}

/**
 * Routines page: tasks repeating on a calendar rule, ticked once done for their current occurrence, and the history of
 * what was ticked on which day; the settings hold the categories.
 * @returns {JSX.Element} Page.
 */
export function RoutinesPage() {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'routines';

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.routines.title} />
      <RoutineSettings />
      <PageTabs value={tab} onChange={(value) => setParams({ routine: null, tab: value === 'history' ? 'history' : null })} keepMounted={false}>
        <PageTabs.List>
          <PageTabs.Tab value="routines" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Routines
          </PageTabs.Tab>
          <PageTabs.Tab value="history" leftSection={<ClockCounterClockwiseIcon aria-hidden />}>
            Historique
          </PageTabs.Tab>
        </PageTabs.List>
        <PageTabs.Panel value="routines">
          <RoutinesPanel />
        </PageTabs.Panel>
        <PageTabs.Panel value="history">
          <RoutineHistory routineId={params.get('routine')} onRoutine={(id) => setParams({ routine: id })} />
        </PageTabs.Panel>
      </PageTabs>
    </Stack>
  );
}
