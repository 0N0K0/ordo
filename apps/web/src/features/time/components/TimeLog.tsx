import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Text } from '@mantine/core';
import { entrySeconds, formatDuration, type TableFilterGroup } from '@ordo/shared';
import { ClockIcon, CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { onMutationError } from '../../../lib/notify';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { TaskRef } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useRoutinesData } from '../../routines/api';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { TimeDayCell, TimeDurationCell, TimeEventCell, TimeRoutineCell, TimeStartCell, TimeTasksCell } from './time-cells';

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

/**
 * Events the times were spent on, as filter options.
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {{ value: string, label: string }[]} Options.
 */
function events(entries: readonly TimeEntry[]): { value: string; label: string }[] {
  const byId = new Map<string, string>();
  for (const entry of entries) if (entry.calendarEventId) byId.set(entry.calendarEventId, entry.calendarEventTitle ?? 'Évènement');
  return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Views made the first time the times are shown, by day: this week (opened first), this month, every time. */
const TIME_VIEWS: FirstTableView[] = [
  { name: 'Cette semaine', config: { filter: within('thisWeek'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { name: 'Ce mois-ci', config: { filter: within('thisMonth'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { name: 'Tous', config: { groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
];

/**
 * Columns of the tracked times.
 * @param {TaskContext | null} context Task context (names of the projects and tasks).
 * @param {Map<string, number>} comments Comments of the times.
 * @param {{ value: string, label: string }[]} routines Routines offered by the filter.
 * @param {readonly TimeEntry[]} entries Times (their events offered by the filter).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
function timeColumns(context: TaskContext | null, comments: Map<string, number>, routines: { value: string; label: string }[], entries: readonly TimeEntry[]): DataColumn<TimeEntry>[] {
  const projectName = (entry: TimeEntry) => (entry.projectId ? (context?.projectLabel(entry.projectId) ?? '') : '');
  return [
    {
      id: 'day',
      bulk: true,
      label: 'Date',
      size: 200,
      locked: true,
      sortValue: (entry) => entry.startedAt,
      text: (entry) => fmt.capitalize(fmt.dayLong(new Date(entry.startedAt))),
      filter: { kind: 'date', value: (entry) => dayKey(entry.startedAt) },
      groupable: true,
    },
    {
      id: 'month',
      label: 'Mois',
      size: 140,
      hiddenByDefault: true,
      sortValue: (entry) => dayKey(entry.startedAt).slice(0, 7),
      text: (entry) => fmt.capitalize(fmt.month(new Date(entry.startedAt))),
      filter: false,
      groupable: true,
    },
    { id: 'start', bulk: true, label: 'Heure de début', size: 110, sortValue: (entry) => fmt.time(new Date(entry.startedAt)), text: (entry) => fmt.time(new Date(entry.startedAt)), filter: false },
    {
      id: 'end',
      label: 'Heure de fin',
      size: 110,
      sortValue: (entry) => (entry.endedAt ? fmt.time(new Date(entry.endedAt)) : null),
      text: (entry) => (entry.endedAt ? fmt.time(new Date(entry.endedAt)) : ''),
      filter: false,
    },
    {
      id: 'duration',
      bulk: true,
      label: 'Durée',
      size: 100,
      numeric: true,
      sortValue: (entry) => entrySeconds(entry),
      formatTotal: (seconds) => formatDuration(Math.round(seconds)),
      text: (entry) => (entry.endedAt ? formatDuration(entrySeconds(entry)) : 'En cours'),
      filter: { kind: 'number', value: (entry) => Math.round(entrySeconds(entry) / 36) / 100 },
    },
    {
      id: 'project',
      bulk: true,
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
        options: context ? context.projectOptions(context.projects) : [],
      },
      groupable: true,
    },
    {
      id: 'routine',
      bulk: true,
      label: 'Routine',
      size: 180,
      sortValue: (entry) => entry.routineTitle ?? null,
      text: (entry) => entry.routineTitle ?? '',
      filter: { kind: 'choice', value: (entry) => entry.routineId ?? null, options: routines },
      groupable: true,
    },
    {
      id: 'tasks',
      bulk: true,
      label: 'Tâches',
      size: 240,
      text: (entry) =>
        entry.taskIds
          .map((id) => context?.taskById.get(id))
          .filter((task) => task !== undefined)
          .map((task) => context?.taskLabel(task) ?? '')
          .join(', '),
      filter: { kind: 'choices', value: (entry) => entry.taskIds, options: (context?.tasks ?? []).map((task) => ({ value: task.id, label: context?.taskLabel(task) ?? task.title })) },
    },
    {
      id: 'event',
      bulk: true,
      label: 'Évènement',
      size: 200,
      sortValue: (entry) => entry.calendarEventTitle ?? null,
      text: (entry) => entry.calendarEventTitle ?? '',
      filter: { kind: 'choice', value: (entry) => entry.calendarEventId ?? null, options: events(entries) },
      groupable: true,
    },
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
    commentColumn<TimeEntry>(
      comments,
      (entry) => entry.id,
      (entry) => entry.description,
    ),
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
  const { update, remove } = useTimeMutations();

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
  const saveOne = (entry: TimeEntry, change: Partial<TimeEntryValues>) =>
    // A time on a final invoice, or running, is left as it is.
    editable(entry) && update.mutate({ id: entry.id, input: change }, { onError: onMutationError });
  const { data: routinesData } = useRoutinesData();
  const routineOptions = (routinesData?.routines ?? []).map((routine) => ({ value: routine.id, label: routine.title }));
  const entryComments = useCommentCounts(
    'TIME_ENTRY',
    (entries ?? []).map((entry) => entry.id),
  );
  const view = useDataView({
    tableKey: 'time-log',
    projectId,
    columns: timeColumns(context, entryComments, routineOptions, entries ?? []),
    rows: entries ?? [],
    title: 'Temps passé',
    first: TIME_VIEWS,
  });
  const bulk = bulkSaver(view, saveOne);
  const total = finishedSeconds(view.rows);
  const unbilled = finishedSeconds(view.rows.filter((entry) => !entry.documentId));
  return (
    <DataTable
      view={view}
      framed
      selectionLabel={(count) => selectedLabel(count, ['temps', 'temps'], false)}
      selectionActions={(rows, clear) => {
        // A billed time stays: its invoice counts it.
        const deletable = rows.filter((entry) => !entry.documentNumber);
        return [
          {
            ...deleteRowsAction(deletable, {
              title: 'Supprimer les temps',
              risks: `${deletable.length} temps seront supprimés définitivement et retirés du temps passé de leurs tâches${deletable.length < rows.length ? ' (les temps facturés sont gardés)' : ''}. Cette action est irréversible.`,
              remove: (entry) => remove.mutateAsync(entry.id),
              done: `${deletable.length} temps supprimé(s).`,
              clear,
            }),
            disabled: deletable.length === 0,
          },
        ];
      }}
      bar={{
        searchLabel: 'Rechercher (projet, routine, tâche, évènement)',
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
          day: <TimeDayCell entry={entry} readOnly={!editable(entry)} save={bulk('day')} />,
          month: fmt.capitalize(fmt.month(new Date(entry.startedAt))),
          start: <TimeStartCell entry={entry} readOnly={!editable(entry)} save={bulk('start')} />,
          end: entry.endedAt ? (
            <Text span size="sm" c="dimmed">
              {fmt.time(new Date(entry.endedAt))}
            </Text>
          ) : null,
          duration: entry.endedAt ? (
            <TimeDurationCell entry={entry} readOnly={!editable(entry)} save={bulk('duration')} />
          ) : (
            <Badge size="sm" color="red" variant="light">
              En cours
            </Badge>
          ),
          project: (
            <>
              {context && editable(entry) ? (
                <EditableSelect
                  value={entry.projectId ?? null}
                  label="Projet de ce temps"
                  {...treeSelectProps(context.projectOptions(context.projects.filter((project) => !project.archived || project.id === entry.projectId)))}
                  onSave={(next) => (next || entry.routineId) && bulk('project')(entry, { projectId: next || null })}
                />
              ) : entry.projectId && entry.projectId !== projectId ? (
                context?.projectById.get(entry.projectId)?.title
              ) : null}
            </>
          ),
          routine: <TimeRoutineCell entry={entry} readOnly={!editable(entry)} save={bulk('routine')} />,
          tasks:
            context && editable(entry) ? (
              <TimeTasksCell entry={entry} context={context} readOnly={false} save={bulk('tasks')} />
            ) : (
              <StackedValues>
                {tasks.map((task) => (
                  <TaskRef key={task.id} task={task} blocked={context?.isBlocked(task) ?? false} />
                ))}
              </StackedValues>
            ),
          event: <TimeEventCell entry={entry} readOnly={!editable(entry)} save={bulk('event')} />,
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
    />
  );
}
