import { unarchived } from '../../../lib/archive';
import { plural } from '../../../lib/text';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Text } from '@mantine/core';
import { entrySeconds, formatDuration, sumOf } from '@ordo/shared';
import { ClockIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { ON_ERROR } from '../../../lib/notify';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView, withinFilter } from '../../../components/data-table/views/use-data-view';
import { TaskRef } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
import * as fmt from '../../../lib/format';
import { deleteRowsAction, duplicateRowsAction, rowMenuEntry, type DuplicateOptions } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { TimeDayCell, TimeDurationCell, TimeEventsCell, TimeRoutinesCell, TimeStartCell, TimeTasksCell } from './time-cells';
import { hasSubject } from '../lib/time-subjects';
import { billedText, labelsText, useTimeColumns } from '../hooks/use-time-columns';
import { TimerRunningBadge } from './TimerStop';
import { documentPath } from '../../../app/pages';

/**
 * Seconds of the finished times (a running timer counts once stopped).
 * @param {readonly TimeEntry[]} entries Times.
 * @returns {number} Seconds.
 */
const finishedSeconds = (entries: readonly TimeEntry[]) =>
  sumOf(
    entries.filter((entry) => entry.endedAt),
    (entry) => entrySeconds(entry),
  );

/** Views made the first time the times are shown, by day: this week (opened first), this month, every time. */
const TIME_VIEWS: FirstTableView[] = [
  { label: 'Cette semaine', config: { filter: withinFilter('day', 'thisWeek'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { label: 'Ce mois-ci', config: { filter: withinFilter('day', 'thisMonth'), groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
  { label: 'Tous', config: { groupBy: 'day', sorting: [{ id: 'day', desc: true }] } },
];

interface TimeLogProps {
  entries: TimeEntry[] | undefined;
  context: TaskContext | null;
  /** Project of the list (its views, and its times not named), null for every project. */
  projectId: string | null;
  emptyMessage: string;
  onEdit: (entry: TimeEntry) => void;
  /** « Dupliquer » of a time (`useTimeEntryDialogs`). */
  onDuplicate: DuplicateOptions<TimeEntry, string>;
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
  const columns = useTimeColumns(entries, context);
  const view = useDataView({
    tableKey: 'time-log',
    projectId,
    columns,
    rows: entries ?? [],
    title: 'Temps passé',
    first: TIME_VIEWS,
  });
  const cellLabelOf = bulkCellLabels(view, (entry: TimeEntry) => `temps du ${fmt.day(entry.startedAt)} à ${fmt.time(entry.startedAt)}`);
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
              risks: `${deletable.length} temps ${plural(deletable.length, 'sera', 'seront')} ${plural(deletable.length, 'supprimé')} définitivement et ${plural(deletable.length, 'retiré')} du temps passé de ${plural(deletable.length, 'ses', 'leurs')} tâches${deletable.length < rows.length ? ' (les temps facturés sont gardés)' : ''}.`,
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
          day: <TimeDayCell entry={entry} readOnly={!editable(entry)} label={cellLabelOf('day', entry, 'Jour')} save={bulk('day')} />,
          month: fmt.capitalize(fmt.month(entry.startedAt)),
          start: <TimeStartCell entry={entry} readOnly={!editable(entry)} label={cellLabelOf('start', entry, 'Heure de début')} save={bulk('start')} />,
          end: entry.endedAt ? (
            <Text span size="sm" c="dimmed">
              {fmt.time(entry.endedAt)}
            </Text>
          ) : null,
          duration: entry.endedAt ? <TimeDurationCell entry={entry} readOnly={!editable(entry)} label={cellLabelOf('duration', entry, 'Durée')} save={bulk('duration')} /> : <TimerRunningBadge />,
          project: (
            <>
              {context && editable(entry) ? (
                <EditableSelect
                  value={entry.projectId ?? null}
                  label={cellLabelOf('project', entry, 'Projet')}
                  {...treeSelectProps(context.projectOptions(unarchived(context.projects, entry.projectId)))}
                  // A time keeps at least a project, a task, a routine or an event.
                  onSave={(next) => (next || hasSubject(entry)) && bulk('project')(entry, { projectId: next || null })}
                />
              ) : entry.projectId && entry.projectId !== projectId ? (
                context?.projectById.get(entry.projectId)?.label
              ) : null}
            </>
          ),
          routine: context ? (
            <TimeRoutinesCell entry={entry} context={context} readOnly={!editable(entry)} label={cellLabelOf('routine', entry, 'Routines')} save={bulk('routine')} />
          ) : (
            labelsText(entry.routines)
          ),
          tasks:
            context && editable(entry) ? (
              <TimeTasksCell entry={entry} context={context} readOnly={false} label={cellLabelOf('tasks', entry, 'Tâches')} save={bulk('tasks')} />
            ) : (
              <StackedValues>
                {tasks.map((task) => (
                  <TaskRef key={task.id} task={task} blocked={context?.isBlocked(task) ?? false} />
                ))}
              </StackedValues>
            ),
          event: <TimeEventsCell entry={entry} readOnly={!editable(entry)} label={cellLabelOf('event', entry, 'Évènements')} save={bulk('event')} />,
          invoice: entry.documentId && (
            <Badge size="sm" variant="light" color={entry.documentNumber ? 'green' : 'gray'} component={Link} to={documentPath(entry.documentId)} style={{ cursor: 'pointer' }}>
              {billedText(entry)}
            </Badge>
          ),
        };
      }}
      actions={(entry) =>
        // The running timer is edited from the timer; time on a final invoice is part of it (copied still).
        entry.endedAt && (
          <RowActions
            about="ce temps"
            primary={!entry.documentNumber && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => onEdit(entry) }}
            items={[
              rowMenuEntry(duplicateRowsAction([entry], onDuplicate)),
              !entry.documentNumber && { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => onDelete(entry) },
            ]}
          />
        )
      }
    />
  );
}
