import { ruleCountsFromDay } from '../dates/recurrence';
import { lastAllowedDay } from '../dates/days';
import { casesSlotsOn, OWN_CASES_START, readScheduleCases, scheduleCasesSchema, type ScheduleCase } from '../calendar/work-schedules';

/** Message of a case of the « Horaires » of a task whose rhythm counts from a day not chosen. */
export const HOURS_START_REQUIRED = 'Choisissez le jour à partir duquel compter.';

/**
 * Whether a case of the « Horaires » of a task needs the day its rhythm counts from (« À partir du », its `anchor`):
 * its rule counts from a day (`ruleCountsFromDay`) and it has no period of its own (its first day counts then).
 * @param {Pick<ScheduleCase, 'since' | 'rule'>} item Case.
 * @returns {boolean} It needs one.
 */
export const hoursCaseNeedsStart = (item: Pick<ScheduleCase, 'since' | 'rule'>): boolean => !item.since && ruleCountsFromDay(item.rule);

/**
 * « Horaires » of a task: when it can be done, as cases of days and hours shaped as those of a créneau (20 at most, the
 * same checks and messages: hours or « Journée entière », no overlap…), each case whose rhythm counts from a day with
 * that day chosen (`hoursCaseNeedsStart`); none: any time. Never shown in the agenda.
 */
export const taskHoursSchema = scheduleCasesSchema.superRefine((cases, context) =>
  cases.forEach((item, index) => {
    if (hoursCaseNeedsStart(item) && !item.anchor) context.addIssue({ code: 'custom', path: [index, 'anchor'], message: HOURS_START_REQUIRED });
  }),
);

/**
 * Hours of a task stored or received (JSON), validated (invalid cases left out); none: any time.
 * @param {unknown} value Hours.
 * @returns {ScheduleCase[]} Cases.
 */
export const readTaskHours = (value: unknown): ScheduleCase[] => readScheduleCases(value, OWN_CASES_START);

/**
 * Whether the « Horaires » of a task allow a day: a slot of them that day (`casesSlotsOn`); without any, every day.
 * @param {readonly ScheduleCase[]} hours Hours (`readTaskHours`).
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {boolean} Allowed.
 */
export const hoursAllowDay = (hours: readonly ScheduleCase[], day: string): boolean => !hours.length || casesSlotsOn(hours, day).length > 0;

/**
 * Real « Échéance » of a task: the last day on or before its « Échéance » (the one it goes by) that its « Horaires »
 * allow (due on a Sunday, doable Monday to Friday: the Friday); its « Échéance » without hours; null without
 * « Échéance », or when no day within a year before it is allowed (its « Échéance » is not taken then).
 * @param {string | null | undefined} deadline « Échéance » it goes by (YYYY-MM-DD).
 * @param {unknown} hours Its « Horaires » (stored, received, or read).
 * @returns {string | null} Day.
 */
export function taskDueDay(deadline: string | null | undefined, hours: unknown): string | null {
  if (!deadline) return null;
  const cases = readTaskHours(hours);
  return cases.length ? lastAllowedDay((day) => hoursAllowDay(cases, day), deadline) : deadline;
}
