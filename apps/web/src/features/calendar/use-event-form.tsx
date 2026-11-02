import { modals } from '@mantine/modals';
import type { CalendarEventInput } from '@ordo/shared';
import type { TaskContext } from '../tasks/use-task-context';
import type { EventOccurrence } from './api';
import { EventForm } from './EventForm';

let modalCount = 0;

/**
 * Opens the event form in a modal, for a new event or an occurrence.
 * @param {TaskContext | null} context Task context (projects, contributors, mentions).
 * @returns {(options?: { occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput> }) => void} Opener.
 */
export function useEventForm(context: TaskContext | null) {
  return ({ occurrence, defaults }: { occurrence?: EventOccurrence; defaults?: Partial<CalendarEventInput> } = {}) => {
    if (!context) return;
    const modalId = `calendar-event-${++modalCount}`;
    modals.open({
      modalId,
      title: occurrence ? 'Évènement' : 'Nouvel évènement',
      size: 'xl',
      children: <EventForm context={context} occurrence={occurrence} defaults={defaults} onDone={() => modals.close(modalId)} />,
    });
  };
}
