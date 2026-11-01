import { Alert, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { CheckSquareOffsetIcon, PlusIcon } from '@phosphor-icons/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { useMatchingTaskIds, type Task } from './api';
import { TaskTable } from './TaskTable';
import { useTaskActions } from './use-task-actions';
import { useTaskContext } from './use-task-context';
import { BulkBar } from './views/BulkBar';
import { nodeId, pruneFilter } from './views/filter-meta';
import { buildRows, taskIdOfRow } from './views/task-rows';
import { useTaskView } from './views/use-task-view';
import { ViewTabs } from './views/ViewTabs';
import { ViewToolbar } from './views/ViewToolbar';

/**
 * User's current day, YYYY-MM-DD.
 * @returns {string} Day.
 */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Task list: saved view tabs, view toolbar (search, filters, sorting, columns, grouping), table,
 * bulk actions, and the task panel of /tasks/:number over it.
 * @returns {JSX.Element} Page.
 */
export function TasksPage() {
  const { context, isPending, error } = useTaskContext();
  const actions = useTaskActions(context);
  const view = useTaskView();
  const { config, current, change } = view;
  const [params, setParams] = useSearchParams();
  // Selection belongs to a view: switching views starts with an empty selection.
  const [selectionState, setSelectionState] = useState<{ viewId?: string; rows: RowSelectionState }>({ rows: {} });
  const touch = useMediaQuery('(hover: none)');
  const today = localToday();

  // The API is asked once typing pauses; incomplete conditions are left out.
  const filter = config?.filter;
  const search = config?.search ?? '';
  const includeArchived = config?.includeArchived ?? false;
  const request = useMemo(
    () =>
      filter
        ? { filter: pruneFilter(filter), search, includeArchived, today, utcOffset: -new Date().getTimezoneOffset() }
        : null,
    [filter, search, includeArchived, today],
  );
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
            { type: 'condition', id: nodeId(), field: 'assignees', operator: 'anyOf', value: [contributor.id] },
          ],
        },
      }));
    }
    const next = new URLSearchParams(params);
    next.delete('assignee');
    setParams(next, { replace: true });
  }, [assigneeHandle, context, current, change, params, setParams]);

  const selection = useMemo(
    () => (selectionState.viewId === current?.id ? selectionState.rows : {}),
    [selectionState, current?.id],
  );
  const setSelection = (rows: RowSelectionState) => setSelectionState({ viewId: current?.id, rows });

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
    const shown = new Set(tasks.map((task) => task.id));
    const ids = new Set(Object.keys(selection).filter((rowId) => selection[rowId]).map(taskIdOfRow));
    return tasks.filter((task) => ids.has(task.id) && shown.has(task.id));
  }, [selection, tasks]);

  const hasProjects = (context?.projects.filter((project) => !project.archived).length ?? 0) > 0;
  const loading = isPending || view.isPending || (matching.isPending && query !== null);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={1} size="h2">
          Tâches
        </Title>
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => actions.create()} disabled={!hasProjects}>
          Nouvelle tâche
        </Button>
      </Group>

      {view.views.length > 0 && <ViewTabs state={view} />}
      {config && context && <ViewToolbar config={config} change={change} context={context} />}

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
              dndEnabled={!touch && config.sorting.length === 0 && config.groupBy === null}
            />
          </Paper>
        ) : (
          <Paper withBorder radius="md" p="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                <CheckSquareOffsetIcon aria-hidden />
              </ThemeIcon>
              <Text size="sm" c="dimmed" ta="center">
                {context.tasks.length > 0
                  ? 'Aucune tâche ne correspond à cette vue.'
                  : hasProjects
                    ? 'Aucune tâche pour le moment.'
                    : 'Créez d’abord un projet : chaque tâche appartient à un projet.'}
              </Text>
              {context.tasks.length === 0 && hasProjects && (
                <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => actions.create()}>
                  Créer une tâche
                </Button>
              )}
            </Stack>
          </Paper>
        ))}

      {context && selectedTasks.length > 0 && (
        <BulkBar tasks={selectedTasks} context={context} onClear={() => setSelection({})} />
      )}

      <Outlet />
    </Stack>
  );
}
