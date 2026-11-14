import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { Group, Stack } from '@mantine/core';
import { ArrowsClockwiseIcon, ClockCounterClockwiseIcon, PlusIcon } from '@phosphor-icons/react';
import { ROUTINE_FILTER_FIELDS, type RoutineFilterField, type RoutineGroupBy, type RoutineViewConfig } from '@ordo/shared';
import { useMemo, useState } from 'react';
import type { ColumnMenuExtras } from '../../components/data-table/ColumnHeaderMenu';
import { DataColumnsPanel } from '../../components/data-table/ColumnsPanel';
import { shownColumns } from '../../components/data-table/data-table';
import { ExportButtons } from '../../components/data-table/DataViewBar';
import { newConditionFor } from '../tasks/views/filter-meta';
import { ROUTINE_COLUMNS } from './routine-columns';
import { useSearchParams } from 'react-router';
import { PageTabs } from '../../components/PageTabs';
import { localToday } from '../../lib/dates';
import { useTaskContext } from '../tasks/use-task-context';
import { useRoutinesData, type Routine } from './api';
import { openRoutineForm } from './open-routine-form';
import { keptByView, routineFilterFields, routineGrouping, routineTexts, sortRoutines, useRoutineView } from './routine-view';
import { RoutineViewToolbar } from './RoutineViewToolbar';
import { ViewTabs } from '../tasks/views/ViewTabs';
import { RoutineHistory } from './RoutineHistory';
import { RoutineSettings } from './RoutineSettings';
import { RoutineTable } from './RoutineTable';

/** Groups offered from the menu of a column. */
const COLUMN_GROUP_BY: Partial<Record<string, RoutineGroupBy>> = { categories: 'category', project: 'project', assignees: 'assignees', repetition: 'repetition' };

/**
 * Filter and group actions of a routine column, in its menu (as on the tasks).
 * @param {string} id Column.
 * @param {RoutineViewConfig} config View.
 * @param {(change: (config: RoutineViewConfig) => RoutineViewConfig) => void} change View updater.
 * @param {() => void} openFilter Opens the filters.
 * @returns {ColumnMenuExtras} Actions.
 */
function routineColumnExtras(id: string, config: RoutineViewConfig, change: (change: (config: RoutineViewConfig) => RoutineViewConfig) => void, openFilter: () => void): ColumnMenuExtras {
  const field = id in ROUTINE_FILTER_FIELDS ? (id as RoutineFilterField) : null;
  const groupBy = COLUMN_GROUP_BY[id];
  return {
    onFilter: field
      ? () => {
          change((current) => ({ ...current, filter: { ...current.filter, children: [...current.filter.children, newConditionFor(ROUTINE_FILTER_FIELDS, field)] } }));
          openFilter();
        }
      : undefined,
    group: groupBy ? { active: config.groupBy === groupBy, onToggle: () => change((current) => ({ ...current, groupBy: current.groupBy === groupBy ? null : groupBy })) } : undefined,
  };
}

/**
 * Routines through saved views, as the tasks: tabs of views, each with its search, filters, sorts and groups (by
 * category by default, sub-routines under their parent); « À faire », « Toutes » and « Archivées » are made at first.
 * On a project page, only the routines of the project (and of its sub-projects), with the views of the project, those
 * added there going to the project.
 * @param {{ projectId?: string, projectIds?: ReadonlySet<string> }} props Component props.
 * @param {string} [props.projectId] Project of the page, given to the routines added. Optional.
 * @param {ReadonlySet<string>} [props.projectIds] Projects whose routines are shown (the project and its sub-projects). Optional.
 * @returns {JSX.Element} Routines.
 */
export function RoutinesPanel({ projectId, projectIds }: { projectId?: string; projectIds?: ReadonlySet<string> }) {
  const { data, isLoading } = useRoutinesData();
  const { context } = useTaskContext();
  const state = useRoutineView(projectId ?? null);
  const { config } = state;
  const [filterOpened, setFilterOpened] = useState(false);
  const columnLayout = config ? { columnOrder: config.columnOrder, hiddenColumns: config.hiddenColumns, columnSizing: config.columnSizing } : null;
  const today = localToday();
  const routines = useMemo(() => data?.routines ?? [], [data]);
  const categories = useMemo(() => data?.routineCategories ?? [], [data]);
  const env = useMemo(() => (context ? { today, byId: new Map(routines.map((routine) => [routine.id, routine])), categories, context } : null), [today, routines, categories, context]);

  /**
   * Whether a routine is shown: of the project (on a project page) and kept by the view.
   * @param {Routine} routine Routine.
   * @returns {boolean} Shown.
   */
  const keep = (routine: Routine) => {
    if (projectIds && !(routine.projectId && projectIds.has(routine.projectId))) return false;
    return Boolean(config && env && keptByView(config, routine, env));
  };
  const count = routines.filter(keep).length;
  const ordered = config && env ? sortRoutines(routines, config.sorting, env) : routines;
  // Flat: each routine a row of its own.
  const layout = config?.flat ? ordered.map((routine) => ({ ...routine, parentId: null })) : ordered;
  const groupBy = config?.groupBy ?? null;

  return (
    <Stack gap="md">
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-end">
        <div style={{ minWidth: 0, flex: 1 }}>
          <ViewTabs state={state} />
        </div>
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openRoutineForm({ projectId })}>
          Nouvelle routine
        </ActionButton>
      </Group>
      {config && env && columnLayout && (
        <RoutineViewToolbar
          config={config}
          change={state.change}
          fields={routineFilterFields(env)}
          dirty={state.dirty}
          onSave={state.save}
          onRevert={state.revert}
          filterOpened={filterOpened}
          onFilterOpenedChange={setFilterOpened}
          columns={<DataColumnsPanel columns={ROUTINE_COLUMNS} layout={columnLayout} onLayoutChange={(next) => state.change((current) => ({ ...current, ...next }))} />}
          exports={
            <ExportButtons
              disabled={count === 0}
              table={() => {
                const texts = routineTexts(env);
                return {
                  title: 'Routines',
                  subtitle: state.current?.name ?? '',
                  columns: shownColumns(ROUTINE_COLUMNS, columnLayout).map((column) => ({ ...column, text: texts[column.id] })),
                  groups: [{ key: '', label: '', rows: layout.filter(keep) }],
                  grouped: false,
                };
              }}
            />
          }
        />
      )}
      {isLoading || !context || !config || !env ? (
        <TableSkeleton rows={4} />
      ) : count === 0 && routines.length > 0 ? (
        <EmptyState
          icon={<ArrowsClockwiseIcon aria-hidden />}
          message={projectIds ? 'Aucune routine de ce projet dans cette vue : une routine y est rattachée par son champ « Projet ».' : 'Aucune routine dans cette vue.'}
        />
      ) : (
        <Stack gap="xs">
          {routines.length === 0 && <EmptyState compact message="Aucune routine pour le moment. Une routine est une tâche qui revient : laver le linge, arroser les plantes…" />}
          <RoutineTable
            routines={routines}
            layout={layout}
            categories={categories}
            context={context}
            keep={keep}
            grouping={routineGrouping(groupBy, env)}
            reorderable={config.sorting.length === 0 && !config.flat}
            groupDrop={groupBy === 'category'}
            addable={groupBy === 'category' || groupBy === null}
            projectId={projectId ?? null}
            columns={columnLayout!}
            onColumnsChange={(next) => state.change((current) => ({ ...current, ...next }))}
            sorting={config.sorting}
            onSortingChange={(sorting) => state.change((current) => ({ ...current, sorting: sorting as typeof current.sorting }))}
            columnExtras={(id) => routineColumnExtras(id, config, state.change, () => setFilterOpened(true))}
          />
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Routines page: tasks repeating on a calendar rule, ticked once done for their current occurrence, and the history of
 * what was ticked on which day; the settings hold the categories.
 * @returns {JSX.Element} Page.
 */
export function RoutinesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'routines';

  return (
    <Stack gap="lg">
      <PageHeader title="Routines" />
      <RoutineSettings />
      <PageTabs
        value={tab}
        onChange={(value) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.delete('routine');
              if (value === 'history') next.set('tab', 'history');
              else next.delete('tab');
              return next;
            },
            { replace: true },
          )
        }
        keepMounted={false}
      >
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
          <RoutineHistory
            routineId={params.get('routine')}
            onRoutine={(id) =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (id) next.set('routine', id);
                  else next.delete('routine');
                  return next;
                },
                { replace: true },
              )
            }
          />
        </PageTabs.Panel>
      </PageTabs>
    </Stack>
  );
}
