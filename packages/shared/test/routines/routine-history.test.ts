import { describe, expect, it } from 'vitest';
import { inRoutineHistoryOn, routineTickPrefill } from '../../src/routines/routine-history';

/** 25 Nov 2026, 14:30 in Paris (UTC+1 in winter). */
const NOW = new Date('2026-11-25T13:30:00Z');

describe('routineTickPrefill', () => {
  it('proposes now while its scheduled time is still to come', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: '18:00' }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes its scheduled time (« jusqu’à », else « dès ») once past', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: '07:00', dueTime: '09:00' }, NOW)).toEqual({ day: '2026-11-25', time: '09:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: '07:00', dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '07:00' });
  });

  it('proposes now without any time', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes the due day at its time when late, now without time', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-20', fromTime: null, dueTime: '08:00' }, NOW)).toEqual({ day: '2026-11-20', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-20', fromTime: null, dueTime: null }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes now for an occurrence open and due later', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '08:00' }, NOW)).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('proposes the day it is ticked from: its scheduled time, else the time of now', () => {
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '08:00' }, NOW, '2026-11-05')).toEqual({ day: '2026-11-05', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: null }, NOW, '2026-11-05')).toEqual({ day: '2026-11-05', time: '14:30' });
    expect(routineTickPrefill({ dueDate: '2026-11-28', fromTime: null, dueTime: '18:00' }, NOW, '2026-11-25')).toEqual({ day: '2026-11-25', time: '14:30' });
  });

  it('reads the day and the time in Paris, whatever the zone of the instant', () => {
    // 23:30 UTC on 24 Nov is already 25 Nov, 00:30 in Paris.
    const lateNight = new Date('2026-11-24T23:30:00Z');
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: null }, lateNight)).toEqual({ day: '2026-11-25', time: '00:30' });
    // « jusqu’à 00:15 » on 25 Nov in Paris is 24 Nov, 23:15 UTC: past.
    expect(routineTickPrefill({ dueDate: '2026-11-25', fromTime: null, dueTime: '00:15' }, lateNight)).toEqual({ day: '2026-11-25', time: '00:15' });
    // Summer time (UTC+2): 08:00 in Paris is 06:00 UTC.
    expect(routineTickPrefill({ dueDate: '2026-07-01', fromTime: null, dueTime: '08:00' }, new Date('2026-07-01T06:30:00Z'))).toEqual({ day: '2026-07-01', time: '08:00' });
    expect(routineTickPrefill({ dueDate: '2026-07-01', fromTime: null, dueTime: '09:00' }, new Date('2026-07-01T06:30:00Z'))).toEqual({ day: '2026-07-01', time: '08:30' });
  });
});

describe('inRoutineHistoryOn', () => {
  const open = { startDate: '2026-11-01', dueDate: '2026-11-28' };

  it('shows a done time of the day on the day it was done, not on its due day', () => {
    const doneAt = '2026-11-05T09:00:00Z';
    expect(inRoutineHistoryOn(open, doneAt, '2026-11-05')).toBe(true);
    expect(inRoutineHistoryOn(open, doneAt, '2026-11-28')).toBe(false);
    expect(inRoutineHistoryOn(open, doneAt, '2026-11-01')).toBe(false);
  });

  it('shows a done time of the day on the day it was done even out of its opening (late)', () => {
    expect(inRoutineHistoryOn({ startDate: '2026-11-20', dueDate: '2026-11-20' }, new Date('2026-11-22T10:00:00Z'), '2026-11-22')).toBe(true);
  });

  it('shows one not done on each day of its opening, up to its due day', () => {
    expect(inRoutineHistoryOn(open, null, '2026-10-31')).toBe(false);
    expect(inRoutineHistoryOn(open, null, '2026-11-01')).toBe(true);
    expect(inRoutineHistoryOn(open, null, '2026-11-15')).toBe(true);
    expect(inRoutineHistoryOn(open, null, '2026-11-28')).toBe(true);
    expect(inRoutineHistoryOn(open, null, '2026-11-29')).toBe(false);
  });

  it('reads the day it was done in Paris', () => {
    // 23:30 UTC on 4 Nov is 5 Nov, 00:30 in Paris.
    expect(inRoutineHistoryOn(open, '2026-11-04T23:30:00Z', '2026-11-05')).toBe(true);
    expect(inRoutineHistoryOn(open, '2026-11-04T23:30:00Z', '2026-11-04')).toBe(false);
  });

  it('never shows a cancelled occurrence', () => {
    expect(inRoutineHistoryOn({ ...open, cancelled: true }, null, '2026-11-05')).toBe(false);
    expect(inRoutineHistoryOn({ ...open, cancelled: true }, '2026-11-05T09:00:00Z', '2026-11-05')).toBe(false);
  });
});
