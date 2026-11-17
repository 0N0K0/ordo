import { Badge, Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { formatDuration } from '@ordo/shared';
import { ArrowsClockwiseIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import { useEffect, useState, type MouseEvent } from 'react';

import { notifyError, notifySuccess, onMutationError } from '../../../lib/notify';
import { applyDiff, bulkTargets, useBulkTable } from '../../../components/data-table/bulk-edit';
import { eventKey, type TaskTableRow } from '../task-columns';
import type { TaskColumn } from '@ordo/shared';
import { askScope } from '../../calendar/ask-scope';
import { useCalendarEventMutations, type CalendarEventInput, type CalendarEventScope, type EventOccurrence } from '../../calendar/api';
import { occurrenceInput } from '../../calendar/event-input';
import { useEventForm } from '../../calendar/use-event-form';
import classes from '../TaskTable.module.css';
import type { TaskContext } from '../use-task-context';
import { EVENT_STATES, eventState } from './event-format';

import { cellField as sharedField } from '../../../components/data-table/cell-field';
import * as fmt from '../../../lib/format';
import { AssigneesCell } from './context-cells';
import { BeneficiariesCell } from '../../beneficiaries/BeneficiariesSelect';

/**
 * Title of an event row: calendar icon, title (opens the event; struck through when cancelled or postponed) and
 * place.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventTitleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const openEvent = useEventForm(context);
  // Cancelled or postponed: struck through, like in the calendar.
  const postponed = event.postponedTo.length > 0;
  const struck = event.calledOff || postponed;
  const reason = postponed ? `Reporté au ${event.postponedTo.map((item) => fmt.day(String(item.startDate))).join(', ')}` : 'Annulé';
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
            {event.title}
          </Text>
        </UnstyledButton>
      </Tooltip>
      {event.location && (
        <Text size="xs" c="dimmed" truncate style={{ flex: 'none', maxWidth: '40%' }}>
          {event.location}
        </Text>
      )}
    </Group>
  );
}

/**
 * Keeps a click in a cell field from reaching the row (opening the task panel, selecting the row).
 * @param {MouseEvent} event Click.
 * @returns {void}
 */
const stop = (event: MouseEvent) => event.stopPropagation();

/** Look of the cell fields, like those of the tasks. */
/** Fields of the cells, a click kept from the row. */
const cellField = { ...sharedField, onClick: stop } as const;

/**
 * Saving of an event cell: the event (its series for a recurring one, the occurrences asked once), or every event
 * of the bulk selection of its column, each with its own change (its people kept, its own length…).
 * @param {EventOccurrence} event Occurrence edited.
 * @param {TaskColumn} column Column edited.
 * @returns {(changes: Partial<CalendarEventInput> | ((target: EventOccurrence) => Partial<CalendarEventInput>)) => Promise<void>} Saver.
 */
function useEventSave(event: EventOccurrence, column: TaskColumn) {
  const { update } = useCalendarEventMutations();
  const table = useBulkTable<TaskTableRow>();
  return async (changes: Partial<CalendarEventInput> | ((target: EventOccurrence) => Partial<CalendarEventInput>)) => {
    // The events of the selection of the table (on this column), else this one.
    const events = (table?.rows ?? []).flatMap((row) => (row.kind === 'event' ? [row.event] : []));
    const targets = bulkTargets({ selection: table?.selection ?? null, keyOf: eventKey, rows: events }, column, event);
    let scope: CalendarEventScope = 'ALL';
    if (targets.some((target) => target.occurrenceDate)) {
      const chosen = await askScope({ action: 'update' });
      if (!chosen) return;
      scope = chosen;
    }
    for (const target of targets) {
      const change = typeof changes === 'function' ? changes(target) : changes;
      if (!Object.keys(change).length) continue;
      update.mutate(
        { id: target.eventId, scope: target.occurrenceDate ? scope : 'ALL', occurrenceDate: target.occurrenceDate, input: { ...occurrenceInput(target), ...change } },
        { onError: onMutationError },
      );
    }
    if (targets.length > 1) notifySuccess(`Modification appliquée à ${targets.length} évènements.`);
  };
}

/**
 * People of an event, like the assignees of a task: a multi-select (several in one go), saved when its list closes.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventPeopleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const save = useEventSave(event, 'assignees');
  return (
    <AssigneesCell
      value={event.contributorIds}
      projectId={event.projectId}
      context={context}
      label={`Personnes de l’évènement ${event.title}`}
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { label, color } = EVENT_STATES[eventState(event, now)];
  return (
    <Badge variant="light" color={color} radius="sm" style={{ textTransform: 'none' }}>
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
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

/**
 * Length of a timed event, in ms.
 * @param {EventOccurrence} event Occurrence.
 * @returns {number} Ms.
 */
const lengthOf = (event: EventOccurrence) => wall(String(event.endDate), event.endTime ?? null) - wall(String(event.startDate), event.startTime ?? null);

/**
 * Days an all-day event spans after its first one.
 * @param {EventOccurrence} event Occurrence.
 * @returns {number} Days.
 */
const spanOf = (event: EventOccurrence) => Math.round((wall(String(event.endDate), null) - wall(String(event.startDate), null)) / 86_400_000);

/**
 * Start or end of an event, edited in place (its day for an all-day event, else its date and time, in its own time
 * zone). Moving the start moves the end too (same duration); the end never goes before the start.
 * @param {{ event: EventOccurrence, side: 'start' | 'end' }} props Occurrence and side.
 * @returns {JSX.Element} Cell.
 */
export function EventWhenCell({ event, side }: { event: EventOccurrence; side: 'start' | 'end' }) {
  const save = useEventSave(event, side === 'start' ? 'startDate' : 'endDate');
  const label = `${side === 'start' ? 'Début' : 'Fin'} de l’évènement ${event.title}`;
  const startDate = String(event.startDate);
  const endDate = String(event.endDate);

  if (event.allDay) {
    return (
      <DatePickerInput
        {...cellField}
        aria-label={label}
        value={side === 'start' ? startDate : endDate}
        minDate={side === 'end' ? startDate : undefined}
        onChange={(date) => {
          if (!date) return;
          // Each event keeps its own length; an end never comes before its start.
          if (side === 'end') void save((target) => (date >= String(target.startDate) ? { endDate: date } : {}));
          else void save((target) => ({ startDate: date, endDate: fromWall(wall(date, null) + spanOf(target) * 86_400_000).date }));
        }}
        popoverProps={{ withinPortal: true }}
      />
    );
  }

  const start = wall(startDate, event.startTime ?? null);
  const value = side === 'start' ? `${startDate} ${event.startTime}:00` : `${endDate} ${event.endTime}:00`;
  return (
    <DateTimePicker
      {...cellField}
      aria-label={label}
      value={value}
      minDate={side === 'end' ? startDate : undefined}
      onChange={(next) => {
        if (!next) return;
        const [date, clock] = next.split(' ');
        const moved = wall(date, clock.slice(0, 5));
        if (side === 'start') {
          // Each event keeps its own length.
          void save((target) => {
            const newEnd = fromWall(moved + lengthOf(target));
            return { startDate: date, startTime: clock.slice(0, 5), endDate: newEnd.date, endTime: newEnd.time };
          });
        } else if (moved < start) notifyError('La fin ne peut pas être avant le début.');
        else void save((target) => (moved >= wall(String(target.startDate), target.startTime ?? null) ? { endDate: date, endTime: clock.slice(0, 5) } : {}));
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
  const save = useEventSave(event, 'beneficiaries');
  return (
    <BeneficiariesCell
      label={`Bénéficiaires de ${event.title}`}
      value={event}
      onSave={(beneficiaries) =>
        void save((target) => ({
          beneficiaryIds: applyDiff(target.beneficiaryIds, event.beneficiaryIds, beneficiaries.beneficiaryIds),
          beneficiaryRelationIds: applyDiff(target.beneficiaryRelationIds, event.beneficiaryRelationIds, beneficiaries.beneficiaryRelationIds),
        }))
      }
    />
  );
}
