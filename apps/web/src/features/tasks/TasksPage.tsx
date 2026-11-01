import {
  Alert,
  Avatar,
  Button,
  CloseButton,
  Group,
  Paper,
  Pill,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { CheckSquareOffsetIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { TaskTable } from './TaskTable';
import { useTaskActions } from './use-task-actions';
import { useTaskContext } from './use-task-context';

/**
 * User's current day, YYYY-MM-DD.
 * @returns {string} Day.
 */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Lowercases and strips accents.
 * @param {string} value Text.
 * @returns {string} Normalized text.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Task list: search, archived toggle, table, and the task panel of /tasks/:number over it.
 * @returns {JSX.Element} Page.
 */
export function TasksPage() {
  const { context, isPending, error } = useTaskContext();
  const actions = useTaskActions(context);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const today = localToday();

  // "@handle" links in markdown lead here, filtered on that contributor.
  const assigneeHandle = params.get('assignee');
  const assignee = context?.contributors.find((contributor) => contributor.handle === assigneeHandle);

  const tasks = useMemo(() => {
    if (!context) return [];
    const query = normalize(search.trim());
    const number = /^#?(\d+)$/.exec(search.trim())?.[1];
    return context.tasks.filter(
      (task) =>
        (showArchived || !task.archived) &&
        (!assigneeHandle || (assignee && task.assigneeIds.includes(assignee.id))) &&
        (!query ||
          String(task.number) === number ||
          normalize(task.title).includes(query) ||
          normalize(task.description ?? '').includes(query)),
    );
  }, [context, search, showArchived, assigneeHandle, assignee]);

  const hasProjects = (context?.projects.filter((project) => !project.archived).length ?? 0) > 0;

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

      <Group gap="sm">
        <TextInput
          placeholder="Rechercher (#12, titre, description)"
          aria-label="Rechercher une tâche"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          rightSection={search ? <CloseButton size="sm" aria-label="Effacer" onClick={() => setSearch('')} /> : null}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={{ base: '100%', sm: 320 }}
        />
        <Switch label="Archivées" checked={showArchived} onChange={(event) => setShowArchived(event.currentTarget.checked)} />
        {assigneeHandle && (
          <Pill
            withRemoveButton
            onRemove={() => {
              params.delete('assignee');
              setParams(params);
            }}
            removeButtonProps={{ 'aria-label': 'Retirer le filtre' }}
          >
            <Group gap={6} wrap="nowrap">
              <Avatar src={assignee?.avatarUrl} name={assignee?.name ?? assigneeHandle} color="initials" size={16} />
              Assignées à @{assigneeHandle}
            </Group>
          </Pill>
        )}
      </Group>

      {error && (
        <Alert color="red" icon={<ErrorIcon />}>
          {error.message}
        </Alert>
      )}
      {isPending && (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} height={36} />
          ))}
        </Stack>
      )}
      {context &&
        (tasks.length > 0 ? (
          <Paper withBorder radius="md">
            <TaskTable tasks={tasks} context={context} today={today} />
          </Paper>
        ) : (
          <Paper withBorder radius="md" p="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                <CheckSquareOffsetIcon aria-hidden />
              </ThemeIcon>
              <Text size="sm" c="dimmed" ta="center">
                {context.tasks.length > 0
                  ? 'Aucune tâche ne correspond.'
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

      <Outlet />
    </Stack>
  );
}
