import { Text } from '@mantine/core';
import { DURATION_TEXT_INVALID, formatDuration, parseDuration } from '@ordo/shared';
import type { ComponentProps, ReactNode } from 'react';
import { CellMultiSelect, EditableDate, EditableText, EditableTime } from '../../../components/data-table/cells/EditableCells';
import { StackedMultiCell, type StackedItem } from '../../../components/data-table/cells/StackedMultiCell';

import { localDay, localInstant, localParts } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useCalendarEvents } from '../../calendar/api';
import { useRoutinesData } from '../../routines/api';
import { type TaskContext } from '../../tasks/hooks/use-task-context';
import { entrySeconds } from '@ordo/shared';
import type { TimeEntry, TimeEntryValues } from '../api';
import { timeRoutineOptions, timeTaskOptions, timeTasks } from '../lib/time-tasks';
import { dayEventOptions } from '../lib/time-events';
import { TIME_SUBJECTS, type TimeSubjectKind } from '../lib/time-subjects';
import { applyDiff, type BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { treeSelectProps } from '../../../components/tree/tree-select';

type Save = (entry: TimeEntry, change: BulkChange<TimeEntry, Partial<TimeEntryValues>>) => void;

/**
 * Day of a time, changed in place (its hour kept).
 * @param {{ entry: TimeEntry, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeDayCell({ entry, readOnly, label, save }: { entry: TimeEntry; readOnly: boolean; label: string; save: Save }) {
  const start = localParts(entry.startedAt);
  if (readOnly) return <>{fmt.dayLong(entry.startedAt)}</>;
  return (
    <EditableDate
      value={start.date}
      label={label}
      onSave={(date) => date && date !== start.date && save(entry, (row) => ({ startedAt: localInstant(date, localParts(row.startedAt).time).toISOString() }))}
    />
  );
}

/**
 * Start of a time, changed in place.
 * @param {{ entry: TimeEntry, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeStartCell({ entry, readOnly, label, save }: { entry: TimeEntry; readOnly: boolean; label: string; save: Save }) {
  const start = localParts(entry.startedAt);
  if (readOnly) return <>{start.time}</>;
  return <EditableTime label={label} value={start.time} onSave={(time) => time && save(entry, (row) => ({ startedAt: localInstant(localParts(row.startedAt).date, time).toISOString() }))} />;
}

/**
 * Duration of a finished time, typed in place (1:30, 1h30, 90 or 1,5h).
 * @param {{ entry: TimeEntry, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeDurationCell({ entry, readOnly, label, save }: { entry: TimeEntry; readOnly: boolean; label: string; save: Save }) {
  const text = formatDuration(entrySeconds(entry));
  if (readOnly || !entry.endedAt)
    return (
      <Text span size="sm" ff="monospace">
        {text}
      </Text>
    );
  return (
    <EditableText
      value={text}
      label={label}
      validate={(value) => (parseDuration(value ?? '') ? null : DURATION_TEXT_INVALID)}
      onSave={(value) => {
        const seconds = parseDuration(value ?? '');
        if (seconds && seconds !== entry.duration) save(entry, { duration: seconds });
      }}
    />
  );
}

/** Multi-select of a subject cell, but its options. */
type SubjectSelectProps = Omit<ComponentProps<typeof CellMultiSelect>, 'data' | 'renderOption' | 'filter'>;

interface TimeSubjectCellProps {
  kind: TimeSubjectKind;
  entry: TimeEntry;
  readOnly: boolean;
  label: string;
  /** Values listed in the cell. */
  items: StackedItem[];
  /** Multi-select shown once the cell opens, given its value and handlers (its options added). */
  select: (props: SubjectSelectProps) => ReactNode;
  save: Save;
}

/**
 * Routines, tasks or events of a time, chosen in place (several of each): on a selection, each row gets
 * the ones added and loses the ones removed. Removing the last one of a time without project is refused by the API.
 * @param {TimeSubjectCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
function TimeSubjectCell({ kind, entry, readOnly, label, items, select, save }: TimeSubjectCellProps) {
  const subject = TIME_SUBJECTS[kind];
  const current = subject.ids(entry);
  return (
    <StackedMultiCell
      label={label}
      readOnly={readOnly}
      items={items}
      renderSelect={({ onDropdownClose }) => select({ label, value: current, onSave: (next) => save(entry, (row) => subject.change(applyDiff(subject.ids(row), current, next))), onDropdownClose })}
    />
  );
}

/**
 * Routines of a time, chosen in place among those of its project tree (and of no project).
 * @param {{ entry: TimeEntry, context: TaskContext, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeRoutinesCell({ entry, context, readOnly, label, save }: { entry: TimeEntry; context: TaskContext; readOnly: boolean; label: string; save: Save }) {
  const { data } = useRoutinesData();
  const ids = TIME_SUBJECTS.routines.ids(entry);
  return (
    <TimeSubjectCell
      kind="routines"
      entry={entry}
      readOnly={readOnly}
      label={label}
      items={entry.routines.map((routine) => ({ id: routine.id, label: routine.label }))}
      select={(props) => <CellMultiSelect {...props} {...treeSelectProps(timeRoutineOptions(context, data?.routines ?? [], entry.projectId ?? null, ids))} />}
      save={save}
    />
  );
}

/**
 * Tasks of a time, chosen in place among those of its project (and of no project).
 * @param {{ entry: TimeEntry, context: TaskContext, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeTasksCell({ entry, context, readOnly, label, save }: { entry: TimeEntry; context: TaskContext; readOnly: boolean; label: string; save: Save }) {
  const tasks = entry.taskIds.map((id) => context.taskById.get(id)).filter((task) => task !== undefined);
  return (
    <TimeSubjectCell
      kind="tasks"
      entry={entry}
      readOnly={readOnly}
      label={label}
      items={tasks.map((task) => ({ id: task.id, label: context.taskLabel(task) }))}
      select={(props) => <CellMultiSelect {...props} {...treeSelectProps(timeTaskOptions(context, timeTasks(context, entry.projectId ?? null, entry.taskIds)))} />}
      save={save}
    />
  );
}

/**
 * Multi-select of the events of the day of a time, loaded once its cell opens, with those of the time.
 * @param {SubjectSelectProps & { entry: TimeEntry }} props Component props.
 * @returns {JSX.Element} Multi-select.
 */
function DayEventsSelect({ entry, ...props }: SubjectSelectProps & { entry: TimeEntry }) {
  const day = localDay(entry.startedAt);
  const { data: events } = useCalendarEvents({ from: day, to: day });
  return <CellMultiSelect {...props} data={dayEventOptions(events ?? [], day, entry)} nothingFoundMessage="Aucun évènement ce jour-là" />;
}

/**
 * Events of a time, chosen in place among the events of its day (loaded when opened).
 * @param {{ entry: TimeEntry, readOnly: boolean, label: string, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeEventsCell({ entry, readOnly, label, save }: { entry: TimeEntry; readOnly: boolean; label: string; save: Save }) {
  const keys = TIME_SUBJECTS.events.ids(entry);
  return (
    <TimeSubjectCell
      kind="events"
      entry={entry}
      readOnly={readOnly}
      label={label}
      items={entry.events.map((link, index) => ({ id: keys[index], label: link.label }))}
      select={(props) => <DayEventsSelect {...props} entry={entry} />}
      save={save}
    />
  );
}
