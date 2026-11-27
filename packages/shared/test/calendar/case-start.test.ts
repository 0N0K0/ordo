import { describe, expect, it } from 'vitest';
import { changedScheduleSlot, plannedSlots, readScheduleCases, type WorkScheduleRule } from '../../src/calendar/work-schedules';
import { DEFAULT_RECURRENCE, type Recurrence } from '../../src/dates/recurrence';

/** Hours of the stored cases of the tests. */
const TIMES = { allDay: false, ranges: [{ start: '09:00', end: '12:00' }] };

/**
 * A case stored in the former form (a period, an anchor), with a weekly rule changed by some fields.
 * @param {Partial<Recurrence>} rule Fields of its rule.
 * @param {{ since?: string, until?: string, anchor?: string }} [period] Its period and anchor. Optional.
 * @returns {object} Stored case.
 */
const stored = (rule: Partial<Recurrence>, period: { since?: string; until?: string; anchor?: string } = {}) => ({ since: null, until: null, anchor: null, ...period, times: TIMES, ...{ rule: { ...DEFAULT_RECURRENCE, ...rule } } });

/**
 * Schedule of stored cases, as the API and the web read it.
 * @param {unknown[]} cases Stored cases.
 * @param {Partial<WorkScheduleRule>} [other] Other fields. Optional.
 * @returns {WorkScheduleRule} Schedule.
 */
const read = (cases: unknown[], other: Partial<WorkScheduleRule> = {}): WorkScheduleRule => {
  const startDate = other.startDate ?? '2026-11-02';
  return { id: 's', label: 'Travail', startDate, endDate: null, cases: readScheduleCases(cases, startDate), exceptions: [], ...other };
};

/**
 * Slots of a schedule between two days, as « day hour ».
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Slots.
 */
const slots = (schedule: WorkScheduleRule, from = '2026-11-01', to = '2027-03-31'): string[] => plannedSlots([schedule], from, to).map((slot) => `${slot.date} ${slot.start}`);

/**
 * Days of the slots of a schedule.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} [from] First day. Optional.
 * @param {string} [to] Last day. Optional.
 * @returns {string[]} Days.
 */
const days = (schedule: WorkScheduleRule, from?: string, to?: string): string[] => slots(schedule, from, to).map((slot) => slot.slice(0, 10));

/**
 * A slot of 09:00–12:00 (or other hours) on a day.
 * @param {string} date Day.
 * @param {string} [start] Start. Optional. Default = 09:00.
 * @param {string} [end] End. Optional. Default = 12:00.
 * @returns {{ date: string, start: string, end: string, allDay: boolean }} Slot.
 */
const slot = (date: string, start = '09:00', end = '12:00') => ({ date, start, end, allDay: false });

describe('cases stored with a period: the same occurrences once read', () => {
  it('within its period, its rhythm counted from its first day', () => {
    expect(days(read([stored({ frequency: 'DAILY', interval: 2 }, { since: '2026-11-05', until: '2026-11-09' })]))).toEqual(['2026-11-05', '2026-11-07', '2026-11-09']);
  });

  it('a rhythm counted from before its period: its first occurrence within it on', () => {
    expect(days(read([stored({ weekdays: [1], interval: 2 }, { anchor: '2026-11-02', since: '2026-11-10', until: '2026-12-31' })]))).toEqual([
      '2026-11-16',
      '2026-11-30',
      '2026-12-14',
      '2026-12-28',
    ]);
  });

  it('every 2 months from the first of an earlier month (former form), the same day of the month', () => {
    const schedule = read([stored({ frequency: 'MONTHLY', interval: 2, monthDay: 15 }, { anchor: '2026-11-01', since: '2026-12-01' })]);
    expect(days(schedule)).toEqual(['2027-01-15', '2027-03-15']);
  });

  it('a count with the end of a period: the occurrences up to it', () => {
    expect(days(read([stored({ weekdays: [1], count: 5 }, { until: '2026-11-20' })]))).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });

  it('a count counted from before its period: the occurrences left within it', () => {
    expect(days(read([stored({ weekdays: [1], count: 4 }, { anchor: '2026-11-02', since: '2026-11-10' })]))).toEqual(['2026-11-16', '2026-11-23']);
  });

  it('the nth weekday left unset: a 4th that is the last of its month stays the last', () => {
    const schedule = read([stored({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', count: 3 }, { anchor: '2026-07-24', since: '2026-08-01' })], { startDate: '2026-07-01' });
    expect(days(schedule, '2026-07-01', '2027-03-31')).toEqual(['2026-10-23', '2027-01-22']);
  });

  it('an occurrence lasting several days started before its period and reaching into it is kept', () => {
    const threeDays = { unit: 'DAYS' as const, count: 3, day: null, month: null, week: null };
    const schedule = read([stored({ weekdays: [7], duration: threeDays }, { anchor: '2026-02-23', since: '2026-03-02', until: '2026-03-20' })], { startDate: '2026-02-01' });
    expect(days(schedule, '2026-03-02', '2026-03-31')).toEqual(['2026-03-02', '2026-03-03', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-15', '2026-03-16', '2026-03-17']);
  });

  it('an end of its rule before the end of its period: the earlier one', () => {
    expect(days(read([stored({ weekdays: [1], until: '2026-11-10' }, { until: '2026-11-30' })]))).toEqual(['2026-11-02', '2026-11-09']);
    expect(days(read([stored({ weekdays: [1], until: '2026-11-30' }, { until: '2026-11-10' })]))).toEqual(['2026-11-02', '2026-11-09']);
  });

  it('the first case wins: a later case takes over at the end of the first one', () => {
    const schedule = read([stored({ weekdays: [1] }, { until: '2026-11-15' }), stored({ weekdays: [1], interval: 2 }, { since: '2026-11-16' })]);
    expect(days(schedule, '2026-11-01', '2026-12-31')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-30', '2026-12-14', '2026-12-28']);
  });
});

describe('cases stored with a period: their new form', () => {
  it('a single « Début », the end of the period in the rule', () => {
    expect(readScheduleCases([stored({ weekdays: [1] }, { since: '2026-11-09', until: '2026-11-30' })], '2026-11-02')).toMatchObject([{ start: '2026-11-09', rule: { until: '2026-11-30', count: null } }]);
    expect(readScheduleCases([stored({ weekdays: [1], count: 4 }, { anchor: '2026-11-02', since: '2026-11-10' })], '2026-11-02')).toMatchObject([{ start: '2026-11-16', rule: { count: 2 } }]);
    expect(readScheduleCases([stored({ weekdays: [1], count: 9 }, { until: '2026-11-20' })], '2026-11-02')).toMatchObject([{ start: null, rule: { count: 3, until: null } }]);
    expect(readScheduleCases([stored({ weekdays: [1] }, { anchor: '2026-11-02', since: '2026-11-03', until: '2026-11-08' })], '2026-11-02')).toEqual([]);
  });
});

describe('cases moved from the calendar: the same slots', () => {
  const weekly = read([stored({ weekdays: [1, 3] })]);

  it('FOLLOWING, hours changed: the days before keep their hours', () => {
    const result = { ...weekly, ...changedScheduleSlot(weekly, slot('2026-11-09'), slot('2026-11-09', '13:00', '14:00'), 'FOLLOWING') };
    expect(slots(result, '2026-11-02', '2026-11-11')).toEqual(['2026-11-02 09:00', '2026-11-04 09:00', '2026-11-09 13:00', '2026-11-11 09:00', '2026-11-11 13:00']);
  });

  it('FOLLOWING, moved to another day: every n weeks from its new day', () => {
    const everyTwo = read([stored({ weekdays: [1], interval: 2 })]);
    const result = { ...everyTwo, ...changedScheduleSlot(everyTwo, slot('2026-11-16'), slot('2026-11-18'), 'FOLLOWING') };
    expect(days(result, '2026-11-01', '2026-12-31')).toEqual(['2026-11-02', '2026-11-18', '2026-12-02', '2026-12-16', '2026-12-30']);
  });

  it('ALL, moved to another day: every n weeks moved', () => {
    const everyTwo = read([stored({ weekdays: [1], interval: 2 })]);
    const result = { ...everyTwo, ...changedScheduleSlot(everyTwo, slot('2026-11-16'), slot('2026-11-17'), 'ALL') };
    expect(days(result, '2026-11-01', '2026-12-31')).toEqual(['2026-11-03', '2026-11-17', '2026-12-01', '2026-12-15', '2026-12-29']);
  });

  it('FOLLOWING on a case starting later than its period: split at the day', () => {
    const later = read([stored({ weekdays: [1], interval: 2 }, { since: '2026-11-16' })]);
    const result = { ...later, ...changedScheduleSlot(later, slot('2026-11-30'), slot('2026-12-01'), 'FOLLOWING') };
    expect(days(result, '2026-11-01', '2026-12-31')).toEqual(['2026-11-16', '2026-12-01', '2026-12-15', '2026-12-29']);
  });

  it('FOLLOWING with a count: the series cut keeps its count, the part going on counts what is left', () => {
    const counted = read([stored({ weekdays: [1], count: 4 })]);
    const result = { ...counted, ...changedScheduleSlot(counted, slot('2026-11-16'), slot('2026-11-16', '13:00', '14:00'), 'FOLLOWING') };
    expect(slots(result)).toEqual(['2026-11-02 09:00', '2026-11-09 09:00', '2026-11-16 13:00', '2026-11-23 13:00']);
  });

  it('an éphéméride moved whole: its later cases keep their days, moved', () => {
    const ephemeris = read([stored({ weekdays: [1] }, { until: '2026-11-15' }), stored({ weekdays: [1], interval: 2 }, { since: '2026-11-16' })], { ephemeris: true, endDate: '2026-12-31' });
    const result = { ...ephemeris, ...changedScheduleSlot(ephemeris, slot('2026-11-02'), slot('2026-11-03'), 'ALL') };
    expect(days(result, '2026-11-01', '2027-01-31')).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-12-01', '2026-12-15', '2026-12-29']);
  });

  it('an éphéméride moved whole by days changing the week of a rhythm counted from before its case', () => {
    const ephemeris = read([stored({ weekdays: [5], interval: 2 }, { anchor: '2026-11-02', since: '2026-11-10' })], { ephemeris: true, endDate: '2026-12-31' });
    const result = { ...ephemeris, ...changedScheduleSlot(ephemeris, slot('2026-11-20'), slot('2026-11-23'), 'ALL') };
    expect(days(result, '2026-11-01', '2027-01-31')).toEqual(['2026-11-23', '2026-12-07', '2026-12-21']);
  });

  it('an éphéméride moved whole, some weekdays of a case starting later changing week: two pieces, the same days moved', () => {
    const ephemeris = read([stored({ weekdays: [1, 5], interval: 2 }, { since: '2026-11-16' })], { ephemeris: true, endDate: '2026-12-31' });
    const result = { ...ephemeris, ...changedScheduleSlot(ephemeris, slot('2026-11-16'), slot('2026-11-19'), 'ALL') };
    expect(days(result, '2026-11-01', '2027-01-31')).toEqual(['2026-11-19', '2026-11-23', '2026-12-03', '2026-12-07', '2026-12-17', '2026-12-21', '2026-12-31']);
  });

  it('a slot moved alone on its other weekdays from a case starting later (ALL): its other weekday stays', () => {
    const later = read([stored({ weekdays: [1, 3], interval: 2 }, { since: '2026-11-16' })]);
    const result = { ...later, ...changedScheduleSlot(later, slot('2026-11-16'), slot('2026-11-17'), 'ALL') };
    expect(days(result, '2026-11-01', '2026-12-31')).toEqual(['2026-11-17', '2026-11-18', '2026-12-01', '2026-12-02', '2026-12-15', '2026-12-16', '2026-12-29', '2026-12-30']);
  });
});
