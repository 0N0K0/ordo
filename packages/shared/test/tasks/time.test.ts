import { describe, expect, it } from 'vitest';
import {
  alarmInputSchema,
  alarmRule,
  DURATION_MAX_SECONDS,
  DURATION_MIN_SECONDS,
  durationSchema,
  durationText,
  entrySeconds,
  entrySecondsWithin,
  formatClock,
  formatDuration,
  nextOccurrence,
  parseDuration,
  previousOccurrence,
  timeEntryFormSchema,
} from '../../src/tasks/time';
import { rule } from '../rules';

describe('durations of a time: 1 minute to 24 hours', () => {
  it('bounds are 60 s and 86 400 s', () => {
    expect(DURATION_MIN_SECONDS).toBe(60);
    expect(DURATION_MAX_SECONDS).toBe(86_400);
  });

  it('durationSchema refuses below 1 minute and above 24 hours, in whole seconds', () => {
    expect(durationSchema.safeParse(59).error?.issues[0].message).toBe('Au moins 1 minute.');
    expect(durationSchema.safeParse(86_401).error?.issues[0].message).toBe('24 heures maximum.');
    expect(durationSchema.safeParse(90.5).success).toBe(false);
    expect(durationSchema.safeParse(60).success).toBe(true);
    expect(durationSchema.safeParse(86_400).success).toBe(true);
  });
});

describe('parseDuration: a duration typed in a field', () => {
  it('reads « 1:30 », « 1h30 », « 1 h », « 45 min », « 90 » (minutes), « 1,5 h » (hours)', () => {
    expect(parseDuration('1:30')).toBe(5400);
    expect(parseDuration('1h30')).toBe(5400);
    expect(parseDuration('1 h')).toBe(3600);
    expect(parseDuration('45 min')).toBe(2700);
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('1,5 h')).toBe(5400);
    expect(parseDuration(' 2H05 ')).toBe(7500);
  });

  it('refuses out of 1 minute to 24 hours', () => {
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('0:00')).toBeNull();
    expect(parseDuration('24:00')).toBe(86_400);
    expect(parseDuration('24:01')).toBeNull();
    expect(parseDuration('1441')).toBeNull();
    expect(parseDuration('25 h')).toBeNull();
  });

  it('refuses what it does not understand (minutes over 59 after a colon, words)', () => {
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('une heure')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('durationText is read back by parseDuration', () => {
    expect(durationText(5)).toBe('0:05');
    expect(parseDuration(durationText(95))).toBe(95 * 60);
  });
});

describe('display of a duration', () => {
  it('« 45 min » under an hour, « 2 h 05 » from an hour, rounded to the minute', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(2699)).toBe('45 min');
    expect(formatDuration(3570)).toBe('1 h 00');
    expect(formatDuration(7500)).toBe('2 h 05');
  });

  it('a running clock « 1:05:09 », never negative', () => {
    expect(formatClock(3909)).toBe('1:05:09');
    expect(formatClock(-5)).toBe('0:00:00');
  });
});

describe('entrySeconds: live duration of a time', () => {
  const start = '2026-11-23T08:00:00.000Z';
  const base = { startedAt: start, endedAt: null, pausedAt: null, pausedSeconds: 0, duration: null };
  const at = (iso: string) => Date.parse(iso);

  it('the stored duration once stopped', () => {
    expect(entrySeconds({ ...base, endedAt: '2026-11-23T10:00:00.000Z', duration: 1234 })).toBe(1234);
  });

  it('running: up to now, less the previous pauses', () => {
    expect(entrySeconds({ ...base, pausedSeconds: 600 }, at('2026-11-23T09:00:00.000Z'))).toBe(3000);
  });

  it('paused: up to the start of the pause', () => {
    expect(entrySeconds({ ...base, pausedAt: '2026-11-23T08:30:00.000Z' }, at('2026-11-23T12:00:00.000Z'))).toBe(1800);
  });

  it('never negative', () => {
    expect(entrySeconds({ ...base, pausedSeconds: 7200 }, at('2026-11-23T09:00:00.000Z'))).toBe(0);
  });

  it('whole seconds', () => {
    expect(entrySeconds(base, at('2026-11-23T08:00:01.900Z'))).toBe(1);
  });
});

describe('entrySecondsWithin: part of a time in a period', () => {
  const entry = { startedAt: '2026-11-22T22:00:00.000Z', endedAt: '2026-11-23T00:00:00.000Z', pausedAt: null, pausedSeconds: 0, duration: 7200 };

  it('a time past midnight counts on both days, in proportion', () => {
    const midnight = Date.parse('2026-11-23T00:00:00.000Z') - 3600_000;
    expect(entrySecondsWithin(entry, midnight - 86_400_000, midnight)).toBe(3600);
    expect(entrySecondsWithin(entry, midnight, midnight + 86_400_000)).toBe(3600);
  });

  it('its pauses are shared out over the whole time', () => {
    const paused = { ...entry, pausedSeconds: 1200, duration: 6000 };
    expect(entrySecondsWithin(paused, Date.parse('2026-11-22T22:00:00.000Z'), Date.parse('2026-11-22T23:00:00.000Z'))).toBe(3000);
  });

  it('nothing out of the period', () => {
    expect(entrySecondsWithin(entry, Date.parse('2026-11-24T00:00:00.000Z'), Date.parse('2026-11-25T00:00:00.000Z'))).toBe(0);
  });
});

describe('timeEntryFormSchema', () => {
  const values = { projectId: '', routineIds: [], taskIds: [], events: [], description: '', date: '2026-11-23', start: '09:00', duration: '1:30' };

  it('needs a project, a task, a routine or an event', () => {
    expect(timeEntryFormSchema.safeParse(values).error?.issues[0].message).toBe('Choisissez un projet, une tâche, une routine ou un évènement.');
    expect(timeEntryFormSchema.safeParse({ ...values, taskIds: ['t'] }).success).toBe(true);
    expect(timeEntryFormSchema.safeParse({ ...values, events: ['e:2026-11-23'] }).success).toBe(true);
  });

  it('refuses a duration not understood', () => {
    expect(timeEntryFormSchema.safeParse({ ...values, projectId: 'p', duration: '25 h' }).error?.issues[0].message).toBe('Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h.');
  });
});

describe('alarms', () => {
  const alarm = {
    label: 'Pause',
    note: '',
    type: 'REMINDER' as const,
    startDate: '2026-11-23',
    time: '09:00',
    frequency: 'ONCE' as const,
    interval: 1,
    weekdays: [],
    endDate: null,
    minutes: null,
    projectId: null,
    taskId: null,
    enabled: true,
  };

  it('a reminder needs a date and a time; a tracking duration needs minutes', () => {
    const messages = alarmInputSchema.safeParse({ ...alarm, startDate: null, time: null }).error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(['La date est requise.', 'L’heure est requise.']);
    expect(alarmInputSchema.safeParse({ ...alarm, type: 'TRACKING_DURATION' }).error?.issues[0].message).toBe('La durée est requise.');
    expect(alarmInputSchema.safeParse({ ...alarm, type: 'TRACKING_DURATION', startDate: null, time: null, minutes: 30 }).success).toBe(true);
  });

  it('the end follows the start', () => {
    expect(alarmInputSchema.safeParse({ ...alarm, endDate: '2026-11-22' }).error?.issues[0].message).toBe('La fin doit suivre le début.');
  });

  it('alarmRule: the common repetition when valid, else the former fields (ONCE: none)', () => {
    expect(alarmRule({ ...alarm })).toBeNull();
    expect(alarmRule({ ...alarm, frequency: 'WEEKLY', interval: 0, weekdays: [1, 3], endDate: '2026-12-31' })).toMatchObject({ frequency: 'WEEKLY', interval: 1, weekdays: [1, 3], until: '2026-12-31' });
    expect(alarmRule({ ...alarm, frequency: 'DAILY', weekdays: [1] })?.weekdays).toEqual([]);
    const recurrence = rule({ frequency: 'MONTHLY' });
    expect(alarmRule({ ...alarm, recurrence })).toEqual(recurrence);
    expect(alarmRule({ ...alarm, frequency: 'DAILY', recurrence: { frequency: 'NOPE' } })?.frequency).toBe('DAILY');
  });

  it('rings at the Paris time, across the change of time', () => {
    const daily = { ...alarm, frequency: 'DAILY' as const };
    // 09:00 in Paris: 08:00 UTC before the change of 2026-10-25, then 08:00 UTC after it (UTC+1).
    expect(nextOccurrence({ ...daily, startDate: '2026-10-23' }, new Date('2026-10-24T08:00:00Z'))?.toISOString()).toBe('2026-10-25T08:00:00.000Z');
    expect(previousOccurrence({ ...daily, startDate: '2026-10-23' }, new Date('2026-10-24T08:00:00Z'))?.toISOString()).toBe('2026-10-24T07:00:00.000Z');
  });

  it('the day of « now » is the Paris day (just after Paris midnight)', () => {
    const once = { ...alarm, startDate: '2026-11-24', time: '00:30' };
    // 23:10 UTC on the 23rd is 00:10 on the 24th in Paris: the alarm of the 24th at 00:30 is still to come.
    expect(nextOccurrence(once, new Date('2026-11-23T23:10:00Z'))?.toISOString()).toBe('2026-11-23T23:30:00.000Z');
    expect(previousOccurrence(once, new Date('2026-11-23T23:40:00Z'))?.toISOString()).toBe('2026-11-23T23:30:00.000Z');
  });

  it('a single alarm rings once, nothing after; previous looks back 2 days only', () => {
    expect(nextOccurrence(alarm, new Date('2026-11-23T09:00:00Z'))).toBeNull();
    expect(previousOccurrence(alarm, new Date('2026-11-26T12:00:00Z'))).toBeNull();
    expect(previousOccurrence(alarm, new Date('2026-11-25T12:00:00Z'))?.toISOString()).toBe('2026-11-23T08:00:00.000Z');
  });

  it('stops after the end of its rule', () => {
    const weekly = { ...alarm, frequency: 'WEEKLY' as const, weekdays: [1], endDate: '2026-11-30' };
    expect(nextOccurrence(weekly, new Date('2026-11-23T09:00:00Z'))?.toISOString()).toBe('2026-11-30T08:00:00.000Z');
    expect(nextOccurrence(weekly, new Date('2026-11-30T09:00:00Z'))).toBeNull();
  });
});
