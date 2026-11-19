import * as fmt from '../../../lib/format';

/** When an event takes place: its days, and its hours unless it lasts whole days. */
export interface EventMoment {
  allDay: boolean;
  startDate: string;
  endDate: string;
  /** « HH:MM »; none for whole days. */
  startTime: string | null;
  endTime: string | null;
}

/**
 * When an event takes place, in words, the same in its form and its card: « Lundi 3 novembre 2026, 09:00 – 10:00 »,
 * « Lundi 3 novembre 2026, journée entière », « Du lundi 3 novembre 2026 au mercredi 5 novembre 2026 ».
 * @param {EventMoment} moment Days and hours.
 * @returns {string} Text.
 */
export function eventMomentText({ allDay, startDate, endDate, startTime, endTime }: EventMoment): string {
  const day = (date: string) => fmt.dayLong(date);
  const oneDay = startDate === endDate;
  // eslint-disable-next-line no-restricted-syntax -- eventMomentText itself.
  if (allDay) return oneDay ? `${fmt.capitalize(day(startDate))}, journée entière` : `Du ${day(startDate)} au ${day(endDate)}`;
  return oneDay ? `${fmt.capitalize(day(startDate))}, ${startTime ?? ''} – ${endTime ?? ''}` : `Du ${day(startDate)} ${startTime ?? ''} au ${day(endDate)} ${endTime ?? ''}`;
}
