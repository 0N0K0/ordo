import { openFormPanel } from '../../../components/panels/panels';
import type { CalendarEventInput } from '@ordo/shared';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { fetchCalendarEvents, type EventOccurrence } from '../api';
import { EventForm } from '../components/EventForm';

/**
 * Opens the event form in the side panel, for a new event or an occurrence.
 * @param {TaskContext | null} context Task context (projects, contributors, mentions).
 * An event duplicated from the form is saved at once and opens in place of it (decision D20).
 * @returns {(options?: { occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput> }) => void} Opener.
 */
export function useEventForm(context: TaskContext | null) {
  /**
   * Opens the form.
   * @param {{ occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput> }} [options] Occurrence edited, or fields of a new event. Optional.
   * @returns {void}
   */
  const open = ({ occurrence, defaults }: { occurrence?: EventOccurrence; defaults?: Partial<CalendarEventInput> } = {}) => {
    if (!context) return;
    openFormPanel(
      occurrence ? 'Évènement' : 'Nouvel évènement',
      (close) => (
        <EventForm
          context={context}
          occurrence={occurrence}
          defaults={defaults}
          onDone={close}
          onDuplicated={(id, fields) => {
            close();
            void openCopy(id, fields);
          }}
        />
      ),
      { size: 'lg' },
    );
  };
  /**
   * Opens a copy just saved: its occurrence (a one-off event), read on its days.
   * @param {string} id Copy.
   * @param {CalendarEventInput} fields Its fields.
   * @returns {Promise<void>}
   */
  const openCopy = async (id: string, fields: CalendarEventInput) => {
    const occurrence = (await fetchCalendarEvents({ from: fields.startDate, to: fields.endDate })).find((item) => item.eventId === id);
    if (occurrence) open({ occurrence });
  };
  return open;
}
