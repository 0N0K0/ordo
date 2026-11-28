import { describe, expect, it } from 'vitest';
import { anyOccurrenceAfter, anyOccurrenceBefore, DEFAULT_RECURRENCE, firstShownOccurrence, followingScopeOffered, hasOccurrenceAfter, hasOccurrenceBefore, lastShownOccurrence, type Recurrence } from '../../src/dates/recurrence';
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

describe('scheduleFollowingOffered: the case of that day, not on its last day', () => {
  const allDay = { allDay: true, ranges: [] };
  const slot = (date: string, start = '00:00', end = '24:00') => ({ date, start, end, allDay: start === '00:00' });
  it('its period ends: not on its last day', () => {
    const schedule = { id: 's', label: 'S', startDate: '2026-11-02', endDate: '2026-11-30', cases: [{ start: null, rule: rule({ weekdays: [1] }), times: allDay }], exceptions: [] };
    expect(scheduleFollowingOffered(schedule, slot('2026-11-23'))).toBe(true);
    expect(scheduleFollowingOffered(schedule, slot('2026-11-30'))).toBe(false);
  });
  it('not on its first day', () => {
    const schedule = { id: 's', label: 'S', startDate: '2026-11-02', endDate: null, cases: [{ start: null, rule: rule({ weekdays: [1] }), times: allDay }], exceptions: [] };
    expect(scheduleFollowingOffered(schedule, slot('2026-11-02'))).toBe(false);
    expect(scheduleFollowingOffered(schedule, slot('2026-11-09'))).toBe(true);
  });
  it('another case going on does not count: lundi 9–12 ended, mardi 14–18 going on', () => {
    const schedule = {
      id: 's',
      label: 'S',
      startDate: '2026-11-02',
      endDate: null,
      cases: [
        { start: null, rule: rule({ weekdays: [1], until: '2026-11-09' }), times: { allDay: false, ranges: [{ start: '09:00', end: '12:00' }] } },
        { start: null, rule: rule({ weekdays: [2] }), times: { allDay: false, ranges: [{ start: '14:00', end: '18:00' }] } },
      ],
      exceptions: [],
    };
    expect(scheduleFollowingOffered(schedule, slot('2026-11-09', '09:00', '12:00'))).toBe(false);
    expect(scheduleFollowingOffered(schedule, slot('2026-11-10', '14:00', '18:00'))).toBe(true);
  });
  it('in an exception period: its own case, up to the end of the period', () => {
    const schedule = {
      id: 's',
      label: 'S',
      startDate: '2026-11-02',
      endDate: null,
      cases: [{ start: null, rule: rule({ weekdays: [1] }), times: allDay }],
      exceptions: [{ from: '2026-11-10', to: '2026-11-20', label: '', cases: [{ start: null, rule: rule({ weekdays: [3] }), times: allDay }] }],
    };
    expect(scheduleFollowingOffered(schedule, slot('2026-11-11'))).toBe(false);
    expect(scheduleFollowingOffered(schedule, slot('2026-11-18'))).toBe(false);
  });
});

describe('lastShownOccurrence: the days deleted alone left out', () => {
  it('without an end: null', () => {
    expect(lastShownOccurrence(rule({ weekdays: [1] }), '2026-11-02', new Set())).toBeNull();
  });
  it('three Mondays, the last deleted alone: the second is the last shown', () => {
    const weekly = rule({ weekdays: [1], count: 3 });
    expect(lastShownOccurrence(weekly, '2026-11-02', new Set())).toBe('2026-11-16');
    expect(lastShownOccurrence(weekly, '2026-11-02', new Set(['2026-11-16']))).toBe('2026-11-09');
  });
  it('all deleted: none', () => {
    expect(lastShownOccurrence(rule({ weekdays: [1], until: '2026-11-02' }), '2026-11-02', new Set(['2026-11-02']))).toBeUndefined();
  });
});

describe('hasOccurrenceBefore: « Celle-ci et les suivantes » never on the first occurrence', () => {
  it('the first date: none before', () => {
    expect(hasOccurrenceBefore(rule({ weekdays: [1] }), '2026-11-02', '2026-11-02')).toBe(false);
    expect(hasOccurrenceBefore(rule({ weekdays: [1] }), '2026-11-02', '2026-11-09')).toBe(true);
  });
  it('the first one skipped (« rien ») or deleted alone: the second is the first', () => {
    expect(hasOccurrenceBefore(rule({ weekdays: [1], exceptions: ['2026-11-02'] }), '2026-11-02', '2026-11-09')).toBe(false);
    expect(hasOccurrenceBefore(rule({ weekdays: [1] }), '2026-11-02', '2026-11-09', new Set(['2026-11-02']))).toBe(false);
  });
  it('no rule: none before', () => {
    expect(hasOccurrenceBefore(null, '2026-11-02', '2026-11-09')).toBe(false);
  });
  it('a period that starts later: counted from it', () => {
    expect(hasOccurrenceBefore(rule({ weekdays: [1] }), '2026-11-02', '2026-11-16', undefined, '2026-11-10')).toBe(false);
  });
  it('cases: one of them before is enough', () => {
    const later = { rule: rule({ weekdays: [3] }), start: '2026-11-11' };
    const earlier = { rule: rule({ weekdays: [1] }), start: '2026-11-02' };
    expect(anyOccurrenceBefore([later], '2026-11-11')).toBe(false);
    expect(anyOccurrenceBefore([later, earlier], '2026-11-11')).toBe(true);
  });
  it('followingScopeOffered: neither the first nor the last', () => {
    const weekly = rule({ weekdays: [1], count: 3 });
    expect(followingScopeOffered(weekly, '2026-11-02', '2026-11-02')).toBe(false);
    expect(followingScopeOffered(weekly, '2026-11-02', '2026-11-09')).toBe(true);
    expect(followingScopeOffered(weekly, '2026-11-02', '2026-11-16')).toBe(false);
  });
});

describe('firstShownOccurrence: the days deleted alone left out', () => {
  it('the first date', () => {
    expect(firstShownOccurrence(rule({ weekdays: [1] }), '2026-11-02', new Set())).toBe('2026-11-02');
  });
  it('the first two deleted alone: the third', () => {
    expect(firstShownOccurrence(rule({ weekdays: [1] }), '2026-11-02', new Set(['2026-11-02', '2026-11-09']))).toBe('2026-11-16');
  });
  it('all deleted: none', () => {
    expect(firstShownOccurrence(rule({ weekdays: [1], until: '2026-11-02' }), '2026-11-02', new Set(['2026-11-02']))).toBeUndefined();
  });
});

describe('scheduleFollowingOffered: the days of an exception period are not « before »', () => {
  it('a period over its first Mondays: the first Monday shown after it is the first', () => {
    const allDay = { allDay: true, ranges: [] };
    const schedule = {
      id: 's',
      label: 'S',
      startDate: '2026-11-02',
      endDate: null,
      cases: [{ start: null, rule: rule({ weekdays: [1] }), times: allDay }],
      exceptions: [{ from: '2026-11-02', to: '2026-11-20', label: '', cases: [] }],
    };
    expect(scheduleFollowingOffered(schedule, { date: '2026-11-23', start: '00:00', end: '24:00', allDay: true })).toBe(false);
    expect(scheduleFollowingOffered(schedule, { date: '2026-11-30', start: '00:00', end: '24:00', allDay: true })).toBe(true);
  });
  it('anyOccurrenceBefore from the first day of the item', () => {
    expect(anyOccurrenceBefore([{ rule: rule({ weekdays: [1] }), start: '2026-10-05' }], '2026-11-02', '2026-11-02')).toBe(false);
  });
});
