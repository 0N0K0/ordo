import { describe, expect, it } from 'vitest';
import { opensBeforeDay, opensLimits, opensReach, routineOpenDate, routineRuleLimitError } from '../../src/routines/routines';
import { DEFAULT_RECURRENCE, ONE_DAY, type Recurrence } from '../../src/dates/recurrence';

/**
 * Rule changed by some fields.
 * @param {Partial<Recurrence>} fields Fields.
 * @returns {Recurrence} Rule.
 */
const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

describe('« Ouverture » some days, weeks or months before the due day', () => {
  it('days (none saved: days), weeks, months', () => {
    expect(routineOpenDate('2026-11-20', { mode: 'BEFORE', days: 3 }, 'DAILY')).toBe('2026-11-17');
    expect(routineOpenDate('2026-11-20', { mode: 'BEFORE', days: 2, unit: 'WEEKS' }, 'WEEKLY')).toBe('2026-11-06');
    expect(routineOpenDate('2026-11-20', { mode: 'BEFORE', days: 1, unit: 'MONTHS' }, 'MONTHLY')).toBe('2026-10-20');
  });
  it('months: the last day of a shorter month, across a year', () => {
    expect(opensBeforeDay('2026-05-31', 3, 'MONTHS')).toBe('2026-02-28');
    expect(opensBeforeDay('2027-01-15', 2, 'MONTHS')).toBe('2026-11-15');
  });
  it('reach', () => {
    expect(opensReach({ mode: 'BEFORE', days: 2, unit: 'WEEKS' })).toBe(14);
  });
});

describe('repetition limited by the « Ouverture »: the next one opens after the due day', () => {
  it('3 days before: from every 4 days', () => {
    expect(opensLimits({ mode: 'BEFORE', days: 3 })?.minInterval.DAILY).toBe(4);
    expect(routineRuleLimitError(rule({ frequency: 'DAILY', interval: 3 }), { mode: 'BEFORE', days: 3 })?.field).toBe('interval');
    expect(routineRuleLimitError(rule({ frequency: 'DAILY', interval: 4 }), { mode: 'BEFORE', days: 3 })).toBeNull();
  });
  it('a day before: not every day', () => {
    expect(routineRuleLimitError(rule({ frequency: 'DAILY' }), { mode: 'BEFORE', days: 1 })?.message).toContain('ouverte 1 jour avant');
  });
  it('weeks before: every N weeks from N + 1', () => {
    expect(routineRuleLimitError(rule({ interval: 2 }), { mode: 'BEFORE', days: 2, unit: 'WEEKS' })?.field).toBe('interval');
    expect(routineRuleLimitError(rule({ interval: 3 }), { mode: 'BEFORE', days: 2, unit: 'WEEKS' })).toBeNull();
  });
  it('a day of the period, or none: no limit; the duration counts too', () => {
    expect(opensLimits({ mode: 'DAY', day: 1, month: null })).toBeNull();
    expect(routineRuleLimitError(rule({ frequency: 'DAILY' }), null)).toBeNull();
    expect(routineRuleLimitError(rule({ frequency: 'DAILY', interval: 3, duration: { ...ONE_DAY, count: 3 } }), null)?.field).toBe('interval');
  });
});
