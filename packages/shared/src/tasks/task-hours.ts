import { OWN_CASES_START, readScheduleCases, scheduleCasesSchema, type ScheduleCase } from '../calendar/work-schedules';

/**
 * « Horaires » of a task: when it can be done, as cases of days and hours shaped as those of a créneau (20 at most, the
 * same checks and messages: hours or « Journée entière », no overlap…); none: any time. Never shown in the agenda.
 */
export const taskHoursSchema = scheduleCasesSchema;

/**
 * Hours of a task stored or received (JSON), validated (invalid cases left out); none: any time.
 * @param {unknown} value Hours.
 * @returns {ScheduleCase[]} Cases.
 */
export const readTaskHours = (value: unknown): ScheduleCase[] => readScheduleCases(value, OWN_CASES_START);

/**
 * Hours of a task as stored: a case without a first day of its own nor anchor gets the day they are typed as anchor,
 * so that « every 2 weeks » or « every 3 days » count from it.
 * @param {readonly ScheduleCase[]} hours Hours.
 * @param {string} day Day they are typed (YYYY-MM-DD).
 * @returns {ScheduleCase[]} Hours.
 */
export const anchoredTaskHours = (hours: readonly ScheduleCase[], day: string): ScheduleCase[] => hours.map((item) => (item.anchor || item.since ? item : { ...item, anchor: day }));
