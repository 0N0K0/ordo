import { stopClick } from '../../../components/data-table/cells/cell-field';
import { Select, Text } from '@mantine/core';
import { formatDuration, parseDuration } from '@ordo/shared';
import { useState } from 'react';
import { EditableDate, EditableMultiSelect, EditablePopoverCell, EditableText, EditableTime } from '../../../components/data-table/cells/EditableCells';

import { localDay, localInstant, localParts } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useCalendarEvents } from '../../calendar/api';
import { useRoutinesData } from '../../routines/api';
import { taskRef, type TaskContext } from '../../tasks/hooks/use-task-context';
import { entrySeconds } from '@ordo/shared';
import type { TimeEntry, TimeEntryValues } from '../api';
import { timeTasks } from '../lib/time-tasks';
import { dayEventOptions, entryEventKey, parseEventKey } from '../lib/time-events';
import { applyDiff, type BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { routineTreeOptions } from '../../routines/lib/routine-format';

type Save = (entry: TimeEntry, change: BulkChange<TimeEntry, Partial<TimeEntryValues>>) => void;

/**
 * Day of a time, changed in place (its hour kept).
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeDayCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const start = localParts(entry.startedAt);
  if (readOnly) return <>{fmt.dayLong(entry.startedAt)}</>;
  return (
    <EditableDate
      value={start.date}
      label="Jour de ce temps"
      onSave={(date) => date && date !== start.date && save(entry, (row) => ({ startedAt: localInstant(date, localParts(row.startedAt).time).toISOString() }))}
    />
  );
}

/**
 * Start of a time, changed in place.
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeStartCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const start = localParts(entry.startedAt);
  if (readOnly) return <>{start.time}</>;
  return (
    <EditableTime
      label="Heure de début de ce temps"
      value={start.time}
      onSave={(time) => time && save(entry, (row) => ({ startedAt: localInstant(localParts(row.startedAt).date, time).toISOString() }))}
    />
  );
}

/**
 * Duration of a finished time, typed in place (1:30, 1h30, 90 or 1,5h).
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeDurationCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
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
      label="Durée de ce temps"
      validate={(value) => (parseDuration(value ?? '') ? null : 'Durée attendue : 1:30, 1h30, 90 ou 1,5h.')}
      onSave={(value) => {
        const seconds = parseDuration(value ?? '');
        if (seconds && seconds !== entry.duration) save(entry, { duration: seconds });
      }}
    />
  );
}

/**
 * Routine of a time, chosen in place.
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeRoutineCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const { data } = useRoutinesData();
  if (readOnly) return <>{entry.routineTitle}</>;
  return (
    <Select
      variant="unstyled"
      size="xs"
      aria-label="Routine de ce temps"
      placeholder="—"
      clearable
      searchable
      {...treeSelectProps(routineTreeOptions(data?.routines ?? [], (routine) => !routine.archived || routine.id === entry.routineId))}
      value={entry.routineId ?? null}
      onChange={(routineId) => save(entry, { routineId })}
      onClick={stopClick}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

/**
 * Tasks of a time, chosen in place among those of its project (and of no project).
 * @param {{ entry: TimeEntry, context: TaskContext, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeTasksCell({ entry, context, readOnly, save }: { entry: TimeEntry; context: TaskContext; readOnly: boolean; save: Save }) {
  const options = timeTasks(context, entry.projectId ?? null, entry.taskIds).map((task) => ({ value: task.id, label: `${taskRef(task)}${task.title}` }));
  return (
    <EditableMultiSelect
      label="Tâches de ce temps"
      data={options}
      value={entry.taskIds}
      readOnly={readOnly}
      onSave={(taskIds) => save(entry, (row) => ({ taskIds: applyDiff(row.taskIds, entry.taskIds, taskIds) }))}
    />
  );
}

/**
 * Event of a time, chosen in place among the events of its day (loaded when opened).
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeEventCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const [opened, setOpened] = useState(false);
  const day = localDay(entry.startedAt);
  const { data: events } = useCalendarEvents(opened ? { from: day, to: day } : null);
  const current = entryEventKey(entry);
  const options = dayEventOptions(events ?? [], day);
  if (current && !options.some((option) => option.value === current)) options.unshift({ value: current, label: entry.calendarEventTitle ?? 'Évènement' });
  if (readOnly) return <>{entry.calendarEventTitle}</>;
  return (
    <EditablePopoverCell width={320} empty={!entry.calendarEventTitle} truncate opened={opened} onOpenedChange={setOpened} target={entry.calendarEventTitle ?? '—'}>
      <Select
        label="Évènement du jour"
        placeholder="Aucun"
        clearable
        data={options}
        value={current}
        onChange={(key) => {
          save(entry, { event: parseEventKey(key) });
          setOpened(false);
        }}
        comboboxProps={{ withinPortal: false }}
      />
    </EditablePopoverCell>
  );
}
