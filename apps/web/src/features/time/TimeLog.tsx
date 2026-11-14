import { EmptyState } from '../../components/feedback/EmptyState';
import { Badge, Group, Table, Text } from '@mantine/core';
import { entrySeconds, formatDuration, type TableFilterGroup } from '@ordo/shared';
import { ClockIcon, CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../components/data-table/DataTable';
import { EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { notifyError } from '../../lib/notify';
import type { DataColumn } from '../../components/data-table/data-table';
import { RowActions } from '../../components/data-table/RowActions';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { TaskRef } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from './api';
import classes from './TimeLog.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Local day of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
function dayKey(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Seconds of the finished times (a running timer counts once stopped).
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {number} Seconds.
 */
const finishedSeconds = (entries: readonly TimeEntry[]) => entries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0);

/**
 * Filter of the times started within a period.
 * @param {string} period Period token (thisWeek, thisMonth…).
 * @returns {TableFilterGroup} Filter.
 */
const within = (period: string): TableFilterGroup => ({ type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'day', field: 'day', operator: 'within', value: period }] });

/** Views made the first time the times are shown, by day: this week (opened first), this month, every time. */
const TIME_VIEWS: FirstTableView[] = [
  { name: 'Cette semaine', config: { filter: within('thisWeek'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { name: 'Ce mois-ci', config: { filter: within('thisMonth'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { name: 'Tous', config: { groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
];

/**
 * Columns of the tracked times.
 * @param {TaskContext | null} context Task context (names of the projects and tasks).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
function timeColumns(context: TaskContext | null): DataColumn<TimeEntry>[] {
  const projectName = (entry: TimeEntry) => (entry.projectId ? (context?.projectLabel(entry.projectId) ?? '') : '');
  return [
    {
      id: 'day',
      label: 'Jour',
      size: 200,
      hiddenByDefault: true,
      sortValue: (entry) => dayKey(entry.startedAt),
      text: (entry) => dayFormat.format(new Date(entry.startedAt)).replace(/^./, (letter) => letter.toUpperCase()),
      filter: { kind: 'date', value: (entry) => dayKey(entry.startedAt) },
      groupable: true,
    },
    {
      id: 'hours',
      label: 'Horaires',
      size: 130,
      sortValue: (entry) => entry.startedAt,
      text: (entry) => `${timeFormat.format(new Date(entry.startedAt))}${entry.endedAt ? ` – ${timeFormat.format(new Date(entry.endedAt))}` : ''}`,
      filter: false,
    },
    {
      id: 'duration',
      label: 'Durée',
      size: 100,
      numeric: true,
      sortValue: (entry) => entrySeconds(entry),
      text: (entry) => (entry.endedAt ? formatDuration(entrySeconds(entry)) : 'En cours'),
      filter: false,
    },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      sortValue: (entry) => projectName(entry) || null,
      text: projectName,
      // A project keeps the times of its sub-projects.
      filter: {
        kind: 'choices',
        value: (entry) => {
          const ids: string[] = [];
          for (let id = entry.projectId; id; id = context?.projectById.get(id)?.parentId ?? null) ids.push(id);
          return ids;
        },
        options: (context?.projects ?? []).map((project) => ({ value: project.id, label: context?.projectLabel(project.id) ?? project.title })),
      },
      groupable: true,
    },
    { id: 'routine', label: 'Routine', size: 180, hiddenByDefault: true, sortValue: (entry) => entry.routineTitle ?? null, text: (entry) => entry.routineTitle ?? '', groupable: true },
    {
      id: 'tasks',
      label: 'Tâches',
      size: 220,
      text: (entry) =>
        entry.taskIds
          .map((id) => context?.taskById.get(id))
          .filter((task) => task !== undefined)
          .map((task) => context?.taskLabel(task) ?? '')
          .join(', '),
    },
    { id: 'description', label: 'Description', size: 300, locked: true, sortValue: (entry) => entry.description ?? null, text: (entry) => entry.description ?? '' },
    {
      id: 'invoice',
      label: 'Facture',
      size: 150,
      sortValue: (entry) => entry.documentNumber ?? null,
      text: (entry) => (entry.documentId ? (entry.documentNumber ? `Facturé : ${entry.documentNumber}` : 'Brouillon') : 'Non facturé'),
      filter: {
        kind: 'choice',
        value: (entry) => (entry.documentId ? (entry.documentNumber ? 'billed' : 'draft') : 'unbilled'),
        options: [
          { value: 'unbilled', label: 'Non facturé' },
          { value: 'draft', label: 'Sur un brouillon' },
          { value: 'billed', label: 'Facturé' },
        ],
      },
      groupable: true,
    },
  ];
}

interface TimeLogProps {
  entries: TimeEntry[] | undefined;
  context: TaskContext | null;
  /** Project of the list (its views, and its times not named), null for every project. */
  projectId: string | null;
  emptyMessage: string;
  onEdit: (entry: TimeEntry) => void;
  onDuplicate: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
  /** Buttons after the tabs of the views (add a time, start a timer). Optional. */
  actions?: ReactNode;
}

/**
 * Tracked times in a table of saved views (this week, this month, all by default), grouped by day with their total,
 * filtered, sorted, grouped and exported as every table; what they total, and what is still to bill.
 * @param {TimeLogProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDuplicate, onDelete, actions }: TimeLogProps) {
  const { update } = useTimeMutations();

  /**
   * Whether a time is changed in its cells: finished (the running timer is changed from the timer), and not on a final
   * invoice (it is part of it).
   * @param {TimeEntry} entry Time.
   * @returns {boolean} Editable.
   */
  const editable = (entry: TimeEntry) => Boolean(entry.endedAt) && !entry.documentNumber;

  /**
   * Saves fields of a time changed in their cells.
   * @param {TimeEntry} entry Time.
   * @param {Partial<TimeEntryValues>} change Change.
   * @returns {void}
   */
  const saveEntry = (entry: TimeEntry, change: Partial<TimeEntryValues>) => update.mutate({ id: entry.id, input: change }, { onError: (error) => notifyError(error.message) });
  const view = useDataView({ tableKey: 'time-log', projectId, columns: timeColumns(context), rows: entries ?? [], title: 'Temps passé', first: TIME_VIEWS });
  const total = finishedSeconds(view.rows);
  const unbilled = finishedSeconds(view.rows.filter((entry) => !entry.documentId));
  return (
    <DataTable
      view={view}
      framed
      bar={{
        searchLabel: 'Rechercher (description, projet, tâche)',
        actions,
        tools: (
          <Text size="sm" c="dimmed">
            {formatDuration(total)} au total
            {total > 0 && (unbilled > 0 ? `, dont ${formatDuration(unbilled)} non facturé` : ', tout est facturé')}.
          </Text>
        ),
      }}
      empty={<EmptyState icon={<ClockIcon aria-hidden />} message={emptyMessage} />}
      verticalSpacing="xs"
      highlightOnHover
      stickyHeader
      getKey={(entry) => entry.id}
      groupSummary={(rows) => formatDuration(finishedSeconds(rows))}
      cells={(entry) => {
        const tasks = context ? entry.taskIds.map((id) => context.taskById.get(id)).filter((task) => task !== undefined) : [];
        return {
          day: dayFormat.format(new Date(entry.startedAt)),
          hours: (
            <span className={classes.nowrap}>
              {timeFormat.format(new Date(entry.startedAt))}
              {entry.endedAt && ` – ${timeFormat.format(new Date(entry.endedAt))}`}
            </span>
          ),
          duration: entry.endedAt ? (
            <Text span size="sm" ff="monospace">
              {formatDuration(entrySeconds(entry))}
            </Text>
          ) : (
            <Badge size="sm" color="red" variant="light">
              En cours
            </Badge>
          ),
          project: (
            <>
              {context && editable(entry) && !entry.routineTitle ? (
                <EditableSelect
                  value={entry.projectId ?? null}
                  label="Projet de ce temps"
                  {...treeSelectProps(context.projectOptions(context.projects.filter((project) => !project.archived || project.id === entry.projectId)))}
                  onSave={(next) => next && saveEntry(entry, { projectId: next })}
                />
              ) : entry.projectId && entry.projectId !== projectId ? (
                context?.projectById.get(entry.projectId)?.title
              ) : null}
              {entry.routineTitle && (
                <Text size="xs" c="dimmed">
                  Routine : {entry.routineTitle}
                </Text>
              )}
            </>
          ),
          routine: entry.routineTitle,
          tasks: context && (
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
          ),
          description: editable(entry) ? (
            <EditableText value={entry.description ?? null} label="Description de ce temps" nullable onSave={(description) => saveEntry(entry, { description })} />
          ) : (
            <span className={classes.description}>
              {entry.description || (
                <Text span size="sm" c="dimmed" fs="italic">
                  Sans description
                </Text>
              )}
            </span>
          ),
          invoice: entry.documentId && (
            <Badge size="sm" variant="light" color={entry.documentNumber ? 'green' : 'gray'} component={Link} to={`/accounting/${entry.documentId}`} style={{ cursor: 'pointer' }}>
              {entry.documentNumber ? `Facturé : ${entry.documentNumber}` : 'Brouillon'}
            </Badge>
          ),
        };
      }}
      actions={(entry) =>
        // The running timer is edited from the timer; time on a final invoice is part of it (copied still).
        entry.endedAt && (
          <RowActions
            name="ce temps"
            primary={!entry.documentNumber && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => onEdit(entry) }}
            items={[
              { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => onDuplicate(entry) },
              !entry.documentNumber && { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => onDelete(entry) },
            ]}
          />
        )
      }
      footer={(shown, rows) => (
        // Total of the times shown (finished ones: a running timer counts once stopped).
        <Table.Tfoot className={classes.total}>
          <Table.Tr>
            <Table.Th colSpan={shown.length} scope="row">
              Total
            </Table.Th>
            <Table.Th ff="monospace" ta="right" className={classes.nowrap}>
              {formatDuration(finishedSeconds(rows))}
            </Table.Th>
          </Table.Tr>
        </Table.Tfoot>
      )}
    />
  );
}
