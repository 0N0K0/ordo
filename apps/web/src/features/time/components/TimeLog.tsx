import { unarchived } from '../../../lib/archive';
import { plural, collator } from '../../../lib/text';
import { localDay } from '../../../lib/dates';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Text } from '@mantine/core';
import { entrySeconds, formatDuration, lineageOf } from '@ordo/shared';
import { ClockIcon, CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { ON_ERROR } from '../../../lib/notify';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView, withinFilter } from '../../../components/data-table/views/use-data-view';
import { TaskRef } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useRoutinesData } from '../../routines/api';
import { routineTreeOptions } from '../../routines/lib/routine-format';
import type { TreeOption } from '../../../components/tree/tree-select';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { TimeDayCell, TimeDurationCell, TimeEventCell, TimeRoutineCell, TimeStartCell, TimeTasksCell } from './time-cells';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { TIMER_RUNNING, TimerRunningBadge } from './TimerStop';

/**
 * Seconds of the finished times (a running timer counts once stopped).
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {number} Seconds.
 */
const finishedSeconds = (entries: readonly TimeEntry[]) => entries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0);

/**
 * Events the times were spent on, as filter options.
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {{ value: string, label: string }[]} Options.
 */
function events(entries: readonly TimeEntry[]): { value: string; label: string }[] {
  const byId = new Map<string, string>();
  for (const entry of entries) if (entry.calendarEventId) byId.set(entry.calendarEventId, entry.calendarEventLabel ?? 'Évènement');
  return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => collator.compare(a.label, b.label));
}

/** Views made the first time the times are shown, by day: this week (opened first), this month, every time. */
const TIME_VIEWS: FirstTableView[] = [
  { label: 'Cette semaine', config: { filter: withinFilter('day', 'thisWeek'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { label: 'Ce mois-ci', config: { filter: withinFilter('day', 'thisMonth'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { label: 'Tous', config: { groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
];

/**
 * Columns of the tracked times.
 * @param {TaskContext | null} context Task context (names of the projects and tasks).
 * @param {Map<string, number>} comments Comments of the times.
 * @param {TreeOption[]} routines Routines offered by the filter, as their tree.
 * @param {readonly TimeEntry[]} entries Times (their events offered by the filter).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
function timeColumns(context: TaskContext | null, comments: Map<string, number>, routines: TreeOption[], entries: readonly TimeEntry[]): DataColumn<TimeEntry>[] {
  const projectName = (entry: TimeEntry) => (entry.projectId ? (context?.projectLabel(entry.projectId) ?? '') : '');
  return [
    {
      id: 'day',
      bulk: true,
      label: 'Date',
      size: 200,
      locked: true,
      sortValue: (entry) => entry.startedAt,
      text: (entry) => fmt.capitalize(fmt.dayLong(entry.startedAt)),
      filter: { kind: 'date', value: (entry) => localDay(entry.startedAt) },
      groupable: true,
    },
    monthColumn('month', 'Mois', (entry) => entry.startedAt, 140),
    { id: 'start', bulk: true, label: 'Heure de début', size: 110, sortValue: (entry) => fmt.time(entry.startedAt), text: (entry) => fmt.time(entry.startedAt), filter: false },
    {
      id: 'end',
      label: 'Heure de fin',
      size: 110,
      sortValue: (entry) => (entry.endedAt ? fmt.time(entry.endedAt) : null),
      text: (entry) => (entry.endedAt ? fmt.time(entry.endedAt) : ''),
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
      text: (entry) => (entry.endedAt ? formatDuration(entrySeconds(entry)) : TIMER_RUNNING),
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
        value: (entry) => (context ? lineageOf(context.projectById, entry.projectId).map((project) => project.id) : []),
        options: context ? context.projectOptions(context.projects) : [],
      },
      groupable: true,
    },
    {
      id: 'routine',
      bulk: true,
      label: 'Routine',
      size: 180,
      sortValue: (entry) => entry.routineLabel ?? null,
      text: (entry) => entry.routineLabel ?? '',
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
      filter: { kind: 'choices', value: (entry) => entry.taskIds, options: (context?.tasks ?? []).map((task) => ({ value: task.id, label: context?.taskLabel(task) ?? task.label })) },
    },
    {
      id: 'event',
      bulk: true,
      label: 'Évènement',
      size: 200,
      sortValue: (entry) => entry.calendarEventLabel ?? null,
      text: (entry) => entry.calendarEventLabel ?? '',
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
    editable(entry) && update.mutate({ id: entry.id, input: change }, ON_ERROR);
  const { data: routinesData } = useRoutinesData();
  const routineOptions = routineTreeOptions(routinesData?.routines ?? []);
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
              risks: `${deletable.length} temps seront supprimés définitivement et retirés du temps passé de leurs tâches${deletable.length < rows.length ? ' (les temps facturés sont gardés)' : ''}.`,
              remove: (entry) => remove.mutateAsync(entry.id),
              done: `${deletable.length} temps ${plural(deletable.length, 'supprimé')}.`,
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
          month: fmt.capitalize(fmt.month(entry.startedAt)),
          start: <TimeStartCell entry={entry} readOnly={!editable(entry)} save={bulk('start')} />,
          end: entry.endedAt ? (
            <Text span size="sm" c="dimmed">
              {fmt.time(entry.endedAt)}
            </Text>
          ) : null,
          duration: entry.endedAt ? <TimeDurationCell entry={entry} readOnly={!editable(entry)} save={bulk('duration')} /> : <TimerRunningBadge />,
          project: (
            <>
              {context && editable(entry) ? (
                <EditableSelect
                  value={entry.projectId ?? null}
                  label="Projet de ce temps"
                  {...treeSelectProps(context.projectOptions(unarchived(context.projects, entry.projectId)))}
                  onSave={(next) => (next || entry.routineId) && bulk('project')(entry, { projectId: next || null })}
                />
              ) : entry.projectId && entry.projectId !== projectId ? (
                context?.projectById.get(entry.projectId)?.label
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
