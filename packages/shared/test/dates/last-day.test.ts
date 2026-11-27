import { describe, expect, it } from 'vitest';
import {
  cutSeries,
  isLastDayRule,
  LAST_DAY,
  LAST_DAY_MOVE_REFUSAL,
  lastDayStandIn,
  occurrenceDates,
  occurrencesBefore,
  proposedMovedRule,
  recurrenceSchema,
  RuleChoiceRequired,
  ruleMovedTo,
  ruleValues,
  shiftedRulePieces,
  shiftedSeries,
  spanEnd,
  type Duration,
  type Recurrence,
} from '../../src/dates/recurrence';
import { addDays } from '../../src/dates/days';
import { lastDayOfMonth } from '../../src/dates/months';
import { changedScheduleSlot, LAST_DAY_CASES_REFUSAL, plannedSlots, type WorkScheduleRule } from '../../src/calendar/work-schedules';
import { readOpens, routineOpenDate, routineOccurrences, shiftedRoutinePiece, shiftedRoutineRule } from '../../src/routines/routines';
import { allDates, rule } from '../rules';
import { schedule, scheduleCase } from '../calendar/schedules';

/** Every month on its last day. */
const MONTHLY_LAST = rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: LAST_DAY });
/** Every year on the last day of February. */
const FEBRUARY_LAST = rule({ frequency: 'YEARLY', monthlyMode: 'DAY', monthDay: LAST_DAY, month: 2 });

/**
 * Refusal thrown by a move, or none.
 * @param {() => unknown} move Move.
 * @returns {RuleChoiceRequired} Refusal.
 */
function refusalOf(move: () => unknown): RuleChoiceRequired {
  try {
    move();
  } catch (error) {
    if (error instanceof RuleChoiceRequired) return error;
    throw error;
  }
  throw new Error('No refusal.');
}

describe('recurrenceSchema: the last day of the month', () => {
  it('takes -1 (the last day) and 1 to 31, nothing else', () => {
    expect(recurrenceSchema.safeParse(MONTHLY_LAST).success).toBe(true);
    expect(recurrenceSchema.safeParse({ ...MONTHLY_LAST, monthDay: 0 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ ...MONTHLY_LAST, monthDay: -2 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ ...MONTHLY_LAST, monthDay: 31 }).success).toBe(true);
  });

  it('isLastDayRule: monthly or yearly, by day number only', () => {
    expect(isLastDayRule(MONTHLY_LAST)).toBe(true);
    expect(isLastDayRule(FEBRUARY_LAST)).toBe(true);
    expect(isLastDayRule({ ...MONTHLY_LAST, monthlyMode: 'WEEKDAY' })).toBe(false);
    expect(isLastDayRule({ ...MONTHLY_LAST, monthDay: 31 })).toBe(false);
    expect(isLastDayRule({ ...MONTHLY_LAST, frequency: 'WEEKLY' })).toBe(false);
    expect(isLastDayRule(null)).toBe(false);
  });
});

describe('occurrenceDates: the last day of the month', () => {
  it('monthly: 31, 30, 29 or 28 by the month (leap and common Februaries)', () => {
    expect(occurrenceDates(MONTHLY_LAST, '2027-01-31', '2027-01-01', '2028-04-30')).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
      '2027-06-30',
      '2027-07-31',
      '2027-08-31',
      '2027-09-30',
      '2027-10-31',
      '2027-11-30',
      '2027-12-31',
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);
  });

  it('every day of the result is the last of its month, across the daylight saving changes (March and October)', () => {
    const dates = occurrenceDates(MONTHLY_LAST, '2026-11-30', '2026-11-01', '2031-12-31');
    expect(dates).toHaveLength(62);
    expect(dates.every((date) => lastDayOfMonth(date) === date)).toBe(true);
    expect(dates).toContain('2027-03-31');
    expect(dates).toContain('2027-10-31');
  });

  it('from a first date that is not a last day: the last days from its month on', () => {
    expect(occurrenceDates(MONTHLY_LAST, '2026-11-10', '2026-11-01', '2027-02-28')).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  });

  it('every 2 months, counted, with two exceptions (not counted)', () => {
    const counted = { ...MONTHLY_LAST, interval: 2, count: 3, exceptions: ['2027-03-31', '2027-05-31'] };
    expect(occurrenceDates(counted, '2027-01-31', '2027-01-01', '2028-12-31')).toEqual(['2027-01-31', '2027-07-31', '2027-09-30']);
  });

  it('yearly: the last day of February, 28 or 29', () => {
    expect(occurrenceDates(FEBRUARY_LAST, '2027-02-28', '2027-01-01', '2029-12-31')).toEqual(['2027-02-28', '2028-02-29', '2029-02-28']);
  });

  it('the same days as the 31st (a day missing from a month falls on its last day), whatever the first date', () => {
    for (let start = '2026-01-01'; start <= '2026-12-31'; start = addDays(start, 7)) {
      for (const base of [MONTHLY_LAST, { ...MONTHLY_LAST, interval: 3 }, { ...FEBRUARY_LAST, month: 4 }, { ...FEBRUARY_LAST, interval: 2 }]) {
        expect(allDates(base, start)).toEqual(allDates(lastDayStandIn(base), start));
      }
    }
  });

  it('days chosen otherwise are unchanged: the 30th falls on the 28th of February, the 29th of February on the 28th', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: 30 }), '2027-01-30', '2027-01-01', '2027-03-31')).toEqual(['2027-01-30', '2027-02-28', '2027-03-30']);
    expect(occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'DAY', monthDay: 29, month: 2 }), '2028-02-29', '2028-01-01', '2029-12-31')).toEqual(['2028-02-29', '2029-02-28']);
  });

  it('ruleValues keeps the last day', () => {
    expect(ruleValues(MONTHLY_LAST, '2026-11-10').monthDay).toBe(LAST_DAY);
  });
});

describe('moves of a rule on the last day of the month: never decided, the new rule chosen', () => {
  it('ruleMovedTo refuses it; other rules move as before', () => {
    expect(() => ruleMovedTo(MONTHLY_LAST, '2026-11-15')).toThrow(LAST_DAY_MOVE_REFUSAL);
    expect(ruleMovedTo(rule({ frequency: 'MONTHLY', monthDay: 31 }), '2026-11-15').monthDay).toBe(15);
  });

  it('proposedMovedRule: the last day again when the new day is the last of its month, else that day', () => {
    expect(proposedMovedRule(MONTHLY_LAST, '2027-02-28').monthDay).toBe(LAST_DAY);
    expect(proposedMovedRule(MONTHLY_LAST, '2028-02-28').monthDay).toBe(28);
    expect(proposedMovedRule(MONTHLY_LAST, '2026-11-15').monthDay).toBe(15);
    expect(proposedMovedRule(FEBRUARY_LAST, '2027-03-31')).toMatchObject({ monthDay: LAST_DAY, month: 3 });
  });

  it('« Toutes »: refused with the rule proposed for the day the occurrence goes to', () => {
    const refusal = refusalOf(() => shiftedSeries(MONTHLY_LAST, '2026-10-31', 31, null, '2027-03-31'));
    expect(refusal.message).toBe(LAST_DAY_MOVE_REFUSAL);
    expect(refusal.start).toBe('2027-03-31');
    expect(refusal.proposal).toMatchObject({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: LAST_DAY });
    expect(refusalOf(() => shiftedSeries(MONTHLY_LAST, '2026-10-31', -16, null, '2027-02-12')).proposal.monthDay).toBe(12);
  });

  it('« Toutes »: its end and exceptions moved as another rule, in the rule proposed', () => {
    const ended = { ...MONTHLY_LAST, until: '2027-06-30', exceptions: ['2027-01-31', '2027-03-31'] };
    const { proposal } = refusalOf(() => shiftedSeries(ended, '2026-10-31', -1, null, '2026-11-29'));
    expect(proposal).toMatchObject({ until: '2027-06-29', exceptions: ['2027-01-30', '2027-03-30'], monthDay: 29 });
  });

  it('« Toutes » with the new rule chosen: that rule, the series moved by as many days', () => {
    const chosen = { ...MONTHLY_LAST, monthDay: 15 };
    expect(shiftedSeries(MONTHLY_LAST, '2026-10-31', -16, chosen, '2026-10-15')).toEqual([{ rule: chosen, start: '2026-10-15' }]);
  });

  it('not moved (its hours only): nothing asked', () => {
    expect(shiftedSeries(MONTHLY_LAST, '2026-10-31', 0)).toEqual([{ rule: MONTHLY_LAST, start: '2026-10-31' }]);
    expect(shiftedRulePieces(MONTHLY_LAST, '2026-10-31', 0, '2026-10-31')).toEqual([{ rule: MONTHLY_LAST, anchor: null }]);
  });

  it('« Celle-ci et les suivantes »: the rule proposed counts the occurrences left; the one chosen is kept as it is', () => {
    const counted = { ...MONTHLY_LAST, count: 6 };
    const { proposal, start } = refusalOf(() => cutSeries(counted, counted, '2026-10-31', '2027-01-31', -1));
    expect(start).toBe('2027-01-30');
    expect(proposal).toMatchObject({ count: 6 - occurrencesBefore(counted, '2026-10-31', '2027-01-31'), monthDay: 30 });
    const chosen = { ...proposal, monthDay: LAST_DAY };
    expect(cutSeries(counted, counted, '2026-10-31', '2027-01-31', -1, chosen)).toEqual([{ rule: chosen, start: '2027-01-30' }]);
  });

  it('yearly on the last day of February moved to the 1st of March: proposed on the 1st of March', () => {
    expect(refusalOf(() => cutSeries(FEBRUARY_LAST, FEBRUARY_LAST, '2027-02-28', '2028-02-29', 1)).proposal).toMatchObject({ monthDay: 1, month: 3 });
  });
});

describe('routines: a rule on the last day of the month moved', () => {
  it('refused with the rule proposed; the new rule chosen is kept; its times only: nothing asked', () => {
    const { proposal, start } = refusalOf(() => shiftedRoutineRule(MONTHLY_LAST, '2026-10-31', '2026-11-30', '2026-11-27', false));
    expect(start).toBe('2026-11-27');
    expect(proposal.monthDay).toBe(27);
    expect(refusalOf(() => shiftedRoutineRule(MONTHLY_LAST, '2026-10-31', '2026-11-30', '2026-12-31', true)).proposal.monthDay).toBe(LAST_DAY);
    const chosen = { ...MONTHLY_LAST, interval: 2 };
    expect(shiftedRoutineRule(MONTHLY_LAST, '2026-10-31', '2026-11-30', '2026-11-27', false, chosen)).toBe(chosen);
    expect(shiftedRoutinePiece(MONTHLY_LAST, '2026-10-31', '2026-11-30', '2026-11-27', false, chosen).recurrence).toBe(chosen);
    expect(shiftedRoutineRule(MONTHLY_LAST, '2026-10-31', '2026-11-30', '2026-11-30', false)).toEqual(MONTHLY_LAST);
  });

  it('« Ouverture » on a day of the month with a due last day: within the month of the due day', () => {
    expect(routineOpenDate('2027-02-28', { mode: 'DAY', day: 25, month: null }, 'MONTHLY')).toBe('2027-02-25');
    expect(routineOpenDate('2027-02-28', { mode: 'DAY', day: 30, month: null }, 'MONTHLY')).toBe('2027-02-28');
    expect(routineOpenDate('2028-02-29', { mode: 'DAY', day: 1, month: 2 }, 'YEARLY')).toBe('2028-02-01');
    expect(routineOccurrences(MONTHLY_LAST, '2027-01-31', '2027-02-26', { mode: 'DAY', day: 25, month: null })).toEqual({ current: '2027-02-28', next: '2027-03-31' });
  });
});

describe('slots: a case on the last day of the month moved', () => {
  const slot = (date: string) => ({ date, start: '09:00', end: '12:00', allDay: false });
  const lastDays = schedule([scheduleCase({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: LAST_DAY })]);
  const days = (item: WorkScheduleRule, from: string, to: string) => plannedSlots([item], from, to).map((planned) => planned.date);

  it('its slots on the last day of each month', () => {
    expect(days(lastDays, '2026-11-01', '2027-03-31')).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('« Ce jour seulement »: nothing asked', () => {
    expect(() => changedScheduleSlot(lastDays, slot('2026-12-31'), slot('2026-12-30'), 'THIS')).not.toThrow();
  });

  it('« Ce jour et les suivantes » / « Tous »: refused with the rule proposed, then the new rule chosen', () => {
    const refusal = refusalOf(() => changedScheduleSlot(lastDays, slot('2026-12-31'), slot('2026-12-30'), 'FOLLOWING'));
    expect(refusal.proposal.monthDay).toBe(30);
    const chosen: Recurrence = { ...refusal.proposal, monthDay: LAST_DAY };
    const changed = { ...lastDays, ...changedScheduleSlot(lastDays, slot('2026-12-31'), slot('2026-12-30'), 'FOLLOWING', chosen) };
    expect(changed.cases.at(-1)?.rule).toEqual(chosen);
    expect(refusalOf(() => changedScheduleSlot(lastDays, slot('2026-12-31'), slot('2027-01-01'), 'ALL')).proposal.monthDay).toBe(1);
  });

  it('an éphéméride moved whole: its case asked; two cases on the last day refused', () => {
    const ephemeris = { ...lastDays, ephemeris: true, endDate: '2027-06-30' };
    expect(refusalOf(() => changedScheduleSlot(ephemeris, slot('2026-12-31'), slot('2027-01-01'), 'ALL'))).toBeInstanceOf(RuleChoiceRequired);
    const two = { ...ephemeris, cases: [...ephemeris.cases, scheduleCase({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: LAST_DAY, interval: 2 })] };
    expect(() => changedScheduleSlot(two, slot('2026-12-31'), slot('2027-01-01'), 'ALL', MONTHLY_LAST)).toThrow(LAST_DAY_CASES_REFUSAL);
  });
});

describe('duration « Jusqu’au dernier jour du mois »', () => {
  const toLast = (month: number | null): Duration => ({ unit: 'TO_DAY', count: 1, day: LAST_DAY, month, week: null });

  it('is valid, as a day number; 0 is not', () => {
    expect(recurrenceSchema.safeParse({ ...MONTHLY_LAST, monthDay: 15, duration: toLast(null) }).success).toBe(true);
    expect(recurrenceSchema.safeParse({ ...MONTHLY_LAST, monthDay: 15, duration: { ...toLast(null), day: 0 } }).success).toBe(false);
  });

  it('of the same month: its last day (February 28 or 29), the first day itself when it is the last one', () => {
    expect(spanEnd(toLast(null), '2027-02-10')).toBe('2027-02-28');
    expect(spanEnd(toLast(null), '2028-02-10')).toBe('2028-02-29');
    expect(spanEnd(toLast(null), '2027-04-30')).toBe('2027-04-30');
  });

  it('of a month: its last day, the next year when it comes before', () => {
    expect(spanEnd(toLast(2), '2027-01-15')).toBe('2027-02-28');
    expect(spanEnd(toLast(2), '2027-03-01')).toBe('2028-02-29');
  });

  it('the same end as the 31st, whatever the first day and the month', () => {
    for (let start = '2026-01-01'; start <= '2028-12-31'; start = addDays(start, 5)) {
      for (const month of [null, 1, 2, 4, 12]) expect(spanEnd(toLast(month), start)).toBe(spanEnd({ ...toLast(month), day: 31 }, start));
    }
  });

  it('a slot case on Mondays up to the last day of the month covers the end of the month', () => {
    const item = scheduleCase({ weekdays: [1] }, { rule: { ...rule({ weekdays: [1] }), duration: toLast(null) } });
    expect(plannedSlots([schedule([item])], '2027-02-22', '2027-03-02').map((planned) => planned.date)).toEqual(['2027-02-22', '2027-02-23', '2027-02-24', '2027-02-25', '2027-02-26', '2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
  });
});

describe('« Ouverture » on the last day of the month', () => {
  const last = (month: number | null) => ({ mode: 'DAY' as const, day: LAST_DAY, month });

  it('is read as saved', () => {
    expect(readOpens(last(null))).toEqual(last(null));
    expect(readOpens({ mode: 'DAY', day: 0, month: null })).toBeNull();
  });

  it('monthly: always the last day of the month before the due day’s, a due last day included', () => {
    expect(routineOpenDate('2027-03-15', last(null), 'MONTHLY')).toBe('2027-02-28');
    expect(routineOpenDate('2028-03-10', last(null), 'MONTHLY')).toBe('2028-02-29');
    expect(routineOpenDate('2027-03-31', last(null), 'MONTHLY')).toBe('2027-02-28');
    expect(routineOpenDate('2028-03-31', last(null), 'MONTHLY')).toBe('2028-02-29');
    expect(routineOpenDate('2027-01-05', last(null), 'MONTHLY')).toBe('2026-12-31');
    expect(routineOpenDate('2027-01-31', last(null), 'MONTHLY')).toBe('2026-12-31');
  });

  it('monthly on the 31st is unchanged: the due day itself when it is the 31st', () => {
    expect(routineOpenDate('2027-03-31', { ...last(null), day: 31 }, 'MONTHLY')).toBe('2027-03-31');
    expect(routineOpenDate('2027-03-15', { ...last(null), day: 31 }, 'MONTHLY')).toBe('2027-02-28');
  });

  it('monthly occurrences on the last day open from the last day of the month before', () => {
    expect(routineOccurrences(MONTHLY_LAST, '2027-01-31', '2027-03-01', last(null))).toEqual({ current: '2027-03-31', next: '2027-04-30' });
    expect(routineOccurrences(MONTHLY_LAST, '2027-01-31', '2027-02-27', last(null)).current).toBe('2027-02-28');
  });

  it('yearly: the last day of its month, of the year before when it comes after the due day', () => {
    expect(routineOpenDate('2028-06-01', last(2), 'YEARLY')).toBe('2028-02-29');
    expect(routineOpenDate('2027-01-10', last(2), 'YEARLY')).toBe('2026-02-28');
  });

  it('monthly: the last day of the month before, for every due day; yearly: the same day as the 31st', () => {
    for (let due = '2026-01-01'; due <= '2028-12-31'; due = addDays(due, 3)) {
      expect(routineOpenDate(due, last(null), 'MONTHLY')).toBe(addDays(`${due.slice(0, 7)}-01`, -1));
      expect(routineOpenDate(due, last(4), 'YEARLY')).toBe(routineOpenDate(due, { ...last(4), day: 31 }, 'YEARLY'));
    }
  });
});
