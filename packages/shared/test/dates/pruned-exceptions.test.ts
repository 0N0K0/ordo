import { describe, expect, it } from 'vitest';
import { DEFAULT_RECURRENCE, prunedExceptions, type Recurrence } from '../../src/dates/recurrence';
import { prunedCases } from '../../src/dates/repetition';

/**
 * Rule changed by some fields.
 * @param {Partial<Recurrence>} fields Fields.
 * @returns {Recurrence} Rule.
 */
const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

describe('prunedExceptions: « rien » exceptions no longer on a day of their rule', () => {
  it('a weekday the rule no longer has, a day before its first day, a day after its end: dropped', () => {
    // Mondays from Monday 2026-11-02 to 2026-11-30.
    const weekly = rule({ weekdays: [1], until: '2026-11-30', exceptions: ['2026-10-26', '2026-11-09', '2026-11-10', '2026-12-07'] });
    expect(prunedExceptions(weekly, '2026-11-02').exceptions).toEqual(['2026-11-09']);
  });

  it('counted: a day after its last occurrence (skipped days not counted) is dropped', () => {
    // Three Mondays, the second skipped: 11-02, 11-16, 11-23.
    const weekly = rule({ weekdays: [1], count: 3, exceptions: ['2026-11-09', '2026-11-30'] });
    expect(prunedExceptions(weekly, '2026-11-02').exceptions).toEqual(['2026-11-09']);
  });

  it('all kept: the same rule', () => {
    const daily = rule({ frequency: 'DAILY', interval: 2, exceptions: ['2026-11-04'] });
    expect(prunedExceptions(daily, '2026-11-02')).toBe(daily);
  });

  it('cases: each counted from its « Début », else from the first day', () => {
    const cases = [
      { start: null, rule: rule({ frequency: 'DAILY', interval: 2, exceptions: ['2026-11-03', '2026-11-04'] }) },
      { start: '2026-11-03', rule: rule({ frequency: 'DAILY', interval: 2, exceptions: ['2026-11-03', '2026-11-04'] }) },
    ];
    expect(prunedCases(cases, '2026-11-02').map((item) => item.rule.exceptions)).toEqual([['2026-11-04'], ['2026-11-03']]);
  });
});
