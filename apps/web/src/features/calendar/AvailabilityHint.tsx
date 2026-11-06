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
 * Warning when a timed event of one day falls outside the planned working hours (or during a pause). Nothing
 * without working hours, for an all-day event or one over several days.
 * @param {AvailabilityHintProps} props Dates and times of the event.
 * @returns {JSX.Element | null} Warning.
 */
export function AvailabilityHint({ allDay, startDate, startTime, endDate, endTime }: AvailabilityHintProps) {
  const { data: schedules } = useWorkSchedules();
  if (!schedules?.length || allDay || !startTime || !endTime || !startDate || startDate !== endDate) return null;
  const rules = scheduleRules(schedules);
  const pause = plannedPauses(rules, startDate, startDate)[0];
  const slots = plannedSlots(rules, startDate, startDate);
  if (!pause && withinSlots(slots, startDate, startTime, endTime)) return null;
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
