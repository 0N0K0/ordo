import { Avatar, Badge, Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { formatDuration } from '@ordo/shared';
import { ArrowsClockwiseIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import { useEffect, useState, type MouseEvent } from 'react';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';
import { notifyError } from '../../../lib/notify';
import { askScope } from '../../calendar/ask-scope';
import { useCalendarEventMutations, type CalendarEventInput, type CalendarEventScope, type EventOccurrence } from '../../calendar/api';
import { occurrenceInput } from '../../calendar/event-input';
import { useEventForm } from '../../calendar/use-event-form';
import classes from '../TaskTable.module.css';
import type { TaskContext } from '../use-task-context';
import { EVENT_STATES, eventState } from './event-format';
import cellClasses from '../../../components/data-table/EditableCells.module.css';
import { StackedMultiCell } from './StackedMultiCell';

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
  const reason = postponed ? `Reporté au ${event.postponedTo.map((item) => new Date(`${String(item.startDate)}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })).join(', ')}` : 'Annulé';
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
const cellField = { variant: 'unstyled', size: 'xs', classNames: { root: cellClasses.root, input: cellClasses.input, section: cellClasses.section }, onClick: stop } as const;

/**
 * Saving of changes to an event from the table: for an occurrence of a recurring event, asks first which ones change
 * (this one, the following ones, all), like the calendar.
 * @param {EventOccurrence} event Occurrence.
 * @returns {(changes: Partial<CalendarEventInput>) => Promise<void>} Save.
 */
function useEventSave(event: EventOccurrence) {
  const { update } = useCalendarEventMutations();
  return async (changes: Partial<CalendarEventInput>) => {
    let scope: CalendarEventScope = 'ALL';
    if (event.occurrenceDate) {
      const chosen = await askScope({ action: 'update' });
      if (!chosen) return;
      scope = chosen;
    }
    update.mutate({ id: event.eventId, scope, occurrenceDate: event.occurrenceDate, input: { ...occurrenceInput(event), ...changes } }, { onError: (error) => notifyError(error.message) });
  };
}

/**
 * People of an event, like the assignees of a task: a multi-select (several in one go), saved when its list closes.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventPeopleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const save = useEventSave(event);
  const label = `Personnes de l’évènement ${event.title}`;
  return (
    <StackedMultiCell
      label={label}
      items={event.contributorIds.flatMap((id) => {
        const contributor = context.contributorById.get(id);
        return contributor
          ? [{ id, label: context.contributorName(contributor), icon: <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={16} style={{ flexShrink: 0 }} /> }]
          : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellField}
          comboboxProps={{ withinPortal: true, width: 'max-content', position: 'bottom-start' }}
          classNames={{ ...cellField.classNames, pillsList: cellClasses.pills }}
          aria-label={label}
          data={context.assignableFor(event.projectId ? [event.projectId] : [], event.contributorIds).map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
          renderOption={({ option }) => {
            const contributor = context.contributorById.get(option.value);
            return (
              <Group gap="xs" wrap="nowrap">
                <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />
                {option.label}
              </Group>
            );
          }}
          value={event.contributorIds}
          onChange={(contributorIds) => void save({ contributorIds })}
          onDropdownClose={onDropdownClose}
          placeholder={event.contributorIds.length ? undefined : '—'}
          searchable
        />
      )}
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
 * Start or end of an event, edited in place (its day for an all-day event, else its date and time, in its own time
 * zone). Moving the start moves the end too (same duration); the end never goes before the start.
 * @param {{ event: EventOccurrence, side: 'start' | 'end' }} props Occurrence and side.
 * @returns {JSX.Element} Cell.
 */
export function EventWhenCell({ event, side }: { event: EventOccurrence; side: 'start' | 'end' }) {
  const save = useEventSave(event);
  const label = `${side === 'start' ? 'Début' : 'Fin'} de l’évènement ${event.title}`;
  const startDate = String(event.startDate);
  const endDate = String(event.endDate);

  if (event.allDay) {
    const days = Math.round((wall(endDate, null) - wall(startDate, null)) / 86_400_000);
    return (
      <DatePickerInput
        {...cellField}
        aria-label={label}
        valueFormat="D MMM YYYY"
        value={side === 'start' ? startDate : endDate}
        minDate={side === 'end' ? startDate : undefined}
        onChange={(date) => {
          if (!date) return;
          if (side === 'end') void save({ endDate: date });
          else void save({ startDate: date, endDate: fromWall(wall(date, null) + days * 86_400_000).date });
        }}
        popoverProps={{ withinPortal: true }}
      />
    );
  }

  const start = wall(startDate, event.startTime ?? null);
  const end = wall(endDate, event.endTime ?? null);
  const value = side === 'start' ? `${startDate} ${event.startTime}:00` : `${endDate} ${event.endTime}:00`;
  return (
    <DateTimePicker
      {...cellField}
      aria-label={label}
      valueFormat="D MMM YYYY HH:mm"
      value={value}
      minDate={side === 'end' ? startDate : undefined}
      onChange={(next) => {
        if (!next) return;
        const [date, clock] = next.split(' ');
        const moved = wall(date, clock.slice(0, 5));
        if (side === 'start') {
          const newEnd = fromWall(moved + (end - start));
          void save({ startDate: date, startTime: clock.slice(0, 5), endDate: newEnd.date, endTime: newEnd.time });
        } else if (moved < start) notifyError('La fin ne peut pas être avant le début.');
        else void save({ endDate: date, endTime: clock.slice(0, 5) });
      }}
      popoverProps={{ withinPortal: true }}
    />
  );
}
