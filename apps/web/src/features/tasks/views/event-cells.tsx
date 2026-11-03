import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { ArrowsClockwiseIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import type { EventOccurrence } from '../../calendar/api';
import { useEventForm } from '../../calendar/use-event-form';
import classes from '../TaskTable.module.css';
import type { TaskContext } from '../use-task-context';
import { eventWhen } from './event-format';

/**
 * Title of an event row: calendar icon, title (opens the event) and place.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element} Cell.
 */
export function EventTitleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const openEvent = useEventForm(context);
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
      <UnstyledButton onClick={() => openEvent({ occurrence: event })} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} truncate>
          {event.title}
        </Text>
      </UnstyledButton>
      {event.location && (
        <Text size="xs" c="dimmed" truncate style={{ flex: 'none', maxWidth: '40%' }}>
          {event.location}
        </Text>
      )}
    </Group>
  );
}

/**
 * People of an event.
 * @param {{ event: EventOccurrence, context: TaskContext }} props Occurrence and task context.
 * @returns {JSX.Element | null} Cell.
 */
export function EventPeopleCell({ event, context }: { event: EventOccurrence; context: TaskContext }) {
  const names = event.contributorIds
    .map((id) => context.contributorById.get(id))
    .filter((contributor) => contributor !== undefined)
    .map((contributor) => context.contributorName(contributor));
  if (names.length === 0) return null;
  return (
    <Text size="sm" truncate title={names.join(', ')}>
      {names.join(', ')}
    </Text>
  );
}

/**
 * Start or end of an event.
 * @param {{ event: EventOccurrence, side: 'start' | 'end' }} props Occurrence and side.
 * @returns {JSX.Element} Cell.
 */
export function EventWhenCell({ event, side }: { event: EventOccurrence; side: 'start' | 'end' }) {
  return (
    <Text size="sm" truncate>
      {eventWhen(event, side)}
    </Text>
  );
}
