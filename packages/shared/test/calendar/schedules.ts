import type { Recurrence } from '../../src/dates/recurrence';
import type { ScheduleCase, WorkScheduleRule } from '../../src/calendar/work-schedules';
import { rule } from '../rules';

/**
 * Schedule case for a test: weekly rule given, 09:00–12:00 (or whole days), no period nor anchor.
 * @param {Partial<Recurrence>} fields Fields of its rule.
 * @param {Partial<ScheduleCase>} [other] Other fields of the case. Optional.
 * @returns {ScheduleCase} Case.
 */
export const scheduleCase = (fields: Partial<Recurrence>, other: Partial<ScheduleCase> = {}): ScheduleCase => ({
  since: null,
  until: null,
  anchor: null,
  rule: rule(fields),
  times: { allDay: false, ranges: [{ start: '09:00', end: '12:00' }] },
  ...other,
});

/**
 * Schedule for a test, from 2026-11-02 (a Monday), without end nor exceptions.
 * @param {ScheduleCase[]} cases Cases.
 * @param {Partial<WorkScheduleRule>} [other] Other fields. Optional.
 * @returns {WorkScheduleRule} Schedule.
 */
export const schedule = (cases: ScheduleCase[], other: Partial<WorkScheduleRule> = {}): WorkScheduleRule => ({
  id: 's',
  label: 'Travail',
  startDate: '2026-11-02',
  endDate: null,
  cases,
  exceptions: [],
  ...other,
});
