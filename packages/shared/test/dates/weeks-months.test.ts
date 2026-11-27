import { describe, expect, it } from 'vitest';
import { readWeek, weekLength, weekRange, weekStartOf } from '../../src/dates/weeks';
import { dayInMonth, shiftMonth } from '../../src/dates/months';
import { isoWeek } from '../../src/dates/days';
import { HOURS_START_REQUIRED, taskHoursSchema } from '../../src/tasks/task-hours';
import { scheduleCase } from '../calendar/schedules';

describe('week of the workspace', () => {
  it('Monday to Sunday by default; the latest start on or before the day', () => {
    expect(weekRange('2026-11-25')).toEqual(['2026-11-23', '2026-11-30']);
    expect(weekStartOf('2026-11-25', { start: 6, end: 5 })).toBe('2026-11-21');
    expect(weekStartOf('2026-11-25', undefined, -1)).toBe('2026-11-16');
  });

  it('the same day twice gives weeks of 8 days, sharing that day (it belongs to the week it starts)', () => {
    const wednesday = { start: 3, end: 3 };
    expect(weekLength(wednesday)).toBe(8);
    expect(weekRange('2026-11-25', wednesday)).toEqual(['2026-11-25', '2026-12-03']);
  });

  it('a short week (Monday to Friday) leaves days out', () => {
    expect(weekLength({ start: 1, end: 5 })).toBe(5);
    expect(weekRange('2026-11-25', { start: 1, end: 5 })).toEqual(['2026-11-23', '2026-11-28']);
  });

  it('invalid stored days: Monday to Sunday', () => {
    expect(readWeek({ weekStart: 0, weekEnd: 9 })).toEqual({ start: 1, end: 7 });
    expect(readWeek({ weekStart: 6, weekEnd: 5 })).toEqual({ start: 6, end: 5 });
  });

  it('week numbers are ISO: the week of 4 January is the first', () => {
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(isoWeek('2027-01-03')).toBe(53);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2021-01-03')).toBe(53);
  });
});

describe('months', () => {
  it('a day missing from a month is its last day', () => {
    expect(dayInMonth(2026, 2, 31)).toBe('2026-02-28');
    expect(dayInMonth(2028, 2, 30)).toBe('2028-02-29');
    expect(dayInMonth(2026, 4, 0)).toBe('2026-04-01');
  });

  it('shiftMonth gives the first day of the month, across years', () => {
    expect(shiftMonth('2026-11-30', 3)).toBe('2027-02-01');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
  });
});

describe('« Horaires » of a task', () => {
  it('a case whose rhythm counts from a day needs its « Début »', () => {
    const everyTwo = scheduleCase({ weekdays: [1], interval: 2 });
    expect(taskHoursSchema.safeParse([everyTwo]).error?.issues[0]).toMatchObject({ message: HOURS_START_REQUIRED, path: [0, 'start'] });
    expect(taskHoursSchema.safeParse([{ ...everyTwo, start: '2026-11-02' }]).success).toBe(true);
    expect(taskHoursSchema.safeParse([scheduleCase({ weekdays: [1], weekParity: 'EVEN' })]).success).toBe(true);
  });

  it('20 cases at most, as a créneau', () => {
    expect(taskHoursSchema.safeParse(Array(21).fill(scheduleCase({ weekdays: [1] }))).error?.issues[0].message).toBe('20 cas au plus.');
  });
});
