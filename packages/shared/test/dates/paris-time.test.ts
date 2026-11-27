import { describe, expect, it } from 'vitest';
import { addDays, dayIn, formatDay, parisParts, parseDay, printedDay, timeIn } from '../../src/dates/days';
import { dayText, longDayText, monthText, weekdayText, monthPeriodText } from '../../src/dates/format';
import { parisInstant } from '../../src/dates/reminders';
import { zonedInstant } from '../../src/dates/recurrence';

/** The run's zone, set by the vitest config: never Paris, so that a read in the zone of the machine fails. */
describe('test zone', () => {
  it('runs in a zone other than Paris and UTC', () => {
    expect(['America/New_York', 'Asia/Tokyo']).toContain(process.env.TZ);
    expect(new Date('2026-01-01T12:00:00Z').getTimezoneOffset()).not.toBe(0);
  });
});

describe('day of an instant in Paris (dayIn, parisParts)', () => {
  it('Paris midnight starts the day, whatever the zone of the machine', () => {
    expect(dayIn(new Date('2026-11-22T22:59:00Z'))).toBe('2026-11-22');
    expect(dayIn(new Date('2026-11-22T23:00:00Z'))).toBe('2026-11-23');
    expect(parisParts(new Date('2026-11-22T23:00:00Z'))).toEqual({ date: '2026-11-23', time: '00:00' });
  });

  it('summer time: Paris is UTC+2', () => {
    expect(parisParts(new Date('2026-07-14T21:59:00Z'))).toEqual({ date: '2026-07-14', time: '23:59' });
    expect(parisParts(new Date('2026-07-14T22:00:00Z'))).toEqual({ date: '2026-07-15', time: '00:00' });
  });

  it('spring change (2026-03-29): 01:59 is followed by 03:00', () => {
    expect(parisParts(new Date('2026-03-29T00:59:00Z'))).toEqual({ date: '2026-03-29', time: '01:59' });
    expect(parisParts(new Date('2026-03-29T01:00:00Z'))).toEqual({ date: '2026-03-29', time: '03:00' });
  });

  it('autumn change (2026-10-25): 02:30 comes twice', () => {
    expect(parisParts(new Date('2026-10-25T00:30:00Z')).time).toBe('02:30');
    expect(parisParts(new Date('2026-10-25T01:30:00Z')).time).toBe('02:30');
  });

  it('timeIn reads another zone on demand', () => {
    expect(timeIn(new Date('2026-11-23T12:00:00Z'), 'Asia/Tokyo')).toBe('21:00');
  });
});

describe('instant of a Paris day and time (parisInstant, zonedInstant)', () => {
  it('a Paris day starts at Paris midnight, in winter and in summer', () => {
    expect(parisInstant('2026-11-23').toISOString()).toBe('2026-11-22T23:00:00.000Z');
    expect(parisInstant('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('days of a change of time start at the right offset', () => {
    expect(parisInstant('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(parisInstant('2026-03-30').toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(parisInstant('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(parisInstant('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('a time on the day of a change uses the offset after it', () => {
    expect(parisInstant('2026-03-29', '12:00').toISOString()).toBe('2026-03-29T10:00:00.000Z');
    expect(parisInstant('2026-10-25', '12:00').toISOString()).toBe('2026-10-25T11:00:00.000Z');
  });

  it('a time skipped in spring (02:30) falls an hour later (03:30)', () => {
    expect(parisParts(parisInstant('2026-03-29', '02:30'))).toEqual({ date: '2026-03-29', time: '03:30' });
  });

  it('a time doubled in autumn (02:30) is the second one (winter time)', () => {
    expect(parisInstant('2026-10-25', '02:30').toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  it('parisParts reads back the day and time of parisInstant', () => {
    for (const [date, time] of [
      ['2026-03-28', '23:30'],
      ['2026-03-29', '00:15'],
      ['2026-03-29', '03:00'],
      ['2026-10-24', '23:59'],
      ['2026-10-25', '00:00'],
      ['2026-10-25', '03:00'],
      ['2026-12-31', '23:59'],
    ])
      expect(parisParts(parisInstant(date, time))).toEqual({ date, time });
  });

  it('zonedInstant works for another zone', () => {
    expect(zonedInstant('2026-11-23', '09:00', 'Asia/Tokyo').toISOString()).toBe('2026-11-23T00:00:00.000Z');
  });
});

describe('calendar days have no zone', () => {
  it('parseDay / formatDay / addDays keep the day, across a change of time', () => {
    expect(formatDay(parseDay('2026-03-29'))).toBe('2026-03-29');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('a YYYY-MM-DD day is shown as it is', () => {
    expect(dayText('2026-11-01')).toBe('1 nov. 2026');
    expect(weekdayText('2026-11-13')).toBe('ven. 13 nov.');
    expect(printedDay('2026-11-01')).toBe('01/11/2026');
  });

  it('a month YYYY-MM is shown as it is', () => {
    expect(monthText('2026-11')).toBe('novembre 2026');
  });

  it('an instant is shown on its Paris day', () => {
    expect(dayText(new Date('2026-10-31T23:30:00Z'))).toBe('1 nov. 2026');
    expect(dayText('2026-10-31T23:30:00Z')).toBe('1 nov. 2026');
    expect(dayText(Date.parse('2026-10-31T22:30:00Z'))).toBe('31 oct. 2026');
  });

  it('the first day of a month in a sentence: « 1er »', () => {
    expect(longDayText('2026-06-01')).toBe('1er juin 2026');
    expect(longDayText('2026-06-11')).toBe('11 juin 2026');
  });
});

describe('monthPeriodText', () => {
  it('words a period by its months: one month, months of a year, months of two years', () => {
    expect(monthPeriodText('2026-09-01', '2026-09-30')).toBe('septembre 2026');
    expect(monthPeriodText('2026-09-07', '2026-12-20')).toBe('de septembre à décembre 2026');
    expect(monthPeriodText('2026-09-01', '2027-06-30')).toBe('de septembre 2026 à juin 2027');
    expect(monthPeriodText('2027-04-01', '2027-06-30')).toBe('d’avril à juin 2027');
    expect(monthPeriodText('2026-10-01', '2027-01-31')).toBe('d’octobre 2026 à janvier 2027');
  });
});
