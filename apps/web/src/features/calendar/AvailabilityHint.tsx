import { Alert } from '@mantine/core';
import { plannedPauses, plannedSlots, withinSlots } from '@ordo/shared';
import { WarningIcon } from '@phosphor-icons/react';
import { scheduleRules, useWorkSchedules } from './api';

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
  if (!schedules?.length || allDay || !startTime || !endTime || !startDate || startDate !== endDate) return null;
  const rules = scheduleRules(schedules);
  const slots = plannedSlots(rules, startDate, startDate);
  // Within the slots of a schedule working that day (another one may be paused): fine.
  if (withinSlots(slots, startDate, startTime, endTime)) return null;
  // A pause is told only when no schedule works that day.
  const pause = slots.length ? undefined : plannedPauses(rules, startDate, startDate)[0];
  const message = pause
    ? `Pendant une pause de vos plages de travail : ${pause.label || 'pause'}.`
    : slots.length
      ? `En dehors de vos horaires de travail ce jour-là (${slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}).`
      : 'Pas de plage de travail prévue ce jour-là.';
  return (
    <Alert color="yellow" variant="light" icon={<WarningIcon aria-hidden />} py="xs">
      {message}
    </Alert>
  );
}
