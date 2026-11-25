import { describe, expect, it } from 'vitest';
import { isTaskOverdue, taskDayReasons, taskPlacement, type DayTask } from '../../src/tasks/task-day';

const TODAY = '2026-11-25';

/**
 * Open task for a test, without dates nor status, with some fields changed.
 * @param {Partial<DayTask>} fields Fields changed.
 * @returns {DayTask} Task.
 */
const task = (fields: Partial<DayTask> = {}): DayTask => ({ startDate: null, endDate: null, effectiveMinDate: null, effectiveDeadline: null, statusCategory: null, closedAt: null, ...fields });

describe('isTaskOverdue', () => {
  it('the « Échéance » it goes by strictly before today, and not closed', () => {
    expect(isTaskOverdue({ effectiveDeadline: '2026-11-24' }, TODAY)).toBe(true);
    expect(isTaskOverdue({ effectiveDeadline: TODAY }, TODAY)).toBe(false);
    expect(isTaskOverdue({ effectiveDeadline: '2026-11-24', closed: true }, TODAY)).toBe(false);
    expect(isTaskOverdue({ effectiveDeadline: null }, TODAY)).toBe(false);
  });
});

describe('taskPlacement', () => {
  it('a start without end in the past goes on up to today; late shows today', () => {
    expect(taskPlacement({ startDate: '2026-11-20', endDate: null, effectiveDeadline: null }, TODAY).span).toEqual({ start: '2026-11-20', end: TODAY, kind: 'open' });
    expect(taskPlacement({ startDate: null, endDate: null, effectiveDeadline: '2026-11-20' }, TODAY)).toEqual({ span: null, deadline: TODAY, overdue: true });
  });
});

describe('taskDayReasons: why a task shows on a day of « Ma journée »', () => {
  it('late on today only', () => {
    expect(taskDayReasons(task({ effectiveDeadline: '2026-11-20' }), TODAY, TODAY)).toEqual(['late']);
    expect(taskDayReasons(task({ effectiveDeadline: '2026-11-20' }), '2026-11-26', TODAY)).toEqual([]);
    expect(taskDayReasons(task({ effectiveDeadline: '2026-11-20' }), '2026-11-20', TODAY)).toEqual(['due']);
  });

  it('due the day of the « Échéance » it goes by; open over « Ouverture » – « Échéance »', () => {
    const open = task({ effectiveMinDate: '2026-11-24', effectiveDeadline: '2026-11-27' });
    expect(taskDayReasons(open, '2026-11-23', TODAY)).toEqual([]);
    expect(taskDayReasons(open, TODAY, TODAY)).toEqual(['open']);
    expect(taskDayReasons(open, '2026-11-27', TODAY)).toEqual(['due', 'open']);
    // An « Ouverture » alone opens no period.
    expect(taskDayReasons(task({ effectiveMinDate: '2026-11-01' }), TODAY, TODAY)).toEqual([]);
  });

  it('in progress by the category of its status', () => {
    expect(taskDayReasons(task({ statusCategory: 'IN_PROGRESS' }), TODAY, TODAY)).toEqual(['inProgress']);
    // Never a day to come; a past day only with one of its times that day, in Paris.
    expect(taskDayReasons(task({ statusCategory: 'IN_PROGRESS' }), '2026-11-26', TODAY)).toEqual([]);
    const time = { startedAt: '2026-11-23T23:30:00.000Z', endedAt: '2026-11-24T00:30:00.000Z', pausedAt: null, pausedSeconds: 0, duration: 3600 };
    const worked = task({ statusCategory: 'IN_PROGRESS', times: [time] });
    expect(taskDayReasons(worked, '2026-11-24', TODAY)).toEqual(['inProgress']);
    expect(taskDayReasons(worked, '2026-11-23', TODAY)).toEqual([]);
    expect(taskDayReasons({ ...worked, statusCategory: 'TODO' }, '2026-11-24', TODAY)).toEqual([]);
    // A timer still running since yesterday evening: yesterday too.
    const running = { ...time, startedAt: '2026-11-24T20:00:00.000Z', endedAt: null, duration: null };
    expect(taskDayReasons(task({ statusCategory: 'IN_PROGRESS', times: [running] }), '2026-11-24', TODAY, Date.parse('2026-11-25T08:00:00.000Z'))).toEqual(['inProgress']);
    expect(taskDayReasons(task({ statusCategory: 'TODO' }), TODAY, TODAY)).toEqual([]);
  });

  it('planned on the days its dates place it in the calendar', () => {
    const dates = task({ startDate: '2026-11-24', endDate: '2026-11-26' });
    expect(taskDayReasons(dates, TODAY, TODAY)).toEqual(['planned']);
    expect(taskDayReasons(dates, '2026-11-27', TODAY)).toEqual([]);
    const goesOn = task({ startDate: '2026-11-10' });
    expect(taskDayReasons(goesOn, TODAY, TODAY)).toEqual(['planned']);
    expect(taskDayReasons(goesOn, '2026-11-26', TODAY)).toEqual([]);
  });

  it('a closed task only the day it was closed, in Paris, whatever its dates', () => {
    const closed = task({ effectiveDeadline: TODAY, statusCategory: 'IN_PROGRESS', closedAt: '2026-11-24T23:30:00Z' });
    // 00:30 in Paris on the 25th.
    expect(taskDayReasons(closed, TODAY, TODAY)).toEqual(['done']);
    expect(taskDayReasons(closed, '2026-11-24', TODAY)).toEqual([]);
    expect(taskDayReasons({ ...closed, cancelled: true }, TODAY, TODAY)).toEqual(['cancelled']);
    expect(taskDayReasons({ ...closed, closedAt: new Date('2026-11-25T22:59:00Z') }, TODAY, TODAY)).toEqual(['done']);
    expect(taskDayReasons({ ...closed, closedAt: new Date('2026-11-25T23:00:00Z') }, TODAY, TODAY)).toEqual([]);
  });

  it('the Paris day of the closing around the changes of time', () => {
    // 2026-03-29: 02:00 becomes 03:00 (UTC+2 after); 2026-10-25: 03:00 becomes 02:00 (UTC+1 after).
    const closedAt = (instant: string) => task({ closedAt: instant });
    expect(taskDayReasons(closedAt('2026-03-28T23:00:00Z'), '2026-03-29', '2026-03-30')).toEqual(['done']);
    expect(taskDayReasons(closedAt('2026-03-29T21:59:00Z'), '2026-03-29', '2026-03-30')).toEqual(['done']);
    expect(taskDayReasons(closedAt('2026-03-29T22:00:00Z'), '2026-03-30', '2026-03-30')).toEqual(['done']);
    expect(taskDayReasons(closedAt('2026-10-24T22:00:00Z'), '2026-10-25', '2026-10-26')).toEqual(['done']);
    expect(taskDayReasons(closedAt('2026-10-25T22:59:00Z'), '2026-10-25', '2026-10-26')).toEqual(['done']);
    expect(taskDayReasons(closedAt('2026-10-25T23:00:00Z'), '2026-10-26', '2026-10-26')).toEqual(['done']);
  });
});
