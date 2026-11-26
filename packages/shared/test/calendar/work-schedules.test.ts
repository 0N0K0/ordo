import { describe, expect, it } from 'vitest';
import {
  casesSlotsOn,
  changedScheduleSlot,
  countedSchedules,
  fromLegacySchedule,
  plannedPauses,
  plannedSlots,
  readScheduleCases,
  scheduleCasesSchema,
  scheduleRuns,
  scheduleTypeContextError,
  SPLIT_CASES_REFUSAL,
  slotMinutes,
  withinSlots,
  workScheduleSchema,
  type WorkScheduleRule,
} from '../../src/calendar/work-schedules';
import { addDays } from '../../src/dates/days';
import { schedule, scheduleCase } from './schedules';

/**
 * Days with a slot of a schedule between two dates.
 * @param {WorkScheduleRule} rule Schedule.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Days, each once.
 */
const slotDays = (rule: WorkScheduleRule, from: string, to: string): string[] => [...new Set(plannedSlots([rule], from, to).map((slot) => slot.date))];

const MONDAY_CASE = scheduleCase({ weekdays: [1] });
const slot = (date: string, start = '09:00', end = '12:00') => ({ date, start, end, allDay: false });

describe('workScheduleSchema', () => {
  const input = { label: 'Travail', startDate: '2026-11-02', endDate: null, cases: [MONDAY_CASE], exceptions: [] };

  it('1 to 20 cases', () => {
    expect(workScheduleSchema.safeParse({ ...input, cases: [] }).error?.issues[0].message).toBe('Ajoutez au moins un cas.');
    expect(workScheduleSchema.safeParse({ ...input, cases: Array(20).fill(MONDAY_CASE) }).success).toBe(true);
    expect(workScheduleSchema.safeParse({ ...input, cases: Array(21).fill(MONDAY_CASE) }).error?.issues[0].message).toBe('20 cas au plus.');
  });

  it('an exception has 20 cases at most too', () => {
    const exception = { from: '2026-11-10', to: '2026-11-12', cases: Array(21).fill(MONDAY_CASE) };
    expect(workScheduleSchema.safeParse({ ...input, exceptions: [exception] }).error?.issues[0].message).toBe('20 cas au plus.');
  });

  it('a weekly case needs a weekday', () => {
    expect(workScheduleSchema.safeParse({ ...input, cases: [scheduleCase({})] }).error?.issues[0].message).toBe('Choisissez au moins un jour.');
  });

  it('hours: some ranges unless the whole day, none overlapping, each ending after it starts', () => {
    const times = (value: object) => workScheduleSchema.safeParse({ ...input, cases: [{ ...MONDAY_CASE, times: value }] }).error?.issues[0].message;
    expect(times({ allDay: false, ranges: [] })).toBe('Ajoutez des horaires, ou « Journée entière ».');
    expect(times({ allDay: false, ranges: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '13:00' }] })).toBe('Des horaires se chevauchent.');
    expect(times({ allDay: false, ranges: [{ start: '12:00', end: '09:00' }] })).toBe('La fin doit suivre le début.');
    expect(times({ allDay: true, ranges: [] })).toBeUndefined();
  });

  it('the end of the period follows its start', () => {
    expect(workScheduleSchema.safeParse({ ...input, endDate: '2026-11-01' }).error?.issues[0].message).toBe('La fin doit suivre le début.');
  });
});

describe('plannedSlots', () => {
  it('the slots of the cases on their days, by date and start, within the period', () => {
    const rule = schedule([MONDAY_CASE, scheduleCase({ weekdays: [1, 2] }, { times: { allDay: false, ranges: [{ start: '07:00', end: '08:00' }] } })], { endDate: '2026-11-09' });
    expect(plannedSlots([rule], '2026-10-26', '2026-11-20').map((item) => `${item.date} ${item.start}`)).toEqual([
      '2026-11-02 07:00',
      '2026-11-02 09:00',
      '2026-11-03 07:00',
      '2026-11-09 07:00',
      '2026-11-09 09:00',
    ]);
  });

  it('a whole day gives 00:00–24:00', () => {
    expect(plannedSlots([schedule([scheduleCase({ weekdays: [1] }, { times: { allDay: true, ranges: [] } })])], '2026-11-02', '2026-11-02')).toEqual([
      { date: '2026-11-02', start: '00:00', end: '24:00', allDay: true, scheduleId: 's' },
    ]);
  });

  it('an exception replaces the general cases on its days; without cases it is a pause', () => {
    const rule = schedule([scheduleCase({ frequency: 'DAILY' })], {
      exceptions: [
        { from: '2026-11-03', to: '2026-11-04', label: 'Congés', cases: [] },
        { from: '2026-11-05', to: '2026-11-05', label: '', cases: [scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: [{ start: '14:00', end: '15:00' }] } })] },
      ],
    });
    expect(plannedSlots([rule], '2026-11-02', '2026-11-06').map((item) => `${item.date} ${item.start}`)).toEqual(['2026-11-02 09:00', '2026-11-05 14:00', '2026-11-06 09:00']);
    expect(plannedPauses([rule], '2026-11-01', '2026-11-30')).toEqual([{ from: '2026-11-03', to: '2026-11-04', label: 'Congés', scheduleId: 's', scheduleLabel: 'Travail' }]);
  });

  it('of overlapping exceptions, the one started last applies; on the same day, the shorter', () => {
    const own = (start: string) => [scheduleCase({ frequency: 'DAILY' }, { times: { allDay: false, ranges: [{ start, end: '23:00' }] } })];
    const rule = schedule([], {
      exceptions: [
        { from: '2026-11-02', to: '2026-11-30', label: '', cases: own('10:00') },
        { from: '2026-11-10', to: '2026-11-20', label: '', cases: own('11:00') },
        { from: '2026-11-10', to: '2026-11-10', label: '', cases: own('12:00') },
      ],
    });
    expect(plannedSlots([rule], '2026-11-09', '2026-11-11').map((item) => item.start)).toEqual(['10:00', '12:00', '11:00']);
  });

  it('a case with a period applies within it, its rhythm counted from its first day', () => {
    const rule = schedule([scheduleCase({ frequency: 'DAILY', interval: 2 }, { since: '2026-11-05', until: '2026-11-09' })]);
    expect(slotDays(rule, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-07', '2026-11-09']);
  });

  it('an occurrence lasting several days covers all of them, started before the range too', () => {
    const rule = schedule([scheduleCase({ weekdays: [1], duration: { unit: 'DAYS', count: 3, day: null, month: null, week: null } })]);
    expect(slotDays(rule, '2026-11-03', '2026-11-10')).toEqual(['2026-11-03', '2026-11-04', '2026-11-09', '2026-11-10']);
  });

  it('cases out of any schedule count their rhythm from 2000-01-03 (a Monday)', () => {
    expect(casesSlotsOn([scheduleCase({ weekdays: [1], interval: 2 })], '2026-11-02').length + casesSlotsOn([scheduleCase({ weekdays: [1], interval: 2 })], '2026-11-09').length).toBe(1);
  });
});

describe('planned time', () => {
  it('slotMinutes leaves out whole days', () => {
    expect(slotMinutes([slot('2026-11-02'), { ...slot('2026-11-02', '14:00', '15:30') }, { date: '2026-11-03', start: '00:00', end: '24:00', allDay: true }])).toBe(270);
  });

  it('withinSlots: a range of the day within one slot', () => {
    const slots = [{ ...slot('2026-11-02'), scheduleId: 's' }];
    expect(withinSlots(slots, '2026-11-02', '09:00', '12:00')).toBe(true);
    expect(withinSlots(slots, '2026-11-02', '11:00', '12:30')).toBe(false);
    expect(withinSlots(slots, '2026-11-03', '09:00', '10:00')).toBe(false);
  });

  it('scheduleRuns: the first day of each run of consecutive days, and its first start', () => {
    const rule = schedule([scheduleCase({ weekdays: [1, 2, 4] })]);
    expect(scheduleRuns(rule, '2026-11-03', '2026-11-12')).toEqual([
      { day: '2026-11-05', start: '09:00' },
      { day: '2026-11-09', start: '09:00' },
      { day: '2026-11-12', start: '09:00' },
    ]);
  });
});

describe('stored schedules', () => {
  it('invalid stored cases are left out', () => {
    expect(readScheduleCases([MONDAY_CASE, { rule: 'nope' }], '2026-11-02')).toHaveLength(1);
    expect(readScheduleCases('nope', '2026-11-02')).toEqual([]);
  });

  it('a case of the former form (every n weeks from the period) keeps its days', () => {
    const [converted] = readScheduleCases([{ pattern: 'WEEKLY', weekdays: [1], every: 2, ranges: [{ start: '09:00', end: '12:00' }] }], '2026-11-04');
    expect(slotDays(schedule([converted], { startDate: '2026-11-04' }), '2026-11-01', '2026-11-30')).toEqual(['2026-11-16', '2026-11-30']);
  });

  it('the former format: weekdays with the same hours make one case, pauses become exceptions without cases', () => {
    const legacy = fromLegacySchedule({
      startDate: '2026-11-02',
      intervalWeeks: 1,
      slots: [
        { weekday: 1, start: '09:00', end: '12:00' },
        { weekday: 3, start: '09:00', end: '12:00' },
        { weekday: 5, start: '14:00', end: '18:00' },
      ],
      pauses: [{ from: '2026-11-10', to: '2026-11-12' }],
    });
    expect(legacy.cases.map((item) => item.rule?.weekdays)).toEqual([[1, 3], [5]]);
    expect(legacy.exceptions).toEqual([{ from: '2026-11-10', to: '2026-11-12', label: '', cases: [] }]);
  });
});

describe('changedScheduleSlot', () => {
  const rule = schedule([scheduleCase({ weekdays: [1, 3] })]);

  it('THIS: an exception of the day with its other slots, and one of the day it goes to', () => {
    const changed = changedScheduleSlot(rule, slot('2026-11-09'), slot('2026-11-10', '10:00', '11:00'), 'THIS');
    expect(changed.cases).toEqual(rule.cases);
    const result = { ...rule, ...changed };
    expect(plannedSlots([result], '2026-11-09', '2026-11-11').map((item) => `${item.date} ${item.start}`)).toEqual(['2026-11-10 10:00', '2026-11-11 09:00']);
  });

  it('THIS deleted: the day loses that slot only', () => {
    const result = { ...rule, ...changedScheduleSlot(rule, slot('2026-11-09'), null, 'THIS') };
    expect(slotDays(result, '2026-11-02', '2026-11-16')).toEqual(['2026-11-02', '2026-11-04', '2026-11-11', '2026-11-16']);
  });

  it('FOLLOWING: the case stops the day before, a new one follows with the change; its other weekdays stay', () => {
    const changed = changedScheduleSlot(rule, slot('2026-11-09'), slot('2026-11-09', '13:00', '14:00'), 'FOLLOWING');
    expect(changed.cases.map((item) => [item.since, item.until, item.rule?.weekdays, item.times.ranges[0].start])).toEqual([
      [null, '2026-11-08', [1, 3], '09:00'],
      ['2026-11-09', null, [3], '09:00'],
      ['2026-11-09', null, [1, 3], '13:00'],
    ]);
  });

  it('FOLLOWING on the first day of the case does not split it', () => {
    const changed = changedScheduleSlot(rule, slot('2026-11-02'), slot('2026-11-02', '13:00', '14:00'), 'FOLLOWING');
    expect(changed.cases.some((item) => item.until !== null)).toBe(false);
  });

  it('ALL moved to another weekday: the rhythm follows the day', () => {
    const changed = changedScheduleSlot(schedule([MONDAY_CASE]), slot('2026-11-09'), slot('2026-11-10'), 'ALL');
    expect(changed.cases[0].rule?.weekdays).toEqual([2]);
  });

  it('ALL, even weeks, moved into the next week: parity swapped, the same days follow', () => {
    const even = schedule([scheduleCase({ weekdays: [1], weekParity: 'EVEN' })]);
    const changed = changedScheduleSlot(even, slot('2026-11-09'), slot('2026-11-17'), 'ALL');
    expect(changed.cases[0].rule).toMatchObject({ weekdays: [2], weekParity: 'ODD' });
    // Even Mondays 11-09, 11-23, 12-07 become 11-17, 12-01, 12-15: no odd Tuesday before the first one moved (11-03).
    expect(slotDays({ ...even, ...changed }, '2026-11-02', '2026-12-15')).toEqual(['2026-11-17', '2026-12-01', '2026-12-15']);
  });

  it('ALL, every 2 weeks, moved into the next week: its weeks counted from the moved day', () => {
    const everyTwo = schedule([scheduleCase({ weekdays: [1], interval: 2 })]);
    const changed = changedScheduleSlot(everyTwo, slot('2026-11-16'), slot('2026-11-24'), 'ALL');
    expect(slotDays({ ...everyTwo, ...changed }, '2026-11-02', '2026-12-31')).toEqual(['2026-11-10', '2026-11-24', '2026-12-08', '2026-12-22']);
  });

  it('a monthly case moved: the new day of the month', () => {
    const monthly = schedule([scheduleCase({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: 15 })]);
    const changed = changedScheduleSlot(monthly, slot('2026-11-15'), slot('2026-11-20'), 'ALL');
    expect(slotDays({ ...monthly, ...changed }, '2026-11-01', '2027-01-31')).toEqual(['2026-11-20', '2026-12-20', '2027-01-20']);
  });

  it('refusals in the words of the schedule', () => {
    const ended = schedule([MONDAY_CASE], { endDate: '2026-11-30' });
    expect(() => changedScheduleSlot(ended, slot('2026-11-09'), slot('2026-12-01'), 'THIS')).toThrow('Ce jour est en dehors de la période du créneau.');
    expect(() => changedScheduleSlot({ ...ended, ephemeris: true }, slot('2026-11-09'), slot('2026-12-01'), 'THIS')).toThrow('Ce jour est en dehors de la période de l’éphéméride.');
    expect(() => changedScheduleSlot(ended, slot('2026-11-09'), slot('2026-11-09', '12:00', '09:00'), 'THIS')).toThrow('La fin doit suivre le début.');
    expect(() => changedScheduleSlot(ended, slot('2026-11-10'), null, 'ALL')).toThrow('Horaires introuvables ce jour-là.');
    expect(() => changedScheduleSlot(ended, slot('2026-11-09'), null, 'ALL')).toThrow('Ce sont les derniers horaires du créneau : supprimez le créneau lui-même.');
  });

  it('a change giving more than 20 cases is refused when saved (« 20 cas au plus. »)', () => {
    const full = schedule(Array.from({ length: 20 }, () => scheduleCase({ weekdays: [1, 3] }, { times: { allDay: false, ranges: [{ start: '09:00', end: '10:00' }, { start: '11:00', end: '12:00' }] } })));
    const changed = changedScheduleSlot(full, slot('2026-11-09', '09:00', '10:00'), slot('2026-11-09', '13:00', '14:00'), 'FOLLOWING');
    expect(changed.cases.length).toBeGreaterThan(20);
    expect(scheduleCasesSchema.safeParse(changed.cases).error?.issues[0].message).toBe('20 cas au plus.');
  });

  describe('éphémérides moved with their period', () => {
    const holiday = { ephemeris: true, endDate: '2026-11-02' };

    it('a single day moves with its whole period, whatever the scope', () => {
      const one = schedule([scheduleCase({ frequency: 'DAILY' }, { times: { allDay: true, ranges: [] } })], holiday);
      const changed = changedScheduleSlot(one, { date: '2026-11-02', start: '00:00', end: '24:00', allDay: true }, { date: '2026-11-05', start: '00:00', end: '24:00', allDay: true }, 'THIS');
      expect([changed.startDate, changed.endDate]).toEqual(['2026-11-05', '2026-11-05']);
    });

    it('ALL, Mon + Fri every 2 weeks, +3 days: two cases, the same days moved, none lost', () => {
      const days = { allDay: true, ranges: [] };
      const period = schedule([scheduleCase({ weekdays: [1, 5], interval: 2 }, { times: days })], { ephemeris: true, endDate: '2026-12-31', exceptions: [{ from: '2026-11-16', to: '2026-11-16', label: '', cases: [] }] });
      const whole = (date: string) => ({ date, start: '00:00', end: '24:00', allDay: true });
      const changed = changedScheduleSlot(period, whole('2026-11-02'), whole('2026-11-05'), 'ALL');
      expect(changed.cases.map((item) => item.rule?.weekdays)).toEqual([[4], [1]]);
      expect([changed.startDate, changed.endDate, changed.exceptions[0].from]).toEqual(['2026-11-05', '2027-01-03', '2026-11-19']);
      const before = slotDays(period, '2026-11-01', '2026-12-31');
      expect(slotDays({ ...period, ...changed }, '2026-11-01', '2027-01-03')).toEqual(before.map((date) => addDays(date, 3)));
    });

    it('moved whole, cases split beyond 20: refused with its reason, not « 20 cas au plus. » at the save', () => {
      const days = { allDay: true, ranges: [] };
      const whole = (date: string) => ({ date, start: '00:00', end: '24:00', allDay: true });
      // Each Mon + Fri every 2 weeks case, +3 days, becomes two (Thursday the same week, Monday the next).
      const cases = (count: number) => Array.from({ length: count }, () => scheduleCase({ weekdays: [1, 5], interval: 2 }, { times: days }));
      const period = (count: number) => schedule(cases(count), { ephemeris: true, endDate: '2026-12-31' });
      expect(() => changedScheduleSlot(period(11), whole('2026-11-02'), whole('2026-11-05'), 'ALL')).toThrow(SPLIT_CASES_REFUSAL);
      // 10 cases make 20: accepted.
      expect(changedScheduleSlot(period(10), whole('2026-11-02'), whole('2026-11-05'), 'ALL').cases).toHaveLength(20);
      // The same in an exception of the period.
      const exception = { from: '2026-11-09', to: '2026-11-22', label: '', cases: cases(11) };
      expect(() => changedScheduleSlot({ ...period(1), exceptions: [exception] }, whole('2026-11-02'), whole('2026-11-05'), 'ALL')).toThrow(SPLIT_CASES_REFUSAL);
      // Moved by whole weeks, nothing splits: 20 cases stay 20.
      const full = schedule(cases(20), { ephemeris: true, endDate: '2026-12-31' });
      expect(changedScheduleSlot(full, whole('2026-11-02'), whole('2026-11-16'), 'ALL').cases).toHaveLength(20);
    });

    it('several days with THIS: the day stays within the period (créneau rule)', () => {
      const period = schedule([scheduleCase({ frequency: 'DAILY' })], { ephemeris: true, endDate: '2026-11-10' });
      const changed = changedScheduleSlot(period, slot('2026-11-03'), slot('2026-11-04'), 'THIS');
      expect([changed.startDate, changed.endDate]).toEqual(['2026-11-02', '2026-11-10']);
    });
  });
});

describe('scheduleTypeContextError', () => {
  it('only a kind of éphémérides is a context of the budget; only a context is shared', () => {
    expect(scheduleTypeContextError({ ephemeris: false, budgetContext: true, sharedContext: false })?.field).toBe('budgetContext');
    expect(scheduleTypeContextError({ ephemeris: true, budgetContext: false, sharedContext: true })?.field).toBe('sharedContext');
    expect(scheduleTypeContextError({ ephemeris: true, budgetContext: true, sharedContext: true })).toBeNull();
  });
});

describe('countedSchedules', () => {
  // What a page shows without « Afficher les archivés », and what the slot conditions count: neither archived nor of an
  // archived kind, in their own workspace (another workspace's as it says).
  const own = { id: 'own', archived: false, kindArchived: false };
  const archived = { id: 'archived', archived: true, kindArchived: false };
  const ofArchivedKind = { id: 'kind', archived: false, kindArchived: true };
  const both = { id: 'both', archived: true, kindArchived: true };
  const unknown = { id: 'unknown', archived: null, kindArchived: undefined };

  it('keeps a schedule neither archived nor of an archived kind', () => {
    expect(countedSchedules([own]).map(({ id }) => id)).toEqual(['own']);
  });

  it('leaves out an archived schedule, one of an archived kind, and one archived of an archived kind', () => {
    expect(countedSchedules([archived, ofArchivedKind, both])).toEqual([]);
  });

  it('counts a schedule that does not say it (none, or null) as not archived', () => {
    expect(countedSchedules([unknown]).map(({ id }) => id)).toEqual(['unknown']);
  });

  it('keeps the order of the schedules given', () => {
    expect(countedSchedules([unknown, archived, own, ofArchivedKind]).map(({ id }) => id)).toEqual(['unknown', 'own']);
  });
});
