import { PAGES, routineHistoryPath } from '../../../app/pages';
import { readOnlyCells } from '../../../components/data-table/table/data-table';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { useSlotChoices } from '../../calendar/hooks/use-slot-sources';
import { useSetParams, useSearchParam } from '../../../lib/search-params';
import { mapById, occurrenceKey } from '@ordo/shared';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { Group, Stack, Text } from '@mantine/core';
import { ArrowBendUpRightIcon, ArrowsClockwiseIcon, CalendarDotsIcon, ClockCounterClockwiseIcon, PencilSimpleIcon, PlusIcon, TreeViewIcon } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { DataTable, type RowMove } from '../../../components/data-table/table/DataTable';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView, conditionFilter } from '../../../components/data-table/views/use-data-view';
import { localToday } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { ON_ERROR } from '../../../lib/notify';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { isDraftRoutine, useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { openRoutineForm } from '../lib/open-routine-form';
import { openRoutineMove } from '../lib/open-routine-move';
import { useSlotRules, routineDoable } from '../../calendar/hooks/use-slot-rules';
import { RoutineHistory } from '../components/RoutineHistory';
import { RoutineSettings } from '../components/RoutineSettings';
import { useCommentCounts } from '../../comments/api';
import { useBeneficiaries } from '../../beneficiaries/hooks/use-beneficiaries';
import { useRunningTimers } from '../../time/api';
import { routineColumns } from '../lib/routine-columns';
import { routinesLabel } from '../lib/routine-cell-edit';
import { AddRoutineRow, ChronoCell, StateCell } from '../components/routine-table-cells';
import { RoutineDoneToggles } from '../components/DoneToggle';
import { AssigneesCell, CategoriesCell, EstimateCell, ProjectCell, RepetitionCell, RepetitionText, RoutineBeneficiariesCell, RoutineLabelCell, RoutineLinksCell } from '../components/routine-cells';
import { BlocksCell, RoutineLocationCell, OpensOnCell, ParentRoutineCell, RemindersCell, SubRoutinesCell, TimeOfDayCell, TravelCell } from '../components/extra-cells';
import { isDone, movableOccurrence, panelOccurrence, waitingFor } from '../lib/routine-format';
import { usePostponeRoutine } from '../hooks/use-routine-move';
import { useConvertActivity } from '../hooks/use-convert-activity';
import { useRoutineRowsActions, useRoutineSelectionActions } from '../components/RoutineBulkBar';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import classes from '../components/Routines.module.css';
import { plural } from '../../../lib/text';
import { WaitingIcon } from '../components/WaitingIcon';
import { deadTimeMenuEntries } from '../../countdowns/lib/dead-time-menu';
import { routineDeadTimeItem } from '../lib/routine-dead-times';

/** Views made the first time: those to do, all; grouped by category. */
const ROUTINE_VIEWS: FirstTableView[] = [
  {
    label: 'À faire',
    config: { groupBy: 'categories', filter: conditionFilter('state', 'in', ['late', 'due'], 'todo') },
  },
  { label: 'Toutes', config: { groupBy: 'categories' } },
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
  const slotChoices = useSlotChoices();
  const { data: running } = useRunningTimers();
  const { move } = useRoutineMutations();
  const postpone = usePostponeRoutine();
  const selectionActions = useRoutineSelectionActions();
  const rowActionsOf = useRoutineRowsActions();
  const convert = useConvertActivity();
  // Without those being created (no comment yet): no count asked again for them.
  const comments = useCommentCounts(
    'ROUTINE',
    useMemo(() => routines.filter((routine) => !isDraftRoutine(routine)).map((routine) => occurrenceKey(routine.id, panelOccurrence(routine))), [routines]),
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
            slotKinds: slotChoices.all,
            beneficiaries: beneficiaryChoices,
          })
        : [],
    [today, byId, categories, context, doable, comments, slotChoices, beneficiaryChoices],
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
    archivedLabel: 'Afficher les archivées',
    // One being created shows at once (its occurrences, computed once saved, may then take it out of the view).
    alwaysKept: isDraftRoutine,
  });
  const groupedByCategory = view.groupColumn?.id === 'categories';

  /**
   * Saves a routine dragged to another place or level (before the routine that now follows it in the global manual
   * order, under its new parent, as a task: a move works in a filtered view, its parent hidden), or into another
   * category.
   * @param {RowMove} drop Drop.
   * @returns {void}
   */
  const handleMove = ({ key, beforeKey, parentKey, groupKey, fromGroupKey }: RowMove) => {
    const moved = byId.get(key);
    if (!moved || isDraftRoutine(moved) || moved.archived) return;
    const categoryIds = groupedByCategory && groupKey !== undefined ? movedCategories(moved.categoryIds, fromGroupKey || null, groupKey || null) : null;
    const before = beforeKey ? byId.get(beforeKey) : undefined;
    move.mutate({ id: key, beforeId: before?.id ?? null, ...(parentKey !== undefined && { parentId: parentKey }), categoryIds }, ON_ERROR);
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
      ...readOnlyCells(columns, routine),
      label: (
        <Group gap={4} wrap="nowrap">
          <RoutineDoneToggles routine={routine} dateLabel={routine.currentDate ? fmt.weekday(routine.currentDate) : undefined} disabled={readOnly} />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <RoutineLabelCell routine={routine} readOnly={readOnly} />
            <RepetitionText routine={routine} />
          </Stack>
          {!done && <WaitingIcon waiting={waiting} />}
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
      location: <RoutineLocationCell routine={routine} readOnly={readOnly} />,
      travelBefore: <TravelCell routine={routine} field="travelBefore" readOnly={readOnly} />,
      travelAfter: <TravelCell routine={routine} field="travelAfter" readOnly={readOnly} />,
      alarms: <RemindersCell routine={routine} readOnly={readOnly} />,
      blocks: <BlocksCell routine={routine} routines={routines} context={context} readOnly={readOnly} />,
      parent: <ParentRoutineCell routine={routine} routines={routines} readOnly={readOnly} />,
      subRoutines: <SubRoutinesCell routine={routine} routines={routines} readOnly={readOnly} />,
      trackedTime: <ChronoCell routine={routine} running={running} />,
      assignees: <AssigneesCell routine={routine} readOnly={readOnly} context={context} />,
      beneficiaries: <RoutineBeneficiariesCell routine={routine} readOnly={readOnly} />,
      categories: <CategoriesCell routine={routine} readOnly={readOnly} categories={categories} />,
      requires: <RoutineLinksCell kind="requires" routine={routine} readOnly={readOnly} routines={routines} context={context} />,
      related: <RoutineLinksCell kind="related" routine={routine} readOnly={readOnly} routines={routines} context={context} />,
      project: <ProjectCell routine={routine} readOnly={readOnly} context={context} />,
      lastDoneAt: routine.lastDoneAt ? (
        <Text size="sm" className={classes.nowrap}>
          {fmt.dateTime(routine.lastDoneAt)}
        </Text>
      ) : null,
    };
  };

  /**
   * Actions of a routine, in its menu (« Lancer » its dead times, for its current occurrence: decision FT).
   * @param {Routine} routine Routine.
   * @returns {ReactNode} Menu.
   */
  const actions = (routine: Routine) => {
    if (isDraftRoutine(routine)) return null;
    const readOnly = routine.archived;
    const rowActions = rowActionsOf([routine]);
    return (
      <RowActions
        name={routine.label}
        primary={!readOnly && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRoutineForm({ routine }) }}
        items={[
          !readOnly && { label: 'Ajouter une sous-routine', icon: <TreeViewIcon aria-hidden />, onClick: () => openRoutineForm({ parent: routine }) },
          !readOnly && movableOccurrence(routine) && 'divider',
          !readOnly && movableOccurrence(routine) && { label: 'Reporter au lendemain', icon: <ArrowBendUpRightIcon aria-hidden />, onClick: () => postpone(routine) },
          !readOnly && movableOccurrence(routine) && { label: 'Reporter, changer l’horaire ou annuler…', icon: <CalendarDotsIcon aria-hidden />, onClick: () => openRoutineMove(routine) },
          'divider',
          !readOnly && rowMenuEntry(rowActions.duplicate),
          !readOnly && convert.toTask(routine, routines.some((item) => item.parentId === routine.id)),
          { label: 'Historique', icon: <ClockCounterClockwiseIcon aria-hidden />, to: routineHistoryPath(routine.id) },
          rowMenuEntry(rowActions.archive),
          rowMenuEntry(rowActions.remove),
          ...(readOnly ? [] : deadTimeMenuEntries(routine.deadTimes, routineDeadTimeItem(routine, routine.currentDate))),
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
        searchLabel: 'Rechercher (libellé, description, lieu)',
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
      isStruck={isDone}
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

/** Tabs of the routines page. */
const ROUTINE_TABS = ['routines', 'history'] as const;

/**
 * Routines page: tasks repeating on a calendar rule, ticked once done for their current occurrence, and the history of
 * what was ticked on which day; the settings hold the categories.
 * @returns {JSX.Element} Page.
 */
export function RoutinesPage() {
  const [routineParam] = useSearchParam('routine');
  const setParams = useSetParams();
  const [tab, setTab] = usePageTab(ROUTINE_TABS);

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.routines.label} />
      <RoutineSettings />
      <PageTabs value={tab} onChange={(value) => setTab(value, { routine: null })} keepMounted={false}>
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
          <RoutineHistory routineId={routineParam} onRoutine={(id) => setParams({ routine: id })} />
        </PageTabs.Panel>
      </PageTabs>
    </Stack>
  );
}
