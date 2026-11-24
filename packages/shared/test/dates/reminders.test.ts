import { describe, expect, it } from 'vitest';
import {
  birthdayRemindersSchema,
  eventRemindersSchema,
  minutesBeforeMoment,
  normalizedReminders,
  occurrenceReminders,
  readReminders,
  reminderDayRange,
  reminderDaysAhead,
  reminderKey,
  reminderOfKey,
  remindersSchema,
  reminderSchema,
  startRemindersSchema,
  taskReminders,
  taskRemindersSchema,
  taskRemindsOn,
} from '../../src/dates/reminders';

const firstMessage = (result: { error?: { issues: { message: string }[] } }) => result.error?.issues[0].message;

describe('reminderSchema', () => {
  it('exactly one of « N min avant » and « à HH:MM »; « N jours avant » has a time', () => {
    expect(firstMessage(reminderSchema.safeParse({ before: 10, at: '08:00' }))).toBe('Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ».');
    expect(firstMessage(reminderSchema.safeParse({}))).toBe('Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ».');
    expect(firstMessage(reminderSchema.safeParse({ before: 10, days: 2 }))).toBe('Un rappel « N jours avant » a une heure (HH:MM).');
  });

  it('0 to 24 hours before; 1 to 30 days before', () => {
    expect(reminderSchema.parse({ before: 0 })).toEqual({ before: 0, at: null, days: null });
    expect(firstMessage(reminderSchema.safeParse({ before: 1441 }))).toBe('24 heures maximum.');
    expect(firstMessage(reminderSchema.safeParse({ at: '08:00', days: 31 }))).toBe('30 jours maximum.');
    expect(firstMessage(reminderSchema.safeParse({ at: '08:00', days: 0 }))).toBe('Au moins 1 jour.');
  });

  it('a time of the day keeps only its day: openEnd → start, dueStart → end', () => {
    expect(reminderSchema.parse({ at: '08:00', anchor: 'openEnd' })).toEqual({ before: null, at: '08:00', days: null });
    expect(reminderSchema.parse({ at: '08:00', anchor: 'dueStart' }).anchor).toBe('end');
    expect(reminderSchema.parse({ before: 5, anchor: 'dueStart' }).anchor).toBe('dueStart');
    expect(reminderSchema.parse({ before: 5, anchor: 'start' }).anchor).toBeUndefined();
    expect(firstMessage(reminderSchema.safeParse({ before: 5, anchor: 'middle' }))).toBe('Un rappel compte depuis un début ou une fin.');
  });

  it('a ringtone no longer in the bank is dropped (the one of the settings)', () => {
    expect(reminderSchema.parse({ before: 5, ringtone: 'carillon' }).ringtone).toBe('carillon');
    expect(reminderSchema.parse({ before: 5, ringtone: 'gone' }).ringtone).toBeUndefined();
  });

  it('readReminders leaves out the invalid ones', () => {
    expect(readReminders([{ before: 5 }, { before: 5, at: '08:00' }, 'nope'])).toEqual([{ before: 5, at: null, days: null }]);
  });
});

describe('reminders by kind of item', () => {
  it('10 at most', () => {
    expect(firstMessage(remindersSchema.safeParse(Array.from({ length: 11 }, (_, index) => ({ before: index }))))).toBe('10 rappels maximum.');
  });

  it('an event: from its start or its end, not the routine anchors', () => {
    expect(eventRemindersSchema.safeParse([{ before: 5, anchor: 'end' }]).success).toBe(true);
    expect(firstMessage(eventRemindersSchema.safeParse([{ before: 5, anchor: 'openEnd' }]))).toBe('Seules les routines ont des rappels depuis la fin de l’ouverture ou le début de l’échéance.');
  });

  it('an éphéméride: from its start only', () => {
    expect(firstMessage(startRemindersSchema.safeParse([{ before: 5, anchor: 'end' }]))).toBe('Seuls les évènements et les routines ont des rappels avant la fin.');
  });

  it('a task and a birthday: times of the day only', () => {
    expect(firstMessage(taskRemindersSchema.safeParse([{ before: 5 }]))).toBe('Une tâche n’a que des rappels à une heure précise.');
    expect(firstMessage(birthdayRemindersSchema.safeParse([{ before: 0 }]))).toBe('Un anniversaire n’a que des rappels à une heure précise.');
    expect(taskRemindersSchema.safeParse([{ at: '08:00', days: 2 }]).success).toBe(true);
  });
});

describe('keys and order', () => {
  it('reminderKey and reminderOfKey are each other’s inverse, whatever the ringtone', () => {
    for (const reminder of [{ before: 15 }, { at: '08:00' }, { at: '08:00', days: 3 }, { before: 5, anchor: 'end' }, { before: 5, anchor: 'openEnd' }, { at: '07:30', days: 2, anchor: 'end' }]) {
      const parsed = reminderSchema.parse(reminder);
      expect(reminderOfKey(reminderKey(parsed))).toEqual(parsed);
    }
    expect(reminderKey(reminderSchema.parse({ at: '08:00', days: 3 }))).toBe('days:3:08:00');
    expect(reminderKey(reminderSchema.parse({ before: 5, anchor: 'end', ringtone: 'bip' }))).toBe('end:before:5');
    expect(reminderOfKey('nope:1')).toBeNull();
  });

  it('normalizedReminders: no duplicates (the last kept), by anchor, each in the order they ring', () => {
    const reminders = [
      { before: 5, at: null, days: null },
      { before: null, at: '08:00', days: null },
      { before: 60, at: null, days: null },
      { before: null, at: '09:00', days: 1 },
      { before: null, at: '07:00', days: 3 },
      { before: 10, at: null, days: null, anchor: 'end' as const },
      { before: 5, at: null, days: null, ringtone: 'bip' as const },
    ];
    expect(normalizedReminders(reminders).map(reminderKey)).toEqual(['days:3:07:00', 'days:1:09:00', 'before:60', 'before:5', 'at:08:00', 'end:before:10']);
    expect(normalizedReminders(reminders).find((reminder) => reminder.before === 5)?.ringtone).toBe('bip');
  });

  it('minutesBeforeMoment: for a relative alarm, days before counted', () => {
    expect(minutesBeforeMoment({ before: 15, at: null }, '10:00')).toBe(15);
    expect(minutesBeforeMoment({ before: null, at: '08:00' }, '10:00')).toBe(120);
    expect(minutesBeforeMoment({ before: null, at: '20:00', days: 1 }, 1440)).toBe(1680);
  });
});

describe('when reminders ring (Paris time)', () => {
  const start = new Date('2026-11-23T09:00:00Z');
  const end = { day: '2026-11-24', at: new Date('2026-11-24T17:00:00Z') };
  const reminders = readReminders([{ before: 15 }, { at: '08:00' }, { at: '20:00', days: 1 }, { before: 0, anchor: 'end' }, { at: '07:00', anchor: 'end' }]);

  it('before the start, at a time of the first day, days before it, and from the end and the last day', () => {
    expect(occurrenceReminders('event:e', '2026-11-23', start, reminders, end).map((ring) => [ring.key, ring.at.toISOString()])).toEqual([
      ['event:e:before:15', '2026-11-23T08:45:00.000Z'],
      ['event:e:at:08:00', '2026-11-23T07:00:00.000Z'],
      ['event:e:days:1:20:00', '2026-11-22T19:00:00.000Z'],
      ['event:e:end:before:0', '2026-11-24T17:00:00.000Z'],
      ['event:e:end:at:07:00', '2026-11-24T06:00:00.000Z'],
    ]);
  });

  it('without an end, those from the end are left out', () => {
    expect(occurrenceReminders('k', '2026-11-23', start, reminders)).toHaveLength(3);
  });

  it('a time of a day of summer time is read in summer time', () => {
    expect(occurrenceReminders('k', '2026-07-14', start, readReminders([{ at: '08:00' }]))[0].at.toISOString()).toBe('2026-07-14T06:00:00.000Z');
  });

  it('reminderDayRange: from yesterday to 31 days ahead, in Paris days', () => {
    expect(reminderDayRange(new Date('2026-11-22T23:30:00Z'))).toEqual({ from: '2026-11-22', to: '2026-12-24' });
    expect(reminderDaysAhead(readReminders([{ before: 60 }, { at: '08:00', days: 7 }, { at: '08:00', days: 2 }]))).toBe(7);
  });
});

describe('reminders of a task', () => {
  it('every day from its « Ouverture » to its « Échéance »; its « Échéance » only without « Ouverture »; never without « Échéance »', () => {
    const task = { minDate: '2026-11-20', deadline: '2026-11-23' };
    expect(taskRemindsOn(task, '2026-11-19')).toBe(false);
    expect(taskRemindsOn(task, '2026-11-21')).toBe(true);
    expect(taskRemindsOn(task, '2026-11-24')).toBe(false);
    expect(taskRemindsOn({ deadline: '2026-11-23' }, '2026-11-22')).toBe(false);
    expect(taskRemindsOn({ minDate: '2026-11-20' }, '2026-11-21')).toBe(false);
  });

  it('« À HH:MM » of yesterday and today in Paris; « N jours avant » once from its « Échéance »', () => {
    const task = { minDate: '2026-11-20', deadline: '2026-11-30', reminders: readReminders([{ at: '08:00' }, { at: '09:00', days: 2 }]) };
    // 23:30 UTC on the 22nd is the 23rd in Paris.
    expect(taskReminders('task:t', task, new Date('2026-11-22T23:30:00Z')).map((ring) => [ring.key, ring.at.toISOString()])).toEqual([
      ['task:t:2026-11-30:days:2:09:00', '2026-11-28T08:00:00.000Z'],
      ['task:t:2026-11-22:at:08:00', '2026-11-22T07:00:00.000Z'],
      ['task:t:2026-11-23:at:08:00', '2026-11-23T07:00:00.000Z'],
    ]);
  });
});
