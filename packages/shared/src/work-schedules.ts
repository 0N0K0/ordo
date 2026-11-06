import { z } from 'zod';
import { addDays, daysBetween, parseDay } from './recurrence';

const isoDate = z.iso.date({ error: 'Date invalide.' });
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).');

/** Working time slot on a weekday, in local time. */
export const workSlotSchema = z
  .object({
    /** 1 (Monday) to 7 (Sunday). */
    weekday: z.number().int().min(1).max(7),
    start: timeSchema,
    end: timeSchema,
  })
  .refine((slot) => slot.end > slot.start, { path: ['end'], message: 'La fin doit suivre le début.' });
export type WorkSlot = z.infer<typeof workSlotSchema>;

/** Paused period (holidays…), dates included. */
export const workPauseSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    label: z.string().trim().max(100, '100 caractères maximum.'),
  })
  .refine((pause) => pause.to >= pause.from, { path: ['to'], message: 'La fin de la pause doit suivre son début.' });
export type WorkPause = z.infer<typeof workPauseSchema>;

/** Planned working hours: from a date, every n weeks, time slots on weekdays, with paused periods. */
export const workScheduleSchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    intervalWeeks: z.number().int().min(1, 'Au moins 1.').max(52, '52 maximum.'),
    slots: z.array(workSlotSchema).min(1, 'Ajoutez au moins une plage.').max(70, '70 plages maximum.'),
    pauses: z.array(workPauseSchema).max(200, '200 pauses maximum.'),
  })
  .superRefine((schedule, context) => {
    if (schedule.endDate && schedule.endDate < schedule.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'La fin doit suivre le début.' });
    }
    // Slots of a same day must not overlap.
    schedule.slots.forEach((slot, index) => {
      const overlapping = schedule.slots.some((other, otherIndex) => otherIndex < index && other.weekday === slot.weekday && other.start < slot.end && slot.start < other.end);
      if (overlapping) context.addIssue({ code: 'custom', path: ['slots', index, 'start'], message: 'Chevauche une autre plage du même jour.' });
    });
  });
export type WorkScheduleInput = z.input<typeof workScheduleSchema>;

/** Stored schedule, as the functions below read it. */
export interface WorkScheduleRule {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  intervalWeeks: number;
  slots: readonly WorkSlot[];
  pauses: readonly WorkPause[];
}

/** Planned working time slot on a date. */
export interface PlannedSlot {
  date: string;
  start: string;
  end: string;
  scheduleId: string;
}

/** Paused period of a schedule overlapping a period. */
export interface PlannedPause extends WorkPause {
  scheduleId: string;
  scheduleName: string;
}

/**
 * ISO weekday of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {number} 1 (Monday) to 7 (Sunday).
 */
export function weekdayOf(date: string): number {
  return ((parseDay(date).getUTCDay() + 6) % 7) + 1;
}

/**
 * Monday of the week of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Monday.
 */
export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/**
 * Pause of a schedule covering a date.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} date YYYY-MM-DD.
 * @returns {WorkPause | undefined} Pause.
 */
export function pauseOn(schedule: WorkScheduleRule, date: string): WorkPause | undefined {
  return schedule.pauses.find((pause) => pause.from <= date && date <= pause.to);
}

/**
 * Whether a schedule works on a date: within its dates, in one of its weeks (every n weeks from its first
 * week), not paused.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} date YYYY-MM-DD.
 * @returns {boolean} Works that day.
 */
function activeOn(schedule: WorkScheduleRule, date: string): boolean {
  if (date < schedule.startDate || (schedule.endDate && date > schedule.endDate)) return false;
  const weeks = daysBetween(mondayOf(schedule.startDate), mondayOf(date)) / 7;
  return weeks % schedule.intervalWeeks === 0 && !pauseOn(schedule, date);
}

/**
 * Planned working time slots between two dates (included), by date and start.
 * @param {readonly WorkScheduleRule[]} schedules Schedules.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {PlannedSlot[]} Slots.
 */
export function plannedSlots(schedules: readonly WorkScheduleRule[], from: string, to: string): PlannedSlot[] {
  const result: PlannedSlot[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    for (const schedule of schedules) {
      if (!activeOn(schedule, date)) continue;
      for (const slot of schedule.slots) if (slot.weekday === weekday) result.push({ date, start: slot.start, end: slot.end, scheduleId: schedule.id });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/**
 * Paused periods of the schedules overlapping two dates (included).
 * @param {readonly WorkScheduleRule[]} schedules Schedules.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {PlannedPause[]} Pauses.
 */
export function plannedPauses(schedules: readonly WorkScheduleRule[], from: string, to: string): PlannedPause[] {
  return schedules.flatMap((schedule) => schedule.pauses.filter((pause) => pause.from <= to && pause.to >= from).map((pause) => ({ ...pause, scheduleId: schedule.id, scheduleName: schedule.name })));
}

/**
 * Minutes of time slots.
 * @param {readonly { start: string, end: string }[]} slots Slots.
 * @returns {number} Minutes.
 */
export function slotMinutes(slots: readonly { start: string; end: string }[]): number {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return slots.reduce((sum, slot) => sum + minutes(slot.end) - minutes(slot.start), 0);
}

/**
 * Whether a time range of a day fits within one of the planned slots of that day.
 * @param {readonly PlannedSlot[]} slots Planned slots.
 * @param {string} date YYYY-MM-DD.
 * @param {string} start HH:MM.
 * @param {string} end HH:MM.
 * @returns {boolean} Within working hours.
 */
export function withinSlots(slots: readonly PlannedSlot[], date: string, start: string, end: string): boolean {
  return slots.some((slot) => slot.date === date && slot.start <= start && end <= slot.end);
}
