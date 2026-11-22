import { OWN_CASES_START, readScheduleCases, scheduleCasesSchema, type ScheduleCase } from '../calendar/work-schedules';
import { ruleCountsFromDay } from '../dates/recurrence';

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
