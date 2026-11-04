import { ActionIcon, Badge, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { ClockIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { TaskRef } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import type { TimeEntry } from './api';
import classes from './TimeLog.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Local day key of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
function dayKey(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

interface EntryRowProps {
  entry: TimeEntry;
  context: TaskContext;
  /** Project of the list (null: every project): times of other projects show theirs. */
  projectId: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One tracked time: hours, duration, sub-project, tasks and description.
 * @param {EntryRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function EntryRow({ entry, context, projectId, onEdit, onDelete }: EntryRowProps) {
  const running = entry.endedAt === null;
  const tasks = entry.taskIds.map((id) => context.taskById.get(id)).filter((task) => task !== undefined);
  return (
    <Group gap="md" wrap="nowrap" align="flex-start" className={classes.entry}>
      <Stack gap={0} className={classes.hours}>
        <Text size="sm" fw={600} ff="monospace">
          {running ? '…' : formatDuration(entrySeconds(entry))}
        </Text>
        <Text size="xs" c="dimmed">
          {timeFormat.format(new Date(entry.startedAt))}
          {entry.endedAt && ` – ${timeFormat.format(new Date(entry.endedAt))}`}
        </Text>
      </Stack>
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs">
          {running && (
            <Badge size="sm" color="red" variant="light">
              En cours
            </Badge>
          )}
          {entry.documentId && (
            <Badge size="sm" variant="light" color={entry.documentNumber ? 'green' : 'gray'} component={Link} to={`/accounting/${entry.documentId}`} style={{ cursor: 'pointer' }}>
              {entry.documentNumber ? `Facturé : ${entry.documentNumber}` : 'Sur un brouillon de facture'}
            </Badge>
          )}
          {entry.projectId !== projectId && (
            <Badge size="sm" variant="light" color="gray">
              {context.projectById.get(entry.projectId)?.title}
            </Badge>
          )}
          {tasks.map((task) => (
            <TaskRef key={task.id} task={task} blocked={context.isBlocked(task)} />
          ))}
          {tasks.length > 1 && (
            <Text size="xs" c="dimmed">
              ({formatDuration(entrySeconds(entry) / tasks.length)} par tâche)
            </Text>
          )}
        </Group>
        {entry.description ? (
          <Text size="sm" className={classes.description}>
            {entry.description}
          </Text>
        ) : (
          <Text size="sm" c="dimmed" fs="italic">
            Sans description
          </Text>
        )}
      </Stack>
      {/* The running timer is edited from the timer card; time on a final invoice is part of it. */}
      {!running && !entry.documentNumber && (
        <Group gap={2} wrap="nowrap">
          <Tooltip label="Modifier">
            <ActionIcon variant="subtle" color="gray" aria-label="Modifier ce temps" onClick={onEdit}>
              <PencilSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Supprimer">
            <ActionIcon variant="subtle" color="red" aria-label="Supprimer ce temps" onClick={onDelete}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </Group>
  );
}

interface TimeLogProps {
  entries: TimeEntry[] | undefined;
  context: TaskContext | null;
  projectId: string | null;
  emptyMessage: string;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

/**
 * Tracked times by day, latest first, with the total of each day.
 * @param {TimeLogProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDelete }: TimeLogProps) {
  if (!entries || !context) {
    return (
      <Stack gap="xs" aria-label="Chargement">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={48} />
        ))}
      </Stack>
    );
  }
  const days = new Map<string, TimeEntry[]>();
  for (const entry of entries) days.set(dayKey(entry.startedAt), [...(days.get(dayKey(entry.startedAt)) ?? []), entry]);
  if (days.size === 0) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <ClockIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {emptyMessage}
          </Text>
        </Stack>
      </Paper>
    );
  }
  return (
    <Stack gap="lg">
      {[...days.entries()].map(([day, dayEntries]) => (
        <Paper key={day} withBorder radius="md" component="section">
          <Group justify="space-between" className={classes.dayHeader}>
            <Text size="sm" fw={600}>
              {dayFormat.format(new Date(`${day}T12:00:00`)).replace(/^./, (letter) => letter.toUpperCase())}
            </Text>
            <Text size="sm" fw={600} ff="monospace">
              {formatDuration(dayEntries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0))}
            </Text>
          </Group>
          {dayEntries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} context={context} projectId={projectId} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />
          ))}
        </Paper>
      ))}
    </Stack>
  );
}
