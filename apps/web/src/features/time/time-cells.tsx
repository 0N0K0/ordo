import { Anchor, Popover, Select, Text } from '@mantine/core';
import { formatDuration, parseDuration } from '@ordo/shared';
import { useState } from 'react';
import { EditableDate, EditableMultiSelect, EditableText } from '../../components/data-table/EditableCells';
import { TimeField } from '../../components/TimeField';
import { localDay } from '../../lib/dates';
import * as fmt from '../../lib/format';
import { useCalendarEvents } from '../calendar/api';
import { localParts } from '../calendar/event-input';
import { useRoutinesData } from '../routines/api';
import { taskRef, type TaskContext } from '../tasks/use-task-context';
import { entrySeconds } from '@ordo/shared';
import type { TimeEntry, TimeEntryValues } from './api';
import { timeTasks } from './time-tasks';
import { applyDiff, type BulkChange } from '../../components/data-table/bulk-edit';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { routineTreeOptions } from '../routines/routine-format';

type Save = (entry: TimeEntry, change: BulkChange<TimeEntry, Partial<TimeEntryValues>>) => void;

/** Cells do not open the time when used. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Day of a time, changed in place (its hour kept).
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeDayCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const start = localParts(new Date(entry.startedAt));
  if (readOnly) return <>{fmt.dayLong(new Date(entry.startedAt))}</>;
  return (
    <EditableDate
      value={start.date}
      label="Jour de ce temps"
      onSave={(date) => date && date !== start.date && save(entry, (row) => ({ startedAt: new Date(`${date}T${localParts(new Date(row.startedAt)).time}`).toISOString() }))}
    />
  );
}

/**
 * Start of a time, changed in place.
 * @param {{ entry: TimeEntry, readOnly: boolean, save: Save }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeStartCell({ entry, readOnly, save }: { entry: TimeEntry; readOnly: boolean; save: Save }) {
  const start = localParts(new Date(entry.startedAt));
  if (readOnly) return <>{start.time}</>;
  return (
    <TimeField
      variant="unstyled"
      size="xs"
      aria-label="Heure de début de ce temps"
      value={start.time}
      onChange={(time) => time && time !== start.time && save(entry, (row) => ({ startedAt: new Date(`${localParts(new Date(row.startedAt)).date}T${time}`).toISOString() }))}
      onClick={stop}
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
      onClick={stop}
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
  const day = localDay(new Date(entry.startedAt));
  const { data: events } = useCalendarEvents(opened ? { from: day, to: day } : null);
  const current = entry.calendarEventId ? `${entry.calendarEventId}|${entry.calendarOccurrenceDate ? String(entry.calendarOccurrenceDate) : ''}` : null;
  const options = (events ?? []).map((occurrence) => ({
    value: `${occurrence.eventId}|${occurrence.occurrenceDate ?? ''}`,
    label: `${occurrence.allDay ? 'Journée' : `${occurrence.startTime}–${occurrence.endTime}`} · ${occurrence.title}`,
  }));
  if (current && !options.some((option) => option.value === current)) options.unshift({ value: current, label: entry.calendarEventTitle ?? 'Évènement' });
  if (readOnly) return <>{entry.calendarEventTitle}</>;
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={320}>
      <Popover.Target>
        <Anchor component="button" type="button" size="sm" c={entry.calendarEventTitle ? undefined : 'dimmed'} onClick={(event) => (stop(event), setOpened((value) => !value))} truncate>
          {entry.calendarEventTitle ?? '—'}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <Select
          label="Évènement du jour"
          placeholder="Aucun"
          clearable
          data={options}
          value={current}
          onChange={(key) => {
            save(entry, { event: key ? { eventId: key.split('|')[0], occurrenceDate: key.split('|')[1] || null } : null });
            setOpened(false);
          }}
          comboboxProps={{ withinPortal: false }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
