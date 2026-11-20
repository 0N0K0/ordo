import { NoticeAlert } from '../../../components/feedback/NoticeAlert';

import { plannedPauses, plannedSlots, withinSlots } from '@ordo/shared';

import { scheduleRules, useWorkSchedules } from '../api';
import { useActiveWorkspace } from '../../workspaces/api';

interface AvailabilityHintProps {
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
}

/**
 * Warning when a timed event of one day falls outside the planned working hours of that day (a pause is told
 * only when no other schedule works that day). Nothing
 * without working hours, for an all-day event or one over several days.
 * @param {AvailabilityHintProps} props Dates and times of the event.
 * @returns {JSX.Element | null} Warning.
 */
export function AvailabilityHint({ allDay, startDate, startTime, endDate, endTime }: AvailabilityHintProps) {
  const { data: schedules } = useWorkSchedules();
  // In a personal workspace, slots are no working hours: nothing to warn about.
  const { perso } = useActiveWorkspace();
  if (perso || !schedules?.length || allDay || !startTime || !endTime || !startDate || startDate !== endDate) return null;
  const rules = scheduleRules(schedules);
  const slots = plannedSlots(rules, startDate, startDate);
  // Within the slots of a schedule working that day (another one may be paused): fine.
  if (withinSlots(slots, startDate, startTime, endTime)) return null;
  // A pause is told only when no schedule works that day.
  const pause = slots.length ? undefined : plannedPauses(rules, startDate, startDate)[0];
  const message = pause
    ? `Pendant une pause de vos créneaux de travail : ${pause.label || 'pause'}.`
    : slots.length
      ? `En dehors de vos créneaux de travail ce jour-là (${slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}).`
      : 'Pas de créneau de travail prévu ce jour-là.';
  return (
    <NoticeAlert kind="warning" py="xs">
      {message}
    </NoticeAlert>
  );
}
