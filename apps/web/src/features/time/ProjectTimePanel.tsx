import { ActionIcon, Badge, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { ClockIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { TaskRef } from '../tasks/task-ui';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useTimeEntries, useTimeMutations, type TimeEntry } from './api';
import classes from './ProjectTimePanel.module.css';
import { TimeEntryForm } from './TimeEntryForm';
import { TimerCard } from './TimerCard';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

let modalCount = 0;

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
  projectId: string;
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

/**
 * Time tab of a project: the timer, time added by hand, and the tracked times of the project and its
 * sub-projects by day, with day and overall totals and what is billed.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectTimePanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const entries = useTimeEntries(projectId);
  const { remove } = useTimeMutations();
  const archived = context?.projectById.get(projectId)?.archived;

  /**
   * Opens the time form.
   * @param {TimeEntry} [entry] Entry to edit. Optional.
   * @returns {void}
   */
  const openForm = (entry?: TimeEntry) => {
    if (!context) return;
    const modalId = `time-entry-${++modalCount}`;
    modals.open({
      modalId,
      title: entry ? 'Modifier le temps' : 'Ajouter un temps',
      size: 'lg',
      children: <TimeEntryForm context={context} entry={entry} defaultProjectId={projectId} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a time.
   * @param {TimeEntry} entry Entry.
   * @returns {void}
   */
  const confirmDelete = (entry: TimeEntry) => {
    const modalId = `delete-time-${entry.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le temps',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Ce temps ({formatDuration(entrySeconds(entry))}) sera supprimé définitivement et retiré du temps passé de ses
            tâches. Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(entry.id, {
                onSuccess: () => notifySuccess('Temps supprimé.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  const days = new Map<string, TimeEntry[]>();
  for (const entry of entries.data ?? []) days.set(dayKey(entry.startedAt), [...(days.get(dayKey(entry.startedAt)) ?? []), entry]);
  const finished = (entries.data ?? []).filter((entry) => entry.endedAt !== null);
  const total = finished.reduce((sum, entry) => sum + entrySeconds(entry), 0);
  const unbilled = finished.filter((entry) => !entry.documentId).reduce((sum, entry) => sum + entrySeconds(entry), 0);

  return (
    <Stack gap="lg">
      {!archived && <TimerCard projectId={projectId} />}
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2} size="h4">
            Temps passé
          </Title>
          <Text size="sm" c="dimmed">
            Projet et sous-projets : {formatDuration(total)} au total
            {total > 0 && (unbilled > 0 ? `, dont ${formatDuration(unbilled)} à facturer (depuis une facture, « Temps passé »)` : ', tout est facturé')}.
          </Text>
        </Stack>
        <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context || archived}>
          Ajouter un temps
        </Button>
      </Group>

      {entries.isPending || !context ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      ) : days.size === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ClockIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun temps sur ce projet.
            </Text>
          </Stack>
        </Paper>
      ) : (
        [...days.entries()].map(([day, dayEntries]) => (
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
              <EntryRow
                key={entry.id}
                entry={entry}
                context={context}
                projectId={projectId}
                onEdit={() => openForm(entry)}
                onDelete={() => confirmDelete(entry)}
              />
            ))}
          </Paper>
        ))
      )}
    </Stack>
  );
}
