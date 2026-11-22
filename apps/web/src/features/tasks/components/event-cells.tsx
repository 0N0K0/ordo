import { Badge, Box, Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { DateTimeField } from '../../../components/inputs/DateTimeField';
import { addDays, daysBetween, formatDuration } from '@ordo/shared';
import { ArrowsClockwiseIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import { useNow } from '../../../lib/use-now';

import { notifySuccess, ON_ERROR } from '../../../lib/notify';
import { countOf } from '../../../lib/text';
import { applyDiff, bulkTargets, useBulkTable } from '../../../components/data-table/selection/bulk-edit';
import { eventRowKey, type TaskTableRow } from '../lib/task-columns';
import type { TaskColumn } from '@ordo/shared';
import { askScope } from '../../calendar/lib/ask-scope';
import { useCalendarEventMutations, type CalendarEventInput, type CalendarEventScope, type EventOccurrence } from '../../calendar/api';
import { occurrenceInput } from '../../calendar/lib/event-input';
import { useEventForm } from '../../calendar/hooks/use-event-form';
import classes from './TaskTable.module.css';
import type { TaskContext } from '../hooks/use-task-context';
import { EVENT_STATES, eventState } from '../lib/event-format';

import { itemCellLabel, stoppedCellField } from '../../../components/data-table/cells/cell-field';
import * as fmt from '../../../lib/format';
import { AssigneesCell } from './context-cells';
import { BeneficiariesCell } from '../../beneficiaries/components/BeneficiariesSelect';
import { beneficiariesDiff } from '../../beneficiaries/lib/beneficiaries-diff';
import { LocationText } from '../../geo/components/LocationText';

/**
 * Days an event is postponed to, in its tooltip: « Reporté au » a day, or the days one under the other.
 * @param {{ days: string[] }} props Days (YYYY-MM-DD).
 * @returns {JSX.Element} Text.
 */
function PostponedTo({ days }: { days: string[] }) {
  if (days.length === 1) return <>Reporté au {fmt.day(days[0]!)}</>;
  return (
    <Stack gap={0}>
      <span>Reporté aux :</span>
      {days.map((day) => (
        <span key={day}>{fmt.day(day)}</span>
      ))}
    </Stack>
  );
}

/**
 * Title of an event row: calendar icon, title (opens the event; struck through when cancelled or postponed) and
 * place (its zones one under the other).
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventLabelCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const openEvent = useEventForm(context);
  // Cancelled or postponed: struck through, like in the calendar.
  const postponed = event.postponedTo.length > 0;
  const struck = event.calledOff || postponed;
  const reason = postponed ? <PostponedTo days={event.postponedTo.map((item) => item.startDate)} /> : 'Annulé';
  return (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      <Tooltip label="Évènement" withArrow>
        <Box component="span" c="blue.6" aria-label="Évènement" role="img" style={{ display: 'inline-flex', flex: 'none' }}>
          <CalendarBlankIcon weight="fill" />
        </Box>
      </Tooltip>
      {Boolean(event.recurrence) && (
        <Tooltip label="Évènement récurrent">
          <ArrowsClockwiseIcon aria-label="Récurrent" className={classes.recurring} />
        </Tooltip>
      )}
      <Tooltip label={reason} disabled={!struck}>
        <UnstyledButton onClick={() => openEvent({ occurrence: event })} style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate td={struck ? 'line-through' : undefined} c={struck ? 'dimmed' : undefined}>
            {event.label}
          </Text>
        </UnstyledButton>
      </Tooltip>
      {event.location && (
        <Box style={{ flex: 'none', maxWidth: '40%', minWidth: 0 }}>
          <LocationText location={event.location} size="xs" c="dimmed" />
        </Box>
      )}
    </Group>
  );
}

/**
 * Events an edit of an event cell applies to: those of the selection of the table (on this column), else this one.
 * @param {EventOccurrence} event Occurrence edited.
 * @param {TaskColumn} column Column edited.
 * @returns {() => EventOccurrence[]} Events, read when called.
 */
function useEventTargets(event: EventOccurrence, column: TaskColumn) {
  const table = useBulkTable<TaskTableRow>();
  return () => {
    const events = (table?.rows ?? []).flatMap((row) => (row.kind === 'event' ? [row.event] : []));
    return bulkTargets({ selection: table?.selection ?? null, keyOf: eventRowKey, rows: events }, column, event);
  };
}

/**
 * Accessible label of an event cell (itemCellLabel): « Début de l’évènement « X » », or the bulk edit of a selection.
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskColumn} column Column.
 * @param {string} field Field name.
 * @returns {string} Label.
 */
function useEventCellLabel(event: EventOccurrence, column: TaskColumn, field: string): string {
  return itemCellLabel(field, `l’évènement « ${event.label} »`, useEventTargets(event, column)().length);
}

/**
 * Saving of an event cell: the event (its series for a recurring one, the occurrences asked once), or every event
 * of the bulk selection of its column, each with its own change (its people kept, its own length…). A field of the
 * whole series (people, beneficiaries…) does not offer « Cette occurrence ».
 * @param {EventOccurrence} event Occurrence edited.
 * @param {TaskColumn} column Column edited.
 * @param {boolean} [series=false] Whether the column edits a field of the whole series. Optional. Default = false.
 * @returns {(changes: Partial<CalendarEventInput> | ((target: EventOccurrence) => Partial<CalendarEventInput>)) => Promise<void>} Saver.
 */
function useEventSave(event: EventOccurrence, column: TaskColumn, series = false) {
  const { update } = useCalendarEventMutations();
  const targetsOf = useEventTargets(event, column);
  return async (changes: Partial<CalendarEventInput> | ((target: EventOccurrence) => Partial<CalendarEventInput>)) => {
    const targets = targetsOf();
    let scope: CalendarEventScope = 'ALL';
    if (targets.some((target) => target.occurrenceDate)) {
      const chosen = await askScope({ action: 'update', allowThis: !series });
      if (!chosen) return;
      scope = chosen;
    }
    for (const target of targets) {
      const change = typeof changes === 'function' ? changes(target) : changes;
      if (!Object.keys(change).length) continue;
      update.mutate({ id: target.eventId, scope: target.occurrenceDate ? scope : 'ALL', occurrenceDate: target.occurrenceDate, input: { ...occurrenceInput(target), ...change } }, ON_ERROR);
    }
    if (targets.length > 1) notifySuccess(`Modification appliquée à ${countOf(targets.length, 'évènement')}.`);
  };
}

/**
 * People of an event, like the assignees of a task: a multi-select (several in one go), saved when its list closes.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventPeopleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const save = useEventSave(event, 'assignees', true);
  const label = useEventCellLabel(event, 'assignees', 'Personnes');
  return (
    <AssigneesCell
      value={event.contributorIds}
      projectId={event.projectId}
      context={context}
      label={label}
      onSave={(contributorIds) => void save((target) => ({ contributorIds: applyDiff(target.contributorIds, event.contributorIds, contributorIds) }))}
    />
  );
}

/**
 * Status of an event, read only: to come, ongoing, over, cancelled or postponed (like the label of a task status),
 * updated as time goes.
 * @param {{ event: EventOccurrence }} props Occurrence.
 * @returns {JSX.Element} Cell.
 */
export function EventStatusCell({ event }: { event: EventOccurrence }) {
  // Read again each minute: an event to come starts, an ongoing one ends.
  const now = useNow(true, 60_000);
  const { label, color } = EVENT_STATES[eventState(event, now)];
  return (
    <Badge variant="light" color={color} radius="sm">
      {label}
    </Badge>
  );
}

/**
 * Time tracked on an event (its timers).
 * @param {{ event: EventOccurrence }} props Occurrence.
 * @returns {JSX.Element | null} Cell.
 */
export function EventTimeCell({ event }: { event: EventOccurrence }) {
  if (!event.trackedSeconds) return null;
  return (
    <Text size="sm" ta="right">
      {formatDuration(event.trackedSeconds)}
    </Text>
  );
}

/**
 * Wall time of a date and a time, in ms (kept as UTC: only the difference between two of them counts).
 * @param {string} date YYYY-MM-DD.
 * @param {string | null} time HH:MM.
 * @returns {number} Ms.
 */
const wall = (date: string, time: string | null) => Date.parse(`${date}T${time ?? '00:00'}:00Z`);

/**
 * Date and time of a wall time in ms.
 * @param {number} ms Ms.
 * @returns {{ date: string, time: string }} YYYY-MM-DD and HH:MM.
 */
const fromWall = (ms: number) => {
  const iso = new Date(ms).toISOString();
  // A wall time kept as UTC on purpose (see wall): its UTC parts are the wanted ones.
  // eslint-disable-next-line no-restricted-syntax
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

/**
 * Length of a timed event, in ms.
 * @param {EventOccurrence} event Occurrence.
 * @returns {number} Ms.
 */
const lengthOf = (event: EventOccurrence) => wall(event.endDate, event.endTime ?? null) - wall(event.startDate, event.startTime ?? null);

/**
 * Days an all-day event spans after its first one.
 * @param {EventOccurrence} event Occurrence.
 * @returns {number} Days.
 */
const spanOf = (event: EventOccurrence) => daysBetween(event.startDate, event.endDate);

/**
 * Start or end of an event, edited in place (its day for an all-day event, else its date and time, in its own time
 * zone). Moving the start moves the end too (same duration); an end set before the start moves the start to it.
 * @param {{ event: EventOccurrence, side: 'start' | 'end' }} props Occurrence and side.
 * @returns {JSX.Element} Cell.
 */
export function EventWhenCell({ event, side }: { event: EventOccurrence; side: 'start' | 'end' }) {
  const column = side === 'start' ? 'startDate' : 'endDate';
  const save = useEventSave(event, column);
  const label = useEventCellLabel(event, column, side === 'start' ? 'Début' : 'Fin');
  const startDate = event.startDate;
  const endDate = event.endDate;

  if (event.allDay) {
    return (
      <DateField
        {...stoppedCellField}
        aria-label={label}
        value={side === 'start' ? startDate : endDate}
        minDate={side === 'end' ? startDate : undefined}
        onChange={(date) => {
          if (!date) return;
          // Each event keeps its own length; an end set before its start brings the start to it.
          if (side === 'end') void save((target) => (date >= target.startDate ? { endDate: date } : { startDate: date, endDate: date }));
          else void save((target) => ({ startDate: date, endDate: addDays(date, spanOf(target)) }));
        }}
        popoverProps={{ withinPortal: true }}
      />
    );
  }

  return (
    <DateTimeField
      {...stoppedCellField}
      aria-label={label}
      day={side === 'start' ? startDate : endDate}
      time={(side === 'start' ? event.startTime : event.endTime) ?? null}
      minDate={side === 'end' ? startDate : undefined}
      onChange={(date, clock) => {
        if (!date || !clock) return;
        const moved = wall(date, clock);
        if (side === 'start') {
          // Each event keeps its own length.
          void save((target) => {
            const newEnd = fromWall(moved + lengthOf(target));
            return { startDate: date, startTime: clock, endDate: newEnd.date, endTime: newEnd.time };
          });
        } else {
          // An end set before the start brings the start to it.
          const end = { endDate: date, endTime: clock };
          void save((target) => (moved >= wall(target.startDate, target.startTime ?? null) ? end : { ...end, startDate: date, startTime: end.endTime }));
        }
      }}
      popoverProps={{ withinPortal: true }}
    />
  );
}

/**
 * « Bénéficiaires » cell of an event: whom it is for (contributors and relations), saved on the event (the whole
 * series for a recurring one).
 * @param {{ event: EventOccurrence }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EventBeneficiariesCell({ event }: { event: EventOccurrence }) {
  const save = useEventSave(event, 'beneficiaries', true);
  const label = useEventCellLabel(event, 'beneficiaries', 'Bénéficiaires');
  return <BeneficiariesCell label={label} value={event} onSave={(beneficiaries) => void save((target) => beneficiariesDiff(target, event, beneficiaries))} />;
}
