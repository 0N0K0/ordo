import { describe, expect, it } from 'vitest';
import { anyOccurrenceAfter, DEFAULT_RECURRENCE, hasOccurrenceAfter, type Recurrence } from '../../src/dates/recurrence';
import { scheduleFollowingOffered } from '../../src/calendar/work-schedules';

/**
 * Rule changed by some fields.
 * @param {Partial<Recurrence>} fields Fields.
 * @returns {Recurrence} Rule.
 */
const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

describe('hasOccurrenceAfter: « Celle-ci et les suivantes » never on the last occurrence', () => {
  it('without an end: always', () => {
    expect(hasOccurrenceAfter(rule({ weekdays: [1] }), '2026-11-02', '2030-01-07')).toBe(true);
  });

  it('with an end date: not on the last one', () => {
    const weekly = rule({ weekdays: [1], until: '2026-11-30' });
    expect(hasOccurrenceAfter(weekly, '2026-11-02', '2026-11-23')).toBe(true);
    expect(hasOccurrenceAfter(weekly, '2026-11-02', '2026-11-30')).toBe(false);
  });

  it('counted: a « rien » exception does not count, the last one is further', () => {
    // Three Mondays, 11-16 skipped: 11-02, 11-09, 11-23.
    const weekly = rule({ weekdays: [1], count: 3, exceptions: ['2026-11-16'] });
    expect(hasOccurrenceAfter(weekly, '2026-11-02', '2026-11-09')).toBe(true);
    expect(hasOccurrenceAfter(weekly, '2026-11-02', '2026-11-23')).toBe(false);
  });

  it('no rule: a single occurrence, none after', () => {
    expect(hasOccurrenceAfter(null, '2026-11-02', '2026-11-02')).toBe(false);
  });

  it('cases: one of them going on is enough', () => {
    const ended = { rule: rule({ weekdays: [1], until: '2026-11-09' }), start: '2026-11-02' };
    const going = { rule: rule({ weekdays: [3] }), start: '2026-11-04' };
    expect(anyOccurrenceAfter([ended], '2026-11-09')).toBe(false);
    expect(anyOccurrenceAfter([ended, going], '2026-11-09')).toBe(true);
  });
});

describe('scheduleFollowingOffered: not on the last day of a schedule', () => {
  const times = { allDay: true, ranges: [] };
  it('its period ends: not on its last day', () => {
    const schedule = { startDate: '2026-11-02', endDate: '2026-11-30', cases: [{ start: null, rule: rule({ weekdays: [1] }), times }], exceptions: [] };
    expect(scheduleFollowingOffered(schedule, '2026-11-23')).toBe(true);
    expect(scheduleFollowingOffered(schedule, '2026-11-30')).toBe(false);
  });
  it('an exception period with cases of its own going on after the day: offered', () => {
    const schedule = {
      startDate: '2026-11-02',
      endDate: null,
      cases: [{ start: null, rule: rule({ weekdays: [1], until: '2026-11-09' }), times }],
      exceptions: [{ from: '2026-11-10', to: '2026-11-20', label: '', cases: [{ start: null, rule: rule({ weekdays: [3] }), times }] }],
    };
    expect(scheduleFollowingOffered(schedule, '2026-11-09')).toBe(true);
    expect(scheduleFollowingOffered(schedule, '2026-11-18')).toBe(false);
  });
});
