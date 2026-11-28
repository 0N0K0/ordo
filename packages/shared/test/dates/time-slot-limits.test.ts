import { describe, expect, it } from 'vitest';
import { durationParts, endDayText, timeSlotDuration, timeSlotEnd } from '../../src/dates/time-slot';
import { casesKeepLimits, lastsWeeksOrMonths, lengthLimits, limitsError, newLimitBreak, repetitionLimitError, repetitionLimits } from '../../src/dates/repetition-limits';
import { DEFAULT_RECURRENCE, ONE_DAY, type Duration, type Recurrence } from '../../src/dates/recurrence';

/**
 * Rule changed by some fields.
 * @param {Partial<Recurrence>} fields Fields.
 * @returns {Recurrence} Rule.
 */
const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

/**
 * Duration of a unit and a count.
 * @param {Duration['unit']} unit Unit.
 * @param {number} count Count.
 * @returns {Duration} Duration.
 */
const lasting = (unit: Duration['unit'], count: number): Duration => ({ ...ONE_DAY, unit, count });

describe('time slot: duration and end recompute each other, no 24 h limit', () => {
  it('end from the duration, past midnight', () => {
    expect(timeSlotEnd('22:00', 180)).toEqual({ time: '01:00', days: 1 });
    expect(timeSlotEnd('08:30', 2 * 1440 + 210)).toEqual({ time: '12:00', days: 2 });
    expect(timeSlotEnd('09:00', 480)).toEqual({ time: '17:00', days: 0 });
  });
  it('duration from the end; an end before the start on its day moves to the next day', () => {
    expect(timeSlotDuration('09:00', { time: '17:00', days: 0 })).toEqual({ minutes: 480, days: 0 });
    expect(timeSlotDuration('22:00', { time: '01:00', days: 0 })).toEqual({ minutes: 180, days: 1 });
    expect(timeSlotDuration('08:30', { time: '12:00', days: 2 })).toEqual({ minutes: 2 * 1440 + 210, days: 2 });
  });
  it('parts and words', () => {
    expect(durationParts(1440 + 95)).toEqual({ days: 1, hours: 1, minutes: 35 });
    expect([0, 1, 2].map(endDayText)).toEqual(['le jour même', 'le lendemain', 'J+2']);
  });
});

describe('repetition limited by the duration: the next occurrence after the end of the previous one', () => {
  it('a single day: no limit', () => {
    expect(repetitionLimits(ONE_DAY)).toBeNull();
    expect(repetitionLimitError(rule({ frequency: 'DAILY' }), ONE_DAY)).toBeNull();
  });
  it('in days: every N days with N strictly more (5 days: from every 6 days)', () => {
    expect(repetitionLimitError(rule({ frequency: 'DAILY', interval: 5 }), lasting('DAYS', 5))?.field).toBe('interval');
    expect(repetitionLimitError(rule({ frequency: 'DAILY', interval: 6 }), lasting('DAYS', 5))).toBeNull();
    expect(repetitionLimits(lasting('DAYS', 7))?.minInterval.WEEKLY).toBe(2);
  });
  it('in days: weekdays more days apart', () => {
    expect(repetitionLimitError(rule({ weekdays: [1, 3] }), lasting('DAYS', 2))?.field).toBe('weekdays');
    expect(repetitionLimitError(rule({ weekdays: [1, 4] }), lasting('DAYS', 2))).toBeNull();
  });
  it('hours over a day: strictly beyond them', () => {
    expect(lengthLimits('DAYS', 26 / 24)?.minInterval.DAILY).toBe(2);
    expect(lengthLimits('DAYS', 8 / 24)).toBeNull();
    expect(limitsError(rule({ frequency: 'DAILY' }), lengthLimits('DAYS', 2.5))?.field).toBe('interval');
  });
  it('in weeks: no day by day, every N weeks from N on, one weekday', () => {
    expect(repetitionLimitError(rule({ frequency: 'DAILY' }), lasting('WEEKS', 1))?.field).toBe('frequency');
    expect(repetitionLimitError(rule({ interval: 2 }), lasting('WEEKS', 2))?.field).toBe('interval');
    expect(repetitionLimitError(rule({ interval: 3 }), lasting('WEEKS', 2))).toBeNull();
    expect(repetitionLimitError(rule({ interval: 3, weekdays: [1, 3] }), lasting('WEEKS', 2))?.field).toBe('weekdays');
    expect(repetitionLimitError(rule({ frequency: 'MONTHLY' }), lasting('WEEKS', 2))).toBeNull();
  });
  it('in months: every N months from N on, or every year', () => {
    expect(repetitionLimitError(rule({ interval: 4 }), lasting('MONTHS', 1))?.field).toBe('frequency');
    expect(repetitionLimitError(rule({ frequency: 'MONTHLY', interval: 2 }), lasting('MONTHS', 2))?.field).toBe('interval');
    expect(repetitionLimitError(rule({ frequency: 'MONTHLY', interval: 3 }), lasting('MONTHS', 2))).toBeNull();
    expect(repetitionLimitError(rule({ frequency: 'YEARLY' }), lasting('MONTHS', 6))).toBeNull();
  });
  it('cases and whole days', () => {
    expect(casesKeepLimits([{ rule: rule({ frequency: 'DAILY', duration: lasting('DAYS', 2) }) }])).toBe(false);
    expect(casesKeepLimits([{ rule: rule({ frequency: 'DAILY', duration: ONE_DAY }) }])).toBe(true);
    expect(casesKeepLimits([{ rule: null }, { rule: rule({}) }])).toBe(true);
    expect(lastsWeeksOrMonths(lasting('WEEKS', 1))).toBe(true);
    expect(lastsWeeksOrMonths(lasting('DAYS', 4))).toBe(false);
  });
});

describe('newLimitBreak: a rule saved before out of the limits stays', () => {
  const broken = rule({ frequency: 'DAILY', interval: 2, duration: lasting('DAYS', 3) });
  it('new: refused', () => {
    expect(newLimitBreak([{ rule: broken }])?.field).toBe('interval');
  });
  it('saved before, its end changed: kept', () => {
    expect(newLimitBreak([{ rule: { ...broken, until: '2026-12-31' } }], [{ rule: broken }])).toBeNull();
  });
  it('saved before, its rhythm changed into another one out of them: refused', () => {
    expect(newLimitBreak([{ rule: { ...broken, interval: 1 } }], [{ rule: broken }])?.field).toBe('interval');
  });
});
