import { describe, expect, it } from 'vitest';
import {
  crossedWeeks,
  cutSeries,
  movedWeekdays,
  occurrenceDates,
  occurrencesBefore,
  recurrenceSchema,
  ruleCountsFromDay,
  ruleMovedTo,
  seriesOn,
  shiftedRulePieces,
  shiftedSeries,
  spanEnd,
  weeksChange,
  type Duration,
  type MovedSeries,
} from '../../src/dates/recurrence';
import { addDays, isoWeek, weekdayOfDate } from '../../src/dates/days';
import { allDates, rule } from '../rules';

/** Mondays and Fridays every 2 weeks from Monday 2026-11-02, 6 occurrences. */
const MON_FRI_2W = rule({ weekdays: [1, 5], interval: 2, count: 6 });
const MON_FRI_2W_DATES = ['2026-11-02', '2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30', '2026-12-04'];

/**
 * Every occurrence of the series a series became, in order.
 * @param {MovedSeries[]} series Series.
 * @returns {string[]} Dates.
 */
const datesOf = (series: MovedSeries[]): string[] => series.flatMap((item) => allDates(item.rule, item.start)).sort();

describe('occurrenceDates: frequencies', () => {
  it('daily every n days counts from the first date', () => {
    expect(occurrenceDates(rule({ frequency: 'DAILY', interval: 3 }), '2026-11-02', '2026-11-03', '2026-11-12')).toEqual(['2026-11-05', '2026-11-08', '2026-11-11']);
  });

  it('weekly without weekdays: the weekday of the first date', () => {
    expect(occurrenceDates(rule({}), '2026-11-04', '2026-11-01', '2026-11-20')).toEqual(['2026-11-04', '2026-11-11', '2026-11-18']);
  });

  it('weekly with weekdays: every chosen weekday, the first date included', () => {
    expect(occurrenceDates(rule({ weekdays: [2, 4] }), '2026-11-03', '2026-11-01', '2026-11-12')).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']);
  });

  it('every n weeks counts weeks from the week of the first date (Monday to Sunday)', () => {
    // First date a Friday: the Monday of the same week is on the rhythm too, the week after is not.
    expect(occurrenceDates(rule({ weekdays: [1, 5], interval: 2 }), '2026-11-06', '2026-11-01', '2026-11-30')).toEqual(['2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30']);
  });

  it('a day of a weekly rule before the first date never occurs', () => {
    expect(occurrenceDates(rule({ weekdays: [1, 5] }), '2026-11-04', '2026-11-01', '2026-11-08')).toEqual(['2026-11-06']);
  });

  it('even ISO weeks, whatever the interval', () => {
    const dates = occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN', interval: 3 }), '2026-11-02', '2026-11-02', '2026-12-01');
    expect(dates).toEqual(['2026-11-09', '2026-11-23']);
    expect(dates.every((date) => isoWeek(date) % 2 === 0)).toBe(true);
  });

  it('odd ISO weeks: week 53 and week 1 follow each other (two odd weeks in a row)', () => {
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'ODD' }), '2026-12-14', '2026-12-14', '2027-01-20')).toEqual(['2026-12-14', '2026-12-28', '2027-01-04', '2027-01-18']);
  });

  it('even ISO weeks: none in weeks 53 and 1', () => {
    expect(occurrenceDates(rule({ weekdays: [1], weekParity: 'EVEN' }), '2026-12-21', '2026-12-21', '2027-01-20')).toEqual(['2026-12-21', '2027-01-11']);
  });

  it('monthly « le 15 »: the same day number every month', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }), '2026-01-15', '2026-01-01', '2026-03-31')).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('monthly on the 31st: the last day of a shorter month', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }), '2026-01-31', '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('monthly on a chosen day number rather than the first date’s', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', monthDay: 30 }), '2026-01-10', '2026-01-01', '2026-03-31')).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('every n months counts months from the first date', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', interval: 2 }), '2026-11-15', '2026-11-01', '2027-03-31')).toEqual(['2026-11-15', '2027-01-15', '2027-03-15']);
  });

  it('monthly « 2e mardi »: the position of the first date', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY' }), '2026-11-10', '2026-11-01', '2027-01-31')).toEqual(['2026-11-10', '2026-12-08', '2027-01-12']);
  });

  it('monthly last weekday (position -1)', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', position: -1, weekday: 5 }), '2026-11-27', '2026-11-01', '2027-01-31')).toEqual(['2026-11-27', '2026-12-25', '2027-01-29']);
  });

  it('monthly weekday without a chosen position: a first date that is the last of its month means « the last »', () => {
    // Tuesday 2026-11-24 is both the 4th and the last Tuesday of November: December gives its last one (the 29th, the 5th).
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY' }), '2026-11-24', '2026-11-01', '2026-12-31')).toEqual(['2026-11-24', '2026-12-29']);
  });

  it('monthly chosen 4th weekday: the 4th even when a 5th exists', () => {
    expect(occurrenceDates(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', position: 4, weekday: 2 }), '2026-11-24', '2026-11-01', '2026-12-31')).toEqual(['2026-11-24', '2026-12-22']);
  });

  it('yearly on a day number: 29 February falls on the 28th of a common year', () => {
    expect(occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'DAY' }), '2024-02-29', '2024-01-01', '2028-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('yearly on the nth weekday of a month (first Saturday of April)', () => {
    expect(occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'WEEKDAY', position: 1, weekday: 6, month: 4 }), '2026-01-01', '2026-01-01', '2027-12-31')).toEqual(['2026-04-04', '2027-04-03']);
  });

  it('yearly on a weekday of an ISO week (Monday of week 51)', () => {
    const dates = occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'WEEK' }), '2026-12-14', '2026-12-01', '2028-12-31');
    expect(dates).toEqual(['2026-12-14', '2027-12-20', '2028-12-18']);
    expect(dates.map(isoWeek)).toEqual([51, 51, 51]);
  });

  it('yearly on week 53: no occurrence in a year without one', () => {
    expect(occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'WEEK' }), '2026-12-28', '2026-12-01', '2028-12-31')).toEqual(['2026-12-28']);
  });

  it('every n years counts years from the first date', () => {
    expect(occurrenceDates(rule({ frequency: 'YEARLY', monthlyMode: 'DAY', interval: 2 }), '2026-03-10', '2026-01-01', '2030-12-31')).toEqual(['2026-03-10', '2028-03-10', '2030-03-10']);
  });
});

describe('occurrenceDates: end, exclusions, pauses', () => {
  it('ends on its last date, included', () => {
    expect(occurrenceDates(rule({ frequency: 'DAILY', interval: 1, until: '2026-11-04' }), '2026-11-02', '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('a number of occurrences counts from the first date, even when the range starts later', () => {
    expect(occurrenceDates(rule({ frequency: 'DAILY', interval: 1, count: 3 }), '2026-11-02', '2026-11-03', '2026-11-30')).toEqual(['2026-11-03', '2026-11-04']);
  });

  it('excluded dates and paused days do not occur and are not counted', () => {
    const repeated = rule({ frequency: 'DAILY', interval: 1, count: 3, exceptions: ['2026-11-03'], pauses: [{ from: '2026-11-05', to: '2026-11-06' }] });
    expect(occurrenceDates(repeated, '2026-11-02', '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-04', '2026-11-07']);
  });

  it('the first date excluded is no occurrence', () => {
    expect(occurrenceDates(rule({ exceptions: ['2026-11-02'] }), '2026-11-02', '2026-11-01', '2026-11-10')).toEqual(['2026-11-09']);
  });

  it('nothing before the first date', () => {
    expect(occurrenceDates(rule({ frequency: 'DAILY', interval: 1 }), '2026-11-10', '2026-11-01', '2026-11-09')).toEqual([]);
  });

  it('occurrencesBefore counts those before a date, the date excluded, its number of occurrences ignored', () => {
    expect(occurrencesBefore(MON_FRI_2W, '2026-11-02', '2026-11-16')).toBe(2);
    expect(occurrencesBefore(MON_FRI_2W, '2026-11-02', '2027-06-01')).toBeGreaterThan(6);
    expect(occurrencesBefore(MON_FRI_2W, '2026-11-02', '2026-11-02')).toBe(0);
  });
});

describe('recurrenceSchema', () => {
  it('refuses an end date with a number of occurrences', () => {
    const result = recurrenceSchema.safeParse(rule({ until: '2026-12-31', count: 3 }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Choisissez une date de fin ou un nombre d’occurrences.');
  });

  it('interval 1 to 999, count 1 to 9999', () => {
    expect(recurrenceSchema.safeParse(rule({ interval: 0 })).success).toBe(false);
    expect(recurrenceSchema.safeParse(rule({ interval: 1000 })).success).toBe(false);
    expect(recurrenceSchema.safeParse(rule({ count: 10000 })).success).toBe(false);
    expect(recurrenceSchema.safeParse(rule({ interval: 999, count: 9999 })).success).toBe(true);
  });

  it('refuses a pause ending before it starts', () => {
    expect(recurrenceSchema.safeParse(rule({ pauses: [{ from: '2026-11-10', to: '2026-11-09' }] })).success).toBe(false);
  });
});

describe('ruleCountsFromDay', () => {
  it('every n (n > 1) and a number of occurrences depend on the day counted from; even / odd weeks do not', () => {
    expect(ruleCountsFromDay(null)).toBe(false);
    expect(ruleCountsFromDay(rule({}))).toBe(false);
    expect(ruleCountsFromDay(rule({ interval: 2 }))).toBe(true);
    expect(ruleCountsFromDay(rule({ interval: 2, weekParity: 'EVEN' }))).toBe(false);
    expect(ruleCountsFromDay(rule({ count: 4 }))).toBe(true);
  });
});

describe('spanEnd: duration of an occurrence', () => {
  const duration = (fields: Partial<Duration>): Duration => ({ unit: 'DAYS', count: 1, day: null, month: null, week: null, ...fields });

  it('N days, both included', () => {
    expect(spanEnd(duration({ count: 3 }), '2026-11-02')).toBe('2026-11-04');
  });

  it('N weeks: to the Sunday of the last week', () => {
    expect(spanEnd(duration({ unit: 'WEEKS', count: 1 }), '2026-11-04')).toBe('2026-11-08');
    expect(spanEnd(duration({ unit: 'WEEKS', count: 2 }), '2026-11-04')).toBe('2026-11-15');
  });

  // Code ≠ docs: N months ends one month too late (1 month from 11-15 ends on 12-31, 4 months on 2027-03-31), while
  // the docs say « jusqu'à la fin du dernier mois » (as N weeks: 1 week ends the same week) and `maxSpanDays` looks
  // back 31 days per month only.
  it.fails('N months: to the last day of the last month, over a year end', () => {
    expect(spanEnd(duration({ unit: 'MONTHS', count: 1 }), '2026-11-15')).toBe('2026-11-30');
    expect(spanEnd(duration({ unit: 'MONTHS', count: 4 }), '2026-11-15')).toBe('2027-02-28');
  });

  it('to a day of the month: this month, or the next one when it comes before', () => {
    expect(spanEnd(duration({ unit: 'TO_DAY', day: 20 }), '2026-11-15')).toBe('2026-11-20');
    expect(spanEnd(duration({ unit: 'TO_DAY', day: 10 }), '2026-12-15')).toBe('2027-01-10');
  });

  it('to the 31st: the last day of a shorter month', () => {
    expect(spanEnd(duration({ unit: 'TO_DAY', day: 31 }), '2026-02-10')).toBe('2026-02-28');
  });

  it('to a day of a month of the year: this year, or the next one when it comes before', () => {
    expect(spanEnd(duration({ unit: 'TO_DAY', day: 5, month: 1 }), '2026-11-15')).toBe('2027-01-05');
    expect(spanEnd(duration({ unit: 'TO_DAY', day: 5, month: 12 }), '2026-11-15')).toBe('2026-12-05');
  });

  it('to an ISO week: its Sunday, in the next ISO year when it comes before', () => {
    expect(spanEnd(duration({ unit: 'TO_WEEK', week: 53 }), '2026-12-01')).toBe('2027-01-03');
    expect(spanEnd(duration({ unit: 'TO_WEEK', week: 2 }), '2026-12-30')).toBe('2027-01-17');
  });

  it('to a month: its last day, next year when it comes before', () => {
    expect(spanEnd(duration({ unit: 'TO_MONTH', month: 2 }), '2026-11-15')).toBe('2027-02-28');
    expect(spanEnd(duration({ unit: 'TO_MONTH' }), '2026-11-15')).toBe('2026-11-30');
  });
});

describe('crossedWeeks / weeksChange', () => {
  it('weeks crossed: past Sunday the next one, before Monday the previous one', () => {
    expect(crossedWeeks(1, 3)).toBe(0);
    expect(crossedWeeks(5, 3)).toBe(1);
    expect(crossedWeeks(7, 1)).toBe(1);
    expect(crossedWeeks(1, -1)).toBe(-1);
    expect(crossedWeeks(1, 7)).toBe(1);
    expect(crossedWeeks(3, -9)).toBe(-1);
    expect(crossedWeeks(3, -10)).toBe(-2);
  });

  it('even / odd weeks change on an odd number of weeks; every n weeks on a number that is not a multiple of n', () => {
    expect(weeksChange(rule({ weekParity: 'EVEN' }), 1)).toBe(true);
    expect(weeksChange(rule({ weekParity: 'EVEN' }), -2)).toBe(false);
    expect(weeksChange(rule({ interval: 3 }), 3)).toBe(false);
    expect(weeksChange(rule({ interval: 3 }), -1)).toBe(true);
    expect(weeksChange(rule({}), 1)).toBe(false);
    expect(weeksChange(rule({ frequency: 'DAILY', interval: 2 }), 1)).toBe(false);
  });
});

describe('ruleMovedTo', () => {
  it('takes the monthly and yearly values of the new day', () => {
    expect(ruleMovedTo(rule({ frequency: 'MONTHLY' }), '2026-11-10')).toMatchObject({ monthDay: 10, weekday: 2, position: 2, month: 11, week: 46 });
  });

  it('a 5th weekday becomes « the last »; a last 4th stays 4th unless it was last before', () => {
    expect(ruleMovedTo(rule({ frequency: 'MONTHLY' }), '2026-12-29').position).toBe(-1);
    expect(ruleMovedTo(rule({ frequency: 'MONTHLY', position: 2 }), '2026-11-24').position).toBe(4);
    expect(ruleMovedTo(rule({ frequency: 'MONTHLY', position: -1 }), '2026-11-24').position).toBe(-1);
  });
});

describe('movedWeekdays', () => {
  it('turns the weekdays and swaps even / odd weeks when they change week an odd number of times', () => {
    const moved = movedWeekdays(rule({ weekdays: [5], weekParity: 'EVEN' }), null, [5], 3);
    expect(moved).toEqual({ rule: expect.objectContaining({ weekdays: [1], weekParity: 'ODD' }), anchor: null });
  });

  it('keeps the parity within the same week', () => {
    expect(movedWeekdays(rule({ weekdays: [1], weekParity: 'EVEN' }), null, [1], 3).rule).toMatchObject({ weekdays: [4], weekParity: 'EVEN' });
  });

  it('keeps the parity over two weeks', () => {
    expect(movedWeekdays(rule({ weekdays: [1], weekParity: 'ODD' }), null, [1], 14).rule.weekParity).toBe('ODD');
  });

  it('every n weeks: the anchor becomes the first of those weekdays on the rhythm, moved', () => {
    const moved = movedWeekdays(rule({ weekdays: [1, 5], interval: 2 }), '2026-11-02', [5], 3);
    expect(moved.rule.weekdays).toEqual([1]);
    expect(moved.anchor).toBe('2026-11-09');
  });

  it('a rule without weekdays keeps none (the weekday comes from its first date)', () => {
    expect(movedWeekdays(rule({ interval: 2 }), '2026-11-04', [3], 2)).toEqual({ rule: expect.objectContaining({ weekdays: [] }), anchor: '2026-11-06' });
  });

  it('moving earlier turns the weekdays back, past Monday to the previous week', () => {
    expect(movedWeekdays(rule({ weekdays: [1], weekParity: 'EVEN' }), null, [1], -1).rule).toMatchObject({ weekdays: [7], weekParity: 'ODD' });
  });
});

describe('shiftedRulePieces', () => {
  it('no move: the rule unchanged', () => {
    expect(shiftedRulePieces(MON_FRI_2W, '2026-11-02', 0, '2026-11-02')).toEqual([{ rule: MON_FRI_2W, anchor: null }]);
  });

  it('daily: end, exclusions and pauses moved, one piece', () => {
    const daily = rule({ frequency: 'DAILY', interval: 2, until: '2026-11-30', exceptions: ['2026-11-10'], pauses: [{ from: '2026-11-20', to: '2026-11-21' }] });
    expect(shiftedRulePieces(daily, null, 2, '2026-11-02')).toEqual([
      { rule: { ...daily, until: '2026-12-02', exceptions: ['2026-11-12'], pauses: [{ from: '2026-11-22', to: '2026-11-23' }] }, anchor: null },
    ]);
  });

  it('every week: one piece, weekdays turned (even when some change week)', () => {
    const [piece, ...others] = shiftedRulePieces(rule({ weekdays: [1, 5] }), null, 3, '2026-11-02');
    expect(others).toEqual([]);
    expect(piece.rule.weekdays).toEqual([1, 4]);
  });

  it('monthly: the values of the first occurrence, moved', () => {
    const [piece] = shiftedRulePieces(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }), '2026-01-15', 3, '2026-01-15');
    expect(piece.rule.monthDay).toBe(18);
  });

  it('every n weeks, all weekdays in the same week: one piece', () => {
    expect(shiftedRulePieces(MON_FRI_2W, '2026-11-02', 1, '2026-11-02')).toHaveLength(1);
  });

  it('mixed shift: two pieces, each on its own weekdays and anchor; the count becomes the day of the last occurrence, moved', () => {
    const pieces = shiftedRulePieces(MON_FRI_2W, '2026-11-02', 3, '2026-11-02');
    expect(pieces).toEqual([
      { rule: expect.objectContaining({ weekdays: [4], count: null, until: '2026-12-07' }), anchor: '2026-11-05' },
      { rule: expect.objectContaining({ weekdays: [1], count: null, until: '2026-12-07' }), anchor: '2026-11-09' },
    ]);
  });

  it('mixed shift on even / odd weeks: only the piece changing week swaps its parity', () => {
    const pieces = shiftedRulePieces(rule({ weekdays: [1, 5], weekParity: 'EVEN' }), null, 3, '2026-11-09');
    expect(pieces.map((piece) => [piece.rule.weekdays, piece.rule.weekParity])).toEqual([
      [[4], 'EVEN'],
      [[1], 'ODD'],
    ]);
  });
});

describe('shiftedSeries', () => {
  it('mixed shift: Mon + Fri every 2 weeks, 6 occurrences, +3 days → Thursdays 11-05, 11-19, 12-03 and Mondays 11-09, 11-23, 12-07', () => {
    const series = shiftedSeries(MON_FRI_2W, '2026-11-02', 3);
    expect(series.map((item) => [item.start, item.rule.weekdays])).toEqual([
      ['2026-11-05', [4]],
      ['2026-11-09', [1]],
    ]);
    expect(allDates(series[0].rule, series[0].start)).toEqual(['2026-11-05', '2026-11-19', '2026-12-03']);
    expect(allDates(series[1].rule, series[1].start)).toEqual(['2026-11-09', '2026-11-23', '2026-12-07']);
  });

  it('every occurrence moves by the same days: none lost, none added', () => {
    expect(datesOf(shiftedSeries(MON_FRI_2W, '2026-11-02', 3))).toEqual(MON_FRI_2W_DATES.map((date) => addDays(date, 3)));
    expect(datesOf(shiftedSeries(MON_FRI_2W, '2026-11-02', -2))).toEqual(MON_FRI_2W_DATES.map((date) => addDays(date, -2)));
  });

  it('even / odd weeks moved within a year: the same occurrences, moved', () => {
    const even = rule({ weekdays: [1, 5], weekParity: 'EVEN', until: '2026-12-20' });
    expect(datesOf(shiftedSeries(even, '2026-11-09', 3))).toEqual(allDates(even, '2026-11-09').map((date) => addDays(date, 3)));
  });

  // Code ≠ docs (« aucune occurrence n'est perdue »): weeks 53 and 1 are both odd, so swapping the parity of the days
  // that change week loses Friday 2027-01-01 (week 53), moved to Monday 2027-01-04 (week 1, odd, not even).
  it.fails('even / odd weeks moved across a year with week 53: the same occurrences, moved', () => {
    const odd = rule({ weekdays: [1, 5], weekParity: 'ODD', until: '2027-01-31' });
    expect(datesOf(shiftedSeries(odd, '2026-12-14', 3))).toEqual(allDates(odd, '2026-12-14').map((date) => addDays(date, 3)));
  });

  it('every week: one series from the first day moved', () => {
    const series = shiftedSeries(rule({ weekdays: [1, 5], count: 4 }), '2026-11-02', 3);
    expect(series).toHaveLength(1);
    expect(allDates(series[0].rule, series[0].start)).toEqual(['2026-11-05', '2026-11-09', '2026-11-12', '2026-11-16']);
  });

  it('a series with an end date keeps the same occurrences, moved', () => {
    const until = rule({ weekdays: [1, 5], interval: 2, until: '2026-12-04' });
    expect(datesOf(shiftedSeries(until, '2026-11-02', 3))).toEqual(MON_FRI_2W_DATES.map((date) => addDays(date, 3)));
  });

  it('a piece that would start after the end of the series has no occurrence', () => {
    // One occurrence (Monday 11-02): its Fridays, moved to Mondays, would start on 11-09, after the new end (11-05).
    const series = shiftedSeries(rule({ weekdays: [1, 5], interval: 2, count: 1 }), '2026-11-02', 3);
    expect(series.map((item) => item.start)).toEqual(['2026-11-05', '2026-11-09']);
    expect(series[1].rule.until).toBe('2026-11-05');
    expect(datesOf(series)).toEqual(['2026-11-05']);
  });

  it('monthly « le 15 » moved by 3 days: « le 18 »', () => {
    const [series] = shiftedSeries(rule({ frequency: 'MONTHLY', monthlyMode: 'DAY', count: 3 }), '2026-01-15', 3);
    expect(allDates(series.rule, series.start)).toEqual(['2026-01-18', '2026-02-18', '2026-03-18']);
  });

  it('monthly « 2e mardi » moved by a day: « 2e mercredi »', () => {
    const [series] = shiftedSeries(rule({ frequency: 'MONTHLY', monthlyMode: 'WEEKDAY', count: 2 }), '2026-11-10', 1);
    expect(allDates(series.rule, series.start)).toEqual(['2026-11-11', '2026-12-09']);
  });

  it('a weekly series starting off its weekdays moves from its first occurrence’s weekday', () => {
    // Every week, no weekdays, first date a Wednesday: moved by 2 days, on Fridays.
    const [series] = shiftedSeries(rule({ count: 2 }), '2026-11-04', 2);
    expect(allDates(series.rule, series.start)).toEqual(['2026-11-06', '2026-11-13']);
  });
});

describe('cutSeries (« Celle-ci et les suivantes »)', () => {
  it('a number of occurrences left unchanged is reduced by those before the cut', () => {
    const [series] = cutSeries(MON_FRI_2W, MON_FRI_2W, '2026-11-02', '2026-11-16', 0);
    expect(series.start).toBe('2026-11-16');
    expect(series.rule.count).toBe(4);
    expect(allDates(series.rule, series.start)).toEqual(MON_FRI_2W_DATES.slice(2));
  });

  it('at least one occurrence remains', () => {
    const [series] = cutSeries(MON_FRI_2W, MON_FRI_2W, '2026-11-02', '2027-02-01', 0);
    expect(series.rule.count).toBe(1);
  });

  it('a number of occurrences changed is kept as given', () => {
    const [series] = cutSeries({ ...MON_FRI_2W, count: 10 }, MON_FRI_2W, '2026-11-02', '2026-11-16', 0);
    expect(series.rule.count).toBe(10);
  });

  it('mixed shift after the cut: one series per group of weekdays, the following occurrences moved', () => {
    const series = cutSeries(MON_FRI_2W, MON_FRI_2W, '2026-11-02', '2026-11-16', 3);
    expect(series.map((item) => item.start)).toEqual(['2026-11-19', '2026-11-23']);
    expect(datesOf(series)).toEqual(MON_FRI_2W_DATES.slice(2).map((date) => addDays(date, 3)));
  });
});

describe('seriesOn', () => {
  const series = shiftedSeries(MON_FRI_2W, '2026-11-02', 3);

  it('the series of the weekday of the day', () => {
    expect(seriesOn(series, '2026-11-23').start).toBe('2026-11-09');
    expect(seriesOn(series, '2026-11-19').start).toBe('2026-11-05');
  });

  it('the first one when none holds the weekday', () => {
    expect(weekdayOfDate('2026-11-18')).toBe(3);
    expect(seriesOn(series, '2026-11-18')).toBe(series[0]);
  });
});
