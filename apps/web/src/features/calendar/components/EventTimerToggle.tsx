import type { ActionIconProps } from '@mantine/core';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { runningOn, useRunningTimers } from '../../time/api';
import { TimerToggle } from '../../time/components/TimerToggle';
import { archivedIds } from '../../../lib/archive';
import { useCalendars, type EventOccurrence } from '../api';
import { eventTimerInput, onEventOccurrence } from '../lib/event-timer';

interface EventTimerToggleProps {
  context: TaskContext;
  occurrence: EventOccurrence;
  /** No start. Optional. Default = the event archived, or its calendar. */
  disabled?: boolean;
  /** Size of the button. Optional. */
  size?: ActionIconProps['size'];
}

/**
 * « Démarrer le chrono » of an occurrence of an event in a row (or stopping the one running on it): the timer takes
 * its project and its linked tasks, as « Temps passé » of its panel (`eventTimerInput`).
 * @param {EventTimerToggleProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function EventTimerToggle({ context, occurrence, disabled, size }: EventTimerToggleProps) {
  const running = useRunningTimers();
  const { data: calendarsData } = useCalendars();
  const readOnly = disabled ?? (occurrence.archived || archivedIds(calendarsData?.calendars ?? []).has(occurrence.calendarId));
  const mine = runningOn(running.data, onEventOccurrence(occurrence));
  return <TimerToggle name={occurrence.label} mine={mine} input={eventTimerInput(context, occurrence, occurrence)} disabled={readOnly} size={size} />;
}
