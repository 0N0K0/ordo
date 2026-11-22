import { NoticeAlert } from '../../../components/feedback/NoticeAlert';

import { plannedPauses, plannedSlots, withinSlots, type WorkScheduleRule } from '@ordo/shared';

import { useWorkingHours } from '../api';
import { useActiveWorkspace } from '../../workspaces/api';
import { useSlotRules } from '../hooks/use-slot-rules';
import { unavailableWarning } from '../lib/schedule-text';
import { localInstant } from '../../../lib/dates';

interface AvailabilityHintProps {
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
}

/**
 * Warning of a timed event of one day outside the planned working hours of that day (a pause is told only when no
 * other schedule works that day), PRO only; null when none.
 * @param {WorkScheduleRule[]} rules Working hours (`useWorkingHours`).
 * @param {string} date Day of the event.
 * @param {string} startTime Start.
 * @param {string} endTime End.
 * @returns {string | null} Message.
 */
function workingHoursWarning(rules: readonly WorkScheduleRule[], date: string, startTime: string, endTime: string): string | null {
  const slots = plannedSlots(rules, date, date);
  // Within the slots of a schedule working that day (another one may be paused): fine.
  if (withinSlots(slots, date, startTime, endTime)) return null;
  // A pause is told only when no schedule works that day.
  const pause = slots.length ? undefined : plannedPauses(rules, date, date)[0];
  return pause
    ? `Pendant une pause de vos créneaux de travail : ${pause.label || 'pause'}.`
    : slots.length
      ? `En dehors de vos créneaux de travail ce jour-là (${slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}).`
      : 'Pas de créneau de travail prévu ce jour-là.';
}

/**
 * Warnings of a timed event, saved all the same: during a slot « Indisponible » of the workspace (« Pendant
 * « Sommeil » (indisponible). », any workspace, over several days too), and, in a PRO workspace, for an event of one
 * day, outside the planned working hours of that day. The working hours leave out the éphémérides, the archived
 * créneaux and those of an archived kind. Nothing for an all-day event.
 * @param {AvailabilityHintProps} props Dates and times of the event.
 * @returns {JSX.Element | null} Warnings.
 */
export function AvailabilityHint({ allDay, startDate, startTime, endDate, endTime }: AvailabilityHintProps) {
  // The working hours: the créneaux counted (no éphéméride; none archived).
  const { data: rules } = useWorkingHours();
  const slotRules = useSlotRules();
  // In a personal workspace, slots are no working hours: nothing to warn about.
  const { perso } = useActiveWorkspace();
  if (allDay || !startTime || !endTime || !startDate || !endDate) return null;
  const messages = [
    unavailableWarning(slotRules.unavailable(localInstant(startDate, startTime), localInstant(endDate, endTime))),
    !perso && rules?.length && startDate === endDate ? workingHoursWarning(rules, startDate, startTime, endTime) : null,
  ].filter((message): message is string => Boolean(message));
  if (!messages.length) return null;
  return (
    <NoticeAlert kind="warning" py="xs">
      {messages.join(' ')}
    </NoticeAlert>
  );
}
