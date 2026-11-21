import { openFormPanel } from '../../../components/panels/panels';
import type { CalendarEventInput } from '@ordo/shared';
import { archivedIds } from '../../../lib/archive';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { fetchCalendarEvents, useCalendars, type CalendarEventScope, type EventOccurrence } from '../api';
import { EventForm } from '../components/EventForm';
import { askScope } from '../lib/ask-scope';

/**
 * Opens the event form in the side panel, for a new event or an occurrence. An occurrence of a recurring event asks
 * first, once, which occurrences the changes of its panel apply to (dismissed: it opens read only, its
 * comments open), unless it is read only (archived, or in an archived calendar).
 * @param {TaskContext | null} context Task context (projects, contributors, mentions).
 * An event duplicated from the form is saved at once and opens in place of it.
 * @returns {(options?: { occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput> }) => void} Opener.
 */
export function useEventForm(context: TaskContext | null) {
  const { data: calendarsData } = useCalendars();
  const archivedCalendars = archivedIds(calendarsData?.calendars ?? []);

  /**
   * Opens the form.
   * @param {{ occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput> }} [options] Occurrence edited, or fields of a new event. Optional.
   * @returns {Promise<void>}
   */
  const open = async ({ occurrence, defaults }: { occurrence?: EventOccurrence; defaults?: Partial<CalendarEventInput> } = {}) => {
    if (!context) return;
    const readOnly = Boolean(occurrence?.archived) || (occurrence ? archivedCalendars.has(occurrence.calendarId) : false);
    // Dismissed: no scope, the panel opens read only (its comments can still be written).
    const scope: CalendarEventScope | null =
      occurrence?.occurrenceDate != null && !readOnly
        ? await askScope({ action: 'update', title: 'Ouvrir un évènement récurrent', note: 'Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront.' })
        : 'ALL';
    openFormPanel(
      occurrence ? 'Évènement' : 'Nouvel évènement',
      (close) => (
        <EventForm
          context={context}
          occurrence={occurrence}
          defaults={defaults}
          scope={scope}
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
    if (occurrence) void open({ occurrence });
  };
  return (options?: { occurrence?: EventOccurrence; defaults?: Partial<CalendarEventInput> }) => void open(options);
}
