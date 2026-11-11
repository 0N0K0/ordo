import { ActionIcon, Badge, Group, Paper, Skeleton, Stack, Table, Text, ThemeIcon, Tooltip, VisuallyHidden } from '@mantine/core';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { ClockIcon, CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useFillHeight } from '../tasks/column-fit';
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
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * One tracked time, a row of the table: hours, duration, project, tasks, description, invoice and actions.
 * @param {EntryRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function EntryRow({ entry, context, projectId, onEdit, onDuplicate, onDelete }: EntryRowProps) {
  const running = entry.endedAt === null;
  const tasks = entry.taskIds.map((id) => context.taskById.get(id)).filter((task) => task !== undefined);
  return (
    <Table.Tr>
      <Table.Td className={classes.nowrap}>
        {timeFormat.format(new Date(entry.startedAt))}
        {entry.endedAt && ` – ${timeFormat.format(new Date(entry.endedAt))}`}
      </Table.Td>
      <Table.Td className={classes.nowrap} ff="monospace">
        {running ? (
          <Badge size="sm" color="red" variant="light">
            En cours
          </Badge>
        ) : (
          formatDuration(entrySeconds(entry))
        )}
      </Table.Td>
      <Table.Td>{entry.projectId !== projectId ? context.projectById.get(entry.projectId)?.title : null}</Table.Td>
      <Table.Td>
        <Group gap={4}>
          {tasks.map((task) => (
            <TaskRef key={task.id} task={task} blocked={context.isBlocked(task)} />
          ))}
          {tasks.length > 1 && (
            <Text size="xs" c="dimmed">
              ({formatDuration(entrySeconds(entry) / tasks.length)} par tâche)
            </Text>
          )}
        </Group>
      </Table.Td>
      <Table.Td className={classes.description}>
        {entry.description || (
          <Text span size="sm" c="dimmed" fs="italic">
            Sans description
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {entry.documentId && (
          <Badge size="sm" variant="light" color={entry.documentNumber ? 'green' : 'gray'} component={Link} to={`/accounting/${entry.documentId}`} style={{ cursor: 'pointer' }}>
            {entry.documentNumber ? `Facturé : ${entry.documentNumber}` : 'Brouillon'}
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        {/* The running timer is edited from the timer; time on a final invoice is part of it (copied still). */}
        {!running && (
          <Group gap={2} wrap="nowrap" justify="flex-end">
            {!entry.documentNumber && (
              <Tooltip label="Modifier">
                <ActionIcon variant="subtle" color="gray" aria-label="Modifier ce temps" onClick={onEdit}>
                  <PencilSimpleIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Dupliquer">
              <ActionIcon variant="subtle" color="gray" aria-label="Dupliquer ce temps" onClick={onDuplicate}>
                <CopyIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
            {!entry.documentNumber && (
              <Tooltip label="Supprimer">
                <ActionIcon variant="subtle" color="red" aria-label="Supprimer ce temps" onClick={onDelete}>
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

interface TimeLogProps {
  entries: TimeEntry[] | undefined;
  context: TaskContext | null;
  projectId: string | null;
  emptyMessage: string;
  onEdit: (entry: TimeEntry) => void;
  onDuplicate: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

/**
 * Tracked times in a table, by day (latest first), each day headed by its total.
 * @param {TimeLogProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDuplicate, onDelete }: TimeLogProps) {
  // Scrolling inside the height left by the page: the header stays on top, the total at the bottom.
  const [fillRef, fillHeight] = useFillHeight();
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
    <Paper withBorder radius="md">
      <div ref={fillRef} className={classes.scroller} style={{ maxHeight: fillHeight }}>
        <Table verticalSpacing="xs" highlightOnHover stickyHeader miw={900}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Horaires</Table.Th>
              <Table.Th>Durée</Table.Th>
              <Table.Th>Projet</Table.Th>
              <Table.Th>Tâches</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Facture</Table.Th>
              <Table.Th>
                <VisuallyHidden>Actions</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          {[...days.entries()].map(([day, dayEntries]) => (
            <Table.Tbody key={day}>
              {/* The day and its total, heading its times. */}
              <Table.Tr className={classes.dayRow}>
                <Table.Th colSpan={7} scope="rowgroup">
                  {dayFormat.format(new Date(`${day}T12:00:00`)).replace(/^./, (letter) => letter.toUpperCase())}&nbsp;:{' '}
                  {formatDuration(dayEntries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0))}
                </Table.Th>
              </Table.Tr>
              {dayEntries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} context={context} projectId={projectId} onEdit={() => onEdit(entry)} onDuplicate={() => onDuplicate(entry)} onDelete={() => onDelete(entry)} />
              ))}
            </Table.Tbody>
          ))}
          {/* Total of the times shown (finished ones: a running timer counts once stopped). */}
          <Table.Tfoot className={classes.total}>
            <Table.Tr>
              <Table.Th colSpan={6} scope="row">
                Total
              </Table.Th>
              <Table.Th ff="monospace" ta="right" className={classes.nowrap}>
                {formatDuration(entries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0))}
              </Table.Th>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </div>
    </Paper>
  );
}
