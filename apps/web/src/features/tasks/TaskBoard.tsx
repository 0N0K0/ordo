import { Alert, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { ME, type FilterGroup } from '@ordo/shared';
import { CheckSquareOffsetIcon, PlusIcon } from '@phosphor-icons/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { localToday } from '../../lib/dates';
import { useMatchingTaskIds, type Task } from './api';
import { TaskTable } from './TaskTable';
import type { CellSelection } from './views/cell-edit';
import { COLUMN_FILTER_FIELDS } from './views/columns-meta';
import { useTaskActions } from './use-task-actions';
import { useTaskContext } from './use-task-context';
import { BulkBar } from './views/BulkBar';
import { newCondition, nodeId, pruneFilter } from './views/filter-meta';
import { buildRows, taskIdOfRow } from './views/task-rows';
import { useTaskView } from './views/use-task-view';
import { ViewTabs } from './views/ViewTabs';
import { ViewToolbar } from './views/ViewToolbar';

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
}

/**
 * Task list of a scope: saved view tabs, view toolbar, table with inline and column edits, bulk actions.
 * @param {TaskBoardProps} props Component props.
 * @returns {JSX.Element} Board.
 */
export function TaskBoard({ projectId, baseFilter, createProjectId, header, emptyMessage }: TaskBoardProps) {
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
  const rows = useMemo(() => (context && config ? buildRows(tasks, config, context) : []), [tasks, config, context]);

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
      {header && <Group gap="sm">{header}</Group>}

      {view.views.length > 0 && <ViewTabs state={view} />}
      {config && context && (
        <ViewToolbar
          config={config}
          change={change}
          context={context}
          filterOpened={filterOpened}
          onFilterOpenedChange={setFilterOpened}
        />
      )}

      {(error ?? view.error ?? matching.error) && (
        <Alert color="red" icon={<ErrorIcon />}>
          {(error ?? view.error ?? matching.error)?.message}
        </Alert>
      )}
      {loading && !matching.data && (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} height={36} />
          ))}
        </Stack>
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
          <Paper withBorder radius="md" p="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                <CheckSquareOffsetIcon aria-hidden />
              </ThemeIcon>
              <Text size="sm" c="dimmed" ta="center">
                {!canCreate
                  ? 'Créez d’abord un projet : chaque tâche appartient à un projet.'
                  : filtered
                    ? 'Aucune tâche ne correspond aux filtres de cette vue.'
                    : emptyMessage}
              </Text>
              {canCreate && (
                <Button
                  leftSection={<PlusIcon aria-hidden />}
                  onClick={() => actions.create(createProjectId ? { projectId: createProjectId } : undefined)}
                >
                  Nouvelle tâche
                </Button>
              )}
            </Stack>
          </Paper>
        ))}

      {context && selectedTasks.length > 0 && (
        <BulkBar tasks={selectedTasks} context={context} onClear={() => setSelection({})} />
      )}
    </Stack>
  );
}
