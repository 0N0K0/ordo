import { describe, expect, it } from 'vitest';
import { periodMondays, ruleOnlySchedule, typicalWeekName, typicalWeeks, typicalWeeksRefusal } from '../../src/calendar/typical-weeks';
import { schedule, scheduleCase } from './schedules';

/** Every Monday, 09:00–12:00, from 2026-11-02. */
const everyMonday = schedule([scheduleCase({ weekdays: [1] })], { id: 'every' });

/**
 * Names and weeks of the typical weeks of a period, in short.
 * @param {ReturnType<typeof typicalWeeks>} weeks Typical weeks.
 * @returns {{ name: string, weeks: string[] }[]} Names and Mondays.
 */
const short = (weeks: ReturnType<typeof typicalWeeks>) => weeks.map(({ name, weeks: mondays }) => ({ name, weeks: mondays }));

describe('periodMondays', () => {
  it('gives the Mondays of the whole weeks a period overlaps', () => {
    expect(periodMondays('2026-11-04', '2026-11-16')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(periodMondays('2026-11-16', '2026-11-02')).toEqual([]);
    expect(periodMondays('2026-11-18', '2026-11-17')).toEqual([]);
  });
});

describe('typicalWeeks', () => {
  it('makes one typical week of weeks with the same slots: « Toutes les semaines »', () => {
    const weeks = typicalWeeks([everyMonday], '2026-11-02', '2026-11-29');
    expect(short(weeks)).toEqual([{ name: 'Toutes les semaines', weeks: ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'] }]);
    expect(weeks[0].slots).toEqual([{ date: '2026-11-02', start: '09:00', end: '12:00', allDay: false, scheduleId: 'every' }]);
  });

  it('names the even and the odd weeks, across a week 53 (odd, as week 1)', () => {
    const odd = schedule([scheduleCase({ weekdays: [2], weekParity: 'ODD' })], { id: 'odd' });
    // Weeks 51, 52, 53, 1, 2.
    expect(short(typicalWeeks([everyMonday, odd], '2026-12-14', '2027-01-17'))).toEqual([
      { name: 'Semaines impaires', weeks: ['2026-12-14', '2026-12-28', '2027-01-04'] },
      { name: 'Semaines paires', weeks: ['2026-12-21', '2027-01-11'] },
    ]);
  });

  it('names one week out of n up to the end of the period, else lists the week numbers', () => {
    const everyMondayOf2026 = schedule([scheduleCase({ weekdays: [1] })], { id: 'every', startDate: '2025-12-01' });
    const third = schedule([scheduleCase({ weekdays: [3], interval: 3 })], { id: 'third', startDate: '2026-01-05' });
    expect(short(typicalWeeks([everyMondayOf2026, third], '2026-01-01', '2026-02-28'))).toEqual([
      { name: 'Sem. 1, 3, 4, 6, 7, 9', weeks: ['2025-12-29', '2026-01-12', '2026-01-19', '2026-02-02', '2026-02-09', '2026-02-23'] },
      { name: '1 semaine sur 3, à partir du 05/01', weeks: ['2026-01-05', '2026-01-26', '2026-02-16'] },
    ]);
  });

  it('leaves out the weeks without slots, and names every week from the first one that has some', () => {
    const later = schedule([scheduleCase({ weekdays: [1] })], { startDate: '2026-11-16' });
    expect(short(typicalWeeks([later], '2026-11-02', '2026-11-29'))).toEqual([{ name: 'Toutes les semaines, à partir du 16/11', weeks: ['2026-11-16', '2026-11-23'] }]);
  });

  it('counts the rules only: neither the days changed or paused, nor the days deleted, nor what does not repeat', () => {
    const changed = schedule([scheduleCase({ weekdays: [1], exceptions: ['2026-11-09'], pauses: [{ from: '2026-11-23', to: '2026-11-29' }] })], {
      exceptions: [
        { from: '2026-11-16', to: '2026-11-16', label: '', cases: [] },
        { from: '2026-11-24', to: '2026-11-24', label: '', cases: [scheduleCase({ frequency: 'DAILY' })] },
      ],
    });
    expect(short(typicalWeeks([changed], '2026-11-02', '2026-11-29'))).toEqual([{ name: 'Toutes les semaines', weeks: ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'] }]);
    const once = schedule([scheduleCase({}, { rule: null })]);
    expect(ruleOnlySchedule(once)).toBeNull();
    expect(typicalWeeks([once], '2026-11-02', '2026-11-29')).toEqual([]);
  });

  it('keeps the end of a rule limited to a number of occurrences where its days deleted and paused put it', () => {
    // 3 Mondays counted without the 9th nor the 16th (paused): the 2nd, the 23rd and the 30th; the 9th and the 16th given back.
    const counted = schedule([scheduleCase({ weekdays: [1], count: 3, exceptions: ['2026-11-09'], pauses: [{ from: '2026-11-16', to: '2026-11-16' }] })]);
    expect(short(typicalWeeks([counted], '2026-11-02', '2026-12-13'))).toEqual([{ name: 'Sem. 45, 46, 47, 48, 49', weeks: ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'] }]);
  });

  it('counts the occurrences of a rule from the first day of its case', () => {
    // From the 2nd (its case), the 9th deleted: the 2nd and the 16th, the 9th given back.
    const since = schedule([scheduleCase({ weekdays: [1], count: 2, exceptions: ['2026-11-09'] }, { since: '2026-11-02' })], { startDate: '2026-10-05' });
    expect(short(typicalWeeks([since], '2026-11-02', '2026-11-29'))).toEqual([{ name: 'Sem. 45, 46, 47', weeks: ['2026-11-02', '2026-11-09', '2026-11-16'] }]);
  });

  it('names a typical week of a single week by its number, never by its parity nor « Toutes les semaines »', () => {
    const odd = schedule([scheduleCase({ weekdays: [2], weekParity: 'ODD' })], { id: 'odd' });
    expect(short(typicalWeeks([everyMonday, odd], '2026-11-02', '2026-11-15'))).toEqual([
      { name: 'Sem. 45', weeks: ['2026-11-02'] },
      { name: 'Sem. 46', weeks: ['2026-11-09'] },
    ]);
    expect(short(typicalWeeks([everyMonday], '2026-11-02', '2026-11-08'))).toEqual([{ name: 'Sem. 45', weeks: ['2026-11-02'] }]);
  });
});

describe('typicalWeekName', () => {
  it('adds its ISO year to a week number the period has twice', () => {
    const period = { from: '2026-01-05', to: '2027-01-11' };
    expect(typicalWeekName(['2026-01-12', '2026-02-16', '2027-01-11'], periodMondays(period.from, period.to), period)).toBe('Sem. 3, 8, 2 (2027)');
  });

  it('adds the year to the first day of one week out of n when the period covers two calendar years or more', () => {
    const weeks = ['2026-01-05', '2026-01-26', '2026-02-16'];
    const over = { from: '2025-12-15', to: '2026-02-28' };
    expect(typicalWeekName(weeks, periodMondays(over.from, over.to), over)).toBe('1 semaine sur 3, à partir du 05/01/2026');
    const within = { from: '2026-01-05', to: '2026-02-28' };
    expect(typicalWeekName(weeks, periodMondays(within.from, within.to), within)).toBe('1 semaine sur 3, à partir du 05/01');
    // The first Monday of the weeks of the period, in the year before it.
    const before = { from: '2026-01-01', to: '2026-03-31' };
    expect(typicalWeekName(['2025-12-29', '2026-01-19', '2026-02-09', '2026-03-02', '2026-03-23'], periodMondays(before.from, before.to), before)).toBe('1 semaine sur 3, à partir du 29/12/2025');
  });
});

describe('typicalWeeksRefusal', () => {
  it('says how many typical weeks the period has, and the most a document shows', () => {
    expect(typicalWeeksRefusal(9)).toBe('9 semaines différentes sur cette période : réduisez la période ou filtrez les créneaux et éphémérides (6 au plus).');
  });
});
