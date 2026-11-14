import { closePanel, openPanel } from '../../components/panels/panels';
import type { CalendarEventInput } from '@ordo/shared';
import type { TaskContext } from '../tasks/use-task-context';
import type { EventOccurrence } from './api';
import { EventForm } from './EventForm';

let modalCount = 0;

/**
 * Opens the event form in the side panel, for a new event or an occurrence.
 * @param {TaskContext | null} context Task context (projects, contributors, mentions).
 * An event duplicated from the form opens as a new one (not saved yet) in place of it.
 * @returns {(options?: { occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput>, copy?: boolean }) => void} Opener.
 */
export function useEventForm(context: TaskContext | null) {
  /**
   * Opens the form.
   * @param {{ occurrence?: EventOccurrence, defaults?: Partial<CalendarEventInput>, copy?: boolean }} [options] Occurrence edited, or fields of a new event (a copy). Optional.
   * @returns {void}
   */
  const open = ({ occurrence, defaults, copy }: { occurrence?: EventOccurrence; defaults?: Partial<CalendarEventInput>; copy?: boolean } = {}) => {
    if (!context) return;
    const modalId = `calendar-event-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: occurrence ? 'Évènement' : copy ? 'Copie de l’évènement' : 'Nouvel évènement',
      size: 'lg',
      children: (
        <EventForm
          context={context}
          occurrence={occurrence}
          defaults={defaults}
          onDone={() => closePanel(modalId)}
          onDuplicate={(fields) => {
            closePanel(modalId);
            open({ defaults: fields, copy: true });
          }}
        />
      ),
    });
  };
  return open;
}
