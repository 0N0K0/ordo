import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { Alert, Paper, Stack } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { addDays, filterPeriod, ME, type FilterGroup } from '@ordo/shared';
import { CheckSquareOffsetIcon, PlusIcon } from '@phosphor-icons/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { localToday } from '../../lib/dates';
import { notifyError } from '../../lib/notify';
import { useCalendarEvents } from '../calendar/api';
import { useMatchingTaskIds, type Task } from './api';
import { TaskTable } from './TaskTable';
import type { CellSelection } from './views/cell-edit';
import { COLUMN_FILTER_FIELDS } from './views/columns-meta';
import { useTaskActions } from './use-task-actions';
import { useTaskContext } from './use-task-context';
import { BulkBar } from './views/BulkBar';
import { newCondition, nodeId, pruneFilter } from './views/filter-meta';
import { eventMatches, eventMatchesSearch } from './views/event-rows';
import { downloadCsv, downloadPdf, exportTable } from './views/export';
import { buildRows, taskIdOfRow } from './views/task-rows';
import { useTaskView } from './views/use-task-view';
import { ViewTabs } from './views/ViewTabs';
import { ViewToolbar } from './views/ViewToolbar';
import { sprintPeriod } from './views/sprint-period';
import classes from './TaskBoard.module.css';

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Short day: "3 nov.".
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Day.
 */
const dayLabel = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`));

interface TaskBoardProps {
  /** Project whose tasks (sub-projects included) are listed, or null for the home page. */
  projectId: string | null;
  /** Filter always applied on top of the view (project tree, home period). */
  baseFilter: FilterGroup | null;
  /** Preselected project of new tasks. */
  createProjectId?: string;
  /** Controls shown before the view tabs (e.g. the home period). */
  header?: ReactNode;
  emptyMessage: string;
  /** What the list is, for the title of exports ("Accueil — Aujourd’hui", project title). */
  title: string;
  /** Days of the events listed (home period), instead of the period chosen in the view. Dates included. */
  eventRange?: { from: string; to: string };
}

/**
 * Task list of a scope: saved view tabs, view toolbar, table with inline and column edits, bulk actions, the
 * calendar events of a period when the view shows them, and exports (CSV, PDF) of what the view lists.
 * @param {TaskBoardProps} props Component props.
 * @returns {JSX.Element} Board.
 */
export function TaskBoard({ projectId, baseFilter, createProjectId, header, emptyMessage, title, eventRange }: TaskBoardProps) {
  const { context, isPending, error } = useTaskContext();
  const actions = useTaskActions(context);
  const view = useTaskView(projectId);
  const { config, current, change } = view;
  const [params, setParams] = useSearchParams();
  const touch = useMediaQuery('(hover: none)');
  const today = localToday();

  // Selection belongs to a view: switching views starts with an empty selection.
  const [selectionState, setSelectionState] = useState<{ viewId?: string; rows: RowSelectionState }>({ rows: {} });
  const selection = useMemo(
    () => (selectionState.viewId === current?.id ? selectionState.rows : {}),
    [selectionState, current?.id],
  );
  const setSelection = (rows: RowSelectionState) => setSelectionState({ viewId: current?.id, rows });
  const [cellSelection, setCellSelection] = useState<CellSelection | null>(null);
  const [filterOpened, setFilterOpened] = useState(false);

  // The API is asked once typing pauses; incomplete conditions are left out.
  const filter = config?.filter;
  const search = config?.search ?? '';
  const includeArchived = config?.includeArchived ?? false;
  const request = useMemo(() => {
    if (!filter) return null;
    const viewFilter = pruneFilter(filter);
    return {
      filter: baseFilter
        ? { type: 'group' as const, id: 'context', combinator: 'and' as const, children: [baseFilter, viewFilter] }
        : viewFilter,
      search,
      includeArchived,
      today,
      utcOffset: -new Date().getTimezoneOffset(),
    };
  }, [filter, baseFilter, search, includeArchived, today]);
  const [query] = useDebouncedValue(request, 250);
  const matching = useMatchingTaskIds(query);

  // "@handle" links in markdown lead here: the contributor becomes an (unsaved) filter of the view.
  // Applied once per link: the view changes before the URL parameter is removed.
  const assigneeHandle = params.get('assignee');
  const appliedHandle = useRef<string | null>(null);
  useEffect(() => {
    if (!assigneeHandle) {
      appliedHandle.current = null;
      return;
    }
    if (!context || !current || appliedHandle.current === assigneeHandle) return;
    appliedHandle.current = assigneeHandle;
    const contributor = context.contributors.find((item) => item.handle === assigneeHandle);
    if (contributor) {
      change((currentConfig) => ({
        ...currentConfig,
        filter: {
          ...currentConfig.filter,
          combinator: 'and',
          children: [
            ...currentConfig.filter.children,
            {
              type: 'condition',
              id: nodeId(),
              field: 'assignees',
              operator: 'anyOf',
              value: [contributor.isMe ? ME : contributor.id],
            },
          ],
        },
      }));
    }
    const next = new URLSearchParams(params);
    next.delete('assignee');
    setParams(next, { replace: true });
  }, [assigneeHandle, context, current, change, params, setParams]);

  const tasks = useMemo(
    () =>
      context && matching.data
        ? matching.data.map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined)
        : [],
    [context, matching.data],
  );

  // Events of the period, filtered by the view as far as their fields allow (task-only conditions leave them in).
  const showEvents = config?.events.show ?? false;
  const eventPeriod = config?.events.period ?? 'next:30';
  // A view filtering sprints lists the events of their dates.
  const sprintRange = useMemo(() => (showEvents && context && config ? sprintPeriod(config.filter, context, today) : null), [showEvents, context, config, today]);
  const range = useMemo(() => {
    if (!showEvents) return null;
    if (eventRange) return eventRange;
    if (sprintRange) return sprintRange;
    const [from, end] = filterPeriod(eventPeriod, today);
    return { from, to: addDays(end, -1) };
  }, [showEvents, eventRange, sprintRange, eventPeriod, today]);
  const eventsQuery = useCalendarEvents(range);
  const events = useMemo(() => {
    if (!context || !query || !range || !eventsQuery.data) return [];
    return eventsQuery.data
      .filter((event) => eventMatches(event, query.filter, context, today) && eventMatchesSearch(event, query.search))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }, [context, query, range, eventsQuery.data, today]);

  const rows = useMemo(() => (context && config ? buildRows(tasks, events, config, context) : []), [tasks, events, config, context]);
  const [exporting, setExporting] = useState(false);

  /**
   * Exports what the view lists (every row, collapsed ones included) with its visible columns.
   * @param {'csv' | 'pdf'} format Format.
   * @returns {void}
   */
  const exportRows = (format: 'csv' | 'pdf') => {
    if (!context || !config || !current) return;
    const taskCount = new Set(tasks.map((task) => task.id)).size;
    const parts = [
      `${taskCount} tâche${taskCount > 1 ? 's' : ''}`,
      ...(showEvents ? [`${events.length} évènement${events.length > 1 ? 's' : ''} du ${dayLabel(range!.from)} au ${dayLabel(range!.to)}`] : []),
      ...(search.trim() ? [`recherche « ${search.trim()} »`] : []),
      `exporté le ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
    ];
    const table = exportTable({ rows, config, context, title: `${title} — ${current.name}`, subtitle: parts.join(' · ') });
    if (format === 'csv') {
      downloadCsv(table);
      return;
    }
    setExporting(true);
    downloadPdf(table)
      .catch((exportError: Error) => notifyError(exportError.message))
      .finally(() => setExporting(false));
  };

  // Only tasks still shown by the view count as selected (an edit can make a task leave the view).
  const selectedTasks = useMemo(() => {
    const ids = new Set(Object.keys(selection).filter((rowId) => selection[rowId]).map(taskIdOfRow));
    return tasks.filter((task) => ids.has(task.id));
  }, [selection, tasks]);

  const canCreate = (context?.projects.filter((project) => !project.archived).length ?? 0) > 0;
  // Empty because of the view (filters, search, archives hidden) or because there is no task at all.
  const filtered = Boolean(search.trim()) || (filter?.children.length ?? 0) > 0;
  const loading = isPending || view.isPending || (matching.isPending && query !== null);

  return (
    <Stack gap="md">
      {(header || canCreate || view.views.length > 0) && (
        <div className={classes.top}>
          {view.views.length > 0 && (
            <div className={classes.tabs}>
              <ViewTabs state={view} />
            </div>
          )}
          {(header || canCreate) && (
            <div className={classes.controls}>
              {header}
              {/* The new task at the far right, as every « Nouveau… ». */}
              {canCreate && (
                <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => actions.create(createProjectId ? { projectId: createProjectId } : undefined)}>
                  Nouvelle tâche
                </ActionButton>
              )}
            </div>
          )}
        </div>
      )}
      {config && context && (
        <ViewToolbar
          config={config}
          change={change}
          context={context}
          filterOpened={filterOpened}
          onFilterOpenedChange={setFilterOpened}
          eventPeriodLocked={Boolean(eventRange ?? sprintRange)}
          eventPeriodLabel={!eventRange && sprintRange ? `Évènements des sprints : du ${dayLabel(sprintRange.from)} au ${dayLabel(sprintRange.to)}` : undefined}
          onExport={exportRows}
          exporting={exporting}
          canExport={rows.length > 0}
          dirty={view.dirty}
          onSave={view.save}
          onRevert={view.revert}
        />
      )}

      {(error ?? view.error ?? matching.error) && (
        <Alert color="red" icon={<ErrorIcon />}>
          {(error ?? view.error ?? matching.error)?.message}
        </Alert>
      )}
      {loading && !matching.data && (
        <TableSkeleton rows={5} />
      )}
      {context &&
        config &&
        matching.data &&
        (rows.length > 0 ? (
          <Paper withBorder radius="md" style={{ opacity: matching.isPlaceholderData ? 0.6 : 1 }}>
            <TaskTable
              rows={rows}
              config={config}
              change={change}
              context={context}
              today={today}
              selection={selection}
              onSelectionChange={setSelection}
              cellSelection={cellSelection}
              onCellSelectionChange={setCellSelection}
              onFilterColumn={(column) => {
                const field = COLUMN_FILTER_FIELDS[column];
                if (!field) return;
                change((currentConfig) => ({
                  ...currentConfig,
                  filter: { ...currentConfig.filter, children: [...currentConfig.filter.children, newCondition(field)] },
                }));
                setFilterOpened(true);
              }}
              dndEnabled={!touch && config.sorting.length === 0 && config.groupBy === null}
              createProjectId={createProjectId}
              onOpenCreateForm={(defaults) =>
                actions.create({ projectId: defaults.projectId, parentId: defaults.parentId ?? undefined })
              }
            />
          </Paper>
        ) : (
          <EmptyState icon={<CheckSquareOffsetIcon aria-hidden />} message={<>{!canCreate
                  ? 'Créez d’abord un projet : chaque tâche appartient à un projet.'
                  : filtered
                    ? `Aucune tâche${showEvents ? ' ni aucun évènement' : ''} ne correspond aux filtres de cette vue.`
                    : emptyMessage}</>} />
        ))}

      {context && selectedTasks.length > 0 && (
        <BulkBar tasks={selectedTasks} context={context} onClear={() => setSelection({})} />
      )}
    </Stack>
  );
}
