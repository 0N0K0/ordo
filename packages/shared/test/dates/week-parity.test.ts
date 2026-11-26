import { describe, expect, it } from 'vitest';
import {
  FOURTH_PARITY_WEEK_REFUSAL,
  movedWeekdays,
  occurrenceDates,
  PARITY_INTERVAL_REFUSAL,
  recurrenceSchema,
  rhythmInterval,
  ruleCountsFromDay,
  ruleMovedTo,
  ruleValues,
  WEEKDAY_PARITY_REFUSAL,
  weeksChange,
} from '../../src/dates/recurrence';
import { ordinal, WEEK_POSITION_LABELS } from '../../src/dates/months';
import { isoWeek, isoWeekHasParity, isoWeeksInYear, isoYear, WEEK_PARITY_WORDS } from '../../src/dates/days';
import { rule } from '../rules';

/** Monthly rule on a weekday of the even or odd weeks of the month. */
const monthly = (weekday: number, position: -1 | 1 | 2 | 3 | 4, weekdayParity: 'EVEN' | 'ODD') => rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', weekday, position, weekdayParity });

describe('ISO weeks', () => {
  it('week numbers across the end of a year of 53 weeks', () => {
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(isoWeek('2027-01-03')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(isoWeek('2025-12-29')).toBe(1);
  });

  it('ISO year: that of the Thursday of the week', () => {
    expect(isoYear('2027-01-03')).toBe(2026);
    expect(isoYear('2024-12-30')).toBe(2025);
    expect(isoYear('2026-06-15')).toBe(2026);
  });

  it('years of 52 and 53 weeks', () => {
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2027)).toBe(52);
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeek('2027-12-27')).toBe(52);
    expect(isoWeek('2028-01-03')).toBe(1);
  });

  it('parity: week 53 and week 1 are both odd', () => {
    expect(isoWeekHasParity('2026-12-28', 'ODD')).toBe(true);
    expect(isoWeekHasParity('2027-01-04', 'ODD')).toBe(true);
    expect(isoWeekHasParity('2027-01-11', 'EVEN')).toBe(true);
  });
});

describe('weekly: every x even / odd weeks', () => {
  it('x = 1: every week of that parity, the former rules alike (their interval unused)', () => {
    const every = occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN' }), '2026-11-02', '2026-11-02', '2026-12-01');
    expect(every).toEqual(['2026-11-09', '2026-11-23']);
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', interval: 3 }), '2026-11-02', '2026-11-02', '2026-12-01')).toEqual(every);
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', parityInterval: 1 }), '2026-11-02', '2026-11-02', '2026-12-01')).toEqual(every);
  });

  it('x = 2 even: weeks 2, 6, 10…', () => {
    const dates = occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', parityInterval: 2 }), '2026-01-05', '2026-01-01', '2026-03-20');
    expect(dates).toEqual(['2026-01-05', '2026-02-02', '2026-03-02']);
    expect(dates.map(isoWeek)).toEqual([2, 6, 10]);
  });

  it('counted from the first week of that parity of the series, its first date in a week of the other one', () => {
    // Monday 2025-12-29: week 1 of 2026 (odd), the first even week is week 2.
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', parityInterval: 2 }), '2025-12-29', '2025-12-29', '2026-02-10')).toEqual(['2026-01-05', '2026-02-02']);
  });

  it('x = 2 odd across weeks 53 and 1: two odd weeks in a row, counted one after the other', () => {
    // Odd weeks 51, 53, 1, 3, 5: one out of two is 51, 1, 5.
    const dates = occurrenceDates(rule({ weekdays: [1], weekParity: 'ODD', parityInterval: 2 }), '2026-12-14', '2026-12-14', '2027-02-10');
    expect(dates).toEqual(['2026-12-14', '2027-01-04', '2027-02-01']);
    expect(dates.map(isoWeek)).toEqual([51, 1, 5]);
  });

  it('x = 3 even across the end of the year: even weeks 46, 52, 6', () => {
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', parityInterval: 3 }), '2026-11-02', '2026-11-02', '2027-02-28')).toEqual(['2026-11-09', '2026-12-21', '2027-02-08']);
  });

  it('several weekdays in each week kept', () => {
    expect(occurrenceDates(rule({ weekdays: [1, 4], weekParity: 'ODD', parityInterval: 2 }), '2026-01-01', '2026-01-01', '2026-02-01')).toEqual(['2026-01-01', '2026-01-26', '2026-01-29']);
  });

  it('a series over many years keeps one week of that parity out of x', () => {
    const dates = occurrenceDates(rule({ weekdays: [3], weekParity: 'ODD', parityInterval: 2 }), '2025-01-01', '2025-01-01', '2032-12-31');
    expect(dates.every((date) => isoWeek(date) % 2 === 1)).toBe(true);
    const odd = occurrenceDates(rule({ weekdays: [3], weekParity: 'ODD' }), '2025-01-01', '2025-01-01', '2032-12-31');
    expect(dates).toEqual(odd.filter((_, index) => index % 2 === 0));
  });

  it('depends on the day it counts from, x > 1 only; its rhythm', () => {
    expect(ruleCountsFromDay(rule({ weekParity: 'EVEN', parityInterval: 2 }))).toBe(true);
    expect(ruleCountsFromDay(rule({ weekParity: 'EVEN', parityInterval: 1, interval: 3 }))).toBe(false);
    expect(rhythmInterval(rule({ weekParity: 'ODD', parityInterval: 3 }))).toBe(6);
    expect(rhythmInterval(rule({ weekParity: 'ODD', interval: 3 }))).toBe(2);
    expect(rhythmInterval(rule({ interval: 3 }))).toBe(3);
  });

  it('moved: its weeks change for an odd number of weeks, or a number of its weeks not a multiple of x', () => {
    const twice = rule({ weekParity: 'EVEN', parityInterval: 2 });
    expect(weeksChange(twice, 1)).toBe(true);
    expect(weeksChange(twice, 2)).toBe(true);
    expect(weeksChange(twice, 4)).toBe(false);
    expect(weeksChange(rule({ weekParity: 'EVEN' }), 2)).toBe(false);
  });

  it('moved into the next week: parity swapped, its rhythm counted from its first occurrence moved', () => {
    const moved = movedWeekdays(rule({ weekdays: [5], weekParity: 'EVEN', parityInterval: 2 }), '2026-01-05', [5], 3);
    expect(moved.rule).toMatchObject({ weekdays: [1], weekParity: 'ODD', parityInterval: 2 });
    // First Friday: 2026-01-09 (week 2), moved to Monday 2026-01-12 (week 3).
    expect(moved.anchor).toBe('2026-01-12');
    expect(occurrenceDates(moved.rule, moved.anchor ?? '', '2026-01-12', '2026-02-28')).toEqual(['2026-01-12', '2026-02-09']);
  });
});

describe('monthly: a weekday of the nth / last even / odd week of the month', () => {
  it('the Tuesday of the 1st even week', () => {
    expect(occurrenceDates(monthly(2, 1, 'EVEN'), '2026-11-01', '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-12-08']);
  });

  it('the Tuesday of the last even week', () => {
    expect(occurrenceDates(monthly(2, -1, 'EVEN'), '2026-11-01', '2026-11-01', '2027-01-31')).toEqual(['2026-11-24', '2026-12-22', '2027-01-26']);
  });

  it('the 2nd odd week', () => {
    expect(occurrenceDates(monthly(2, 2, 'ODD'), '2026-11-01', '2026-11-01', '2026-12-31')).toEqual(['2026-11-17', '2026-12-15']);
  });

  it('no 3rd one in a month: no occurrence that month', () => {
    expect(occurrenceDates(monthly(2, 3, 'ODD'), '2026-11-01', '2026-11-01', '2027-03-31')).toEqual(['2026-12-29', '2027-03-30']);
    expect(occurrenceDates(monthly(2, 3, 'EVEN'), '2026-11-01', '2026-11-01', '2027-03-31')).toEqual([]);
  });

  it('weeks 53 and 1 in the same month: both odd, counted one after the other', () => {
    // Sundays of January 2027: the 3rd (week 53), 10th (1), 17th (2), 24th (3), 31st (4).
    const odd = (position: -1 | 1 | 2 | 3) => occurrenceDates(monthly(7, position, 'ODD'), '2027-01-01', '2027-01-01', '2027-01-31');
    expect([odd(1), odd(2), odd(3), odd(-1)]).toEqual([['2027-01-03'], ['2027-01-10'], ['2027-01-24'], ['2027-01-24']]);
    expect(occurrenceDates(monthly(7, 1, 'EVEN'), '2027-01-01', '2027-01-01', '2027-01-31')).toEqual(['2027-01-17']);
  });

  it('every 2 months', () => {
    expect(occurrenceDates({ ...monthly(2, 1, 'EVEN'), interval: 2 }, '2026-11-01', '2026-11-01', '2027-03-31')).toEqual(['2026-11-10', '2027-01-12', '2027-03-09']);
  });

  it('values of the first date when not chosen', () => {
    const notChosen = rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', weekdayParity: 'EVEN' });
    // Tuesday 2026-11-10: the 1st Tuesday of an even week of November.
    expect(ruleValues(notChosen, '2026-11-10')).toMatchObject({ weekday: 2, position: 1 });
    expect(occurrenceDates(notChosen, '2026-11-10', '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-12-08']);
  });

  it('moved to another day: the parity and place of that day', () => {
    // From the Tuesday of the 1st even week to Tuesday 2026-11-17 (week 47, odd): the 1st odd one is the 3rd, the 2nd is the 17th.
    expect(ruleMovedTo(monthly(2, 1, 'EVEN'), '2026-11-17')).toMatchObject({ weekday: 2, weekdayParity: 'ODD', position: 2 });
    expect(ruleMovedTo(monthly(2, -1, 'EVEN'), '2026-12-29')).toMatchObject({ weekdayParity: 'ODD', position: -1 });
  });
});

describe('recurrenceSchema: even / odd weeks', () => {
  it('former rules (without the new fields) still read', () => {
    expect(recurrenceSchema.safeParse(rule({ weekParity: 'EVEN', interval: 3 })).success).toBe(true);
  });

  it('refuses a number of even / odd weeks without even or odd weeks', () => {
    const parsed = recurrenceSchema.safeParse(rule({ parityInterval: 2 }));
    expect(parsed.error?.issues[0].message).toBe(PARITY_INTERVAL_REFUSAL);
    expect(recurrenceSchema.safeParse(rule({ frequency: 'MONTHLY', weekParity: 'EVEN', parityInterval: 2 })).error?.issues[0].message).toBe(PARITY_INTERVAL_REFUSAL);
  });

  it('refuses an even / odd week of the month outside a monthly rule by weekday', () => {
    expect(recurrenceSchema.safeParse(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', weekdayParity: 'EVEN' })).error?.issues[0].message).toBe(WEEKDAY_PARITY_REFUSAL);
    expect(recurrenceSchema.safeParse(rule({ frequency: 'YEARLY', monthlyMode: 'WEEKDAY', weekdayParity: 'EVEN' })).error?.issues[0].message).toBe(WEEKDAY_PARITY_REFUSAL);
  });

  it('refuses a 4th even / odd week', () => {
    expect(recurrenceSchema.safeParse(monthly(2, 4, 'EVEN')).error?.issues[0].message).toBe(FOURTH_PARITY_WEEK_REFUSAL);
    expect(recurrenceSchema.safeParse(monthly(2, 3, 'EVEN')).success).toBe(true);
  });
});

describe('labels', () => {
  it('feminine ordinals of the weeks of the month', () => {
    expect(ordinal(1, true)).toBe('1re');
    expect(ordinal(1)).toBe('1er');
    expect([1, 2, 3, -1].map((position) => WEEK_POSITION_LABELS[position])).toEqual(['1re', '2e', '3e', 'dernière']);
  });

  it('parity in words', () => {
    expect(WEEK_PARITY_WORDS).toEqual({ EVEN: 'paire', ODD: 'impaire' });
  });
});
