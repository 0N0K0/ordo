import { describe, expect, it } from 'vitest';
import { birthDateSchema, birthDateText, birthdayLabel, birthdaysBetween, readBirthDate } from '../../src/people/birthdays';

describe('birth date', () => {
  it('YYYY-MM-DD, or --MM-DD without year', () => {
    expect(readBirthDate('1986-11-23')).toEqual({ year: 1986, month: 11, day: 23 });
    expect(readBirthDate('--11-23')).toEqual({ year: null, month: 11, day: 23 });
    expect(birthDateText({ year: null, month: 2, day: 9 })).toBe('--02-09');
  });

  it('refuses a day the month does not have; 29 February without year is a day', () => {
    expect(readBirthDate('1986-04-31')).toBeNull();
    expect(readBirthDate('2023-02-29')).toBeNull();
    expect(readBirthDate('2024-02-29')).not.toBeNull();
    expect(readBirthDate('--02-29')).not.toBeNull();
    expect(readBirthDate('--13-01')).toBeNull();
  });

  it('refuses a year before 1900', () => {
    expect(readBirthDate('1899-12-31')).toBeNull();
    expect(readBirthDate('1900-01-01')).not.toBeNull();
  });

  it('birthDateSchema: empty is none; invalid and future dates refused', () => {
    expect(birthDateSchema.parse('')).toBeNull();
    expect(birthDateSchema.safeParse('1986-02-30').error?.issues[0].message).toBe('Date de naissance invalide.');
    expect(birthDateSchema.safeParse('2999-01-01').error?.issues[0].message).toBe('La date de naissance ne peut pas être à venir.');
    expect(birthDateSchema.safeParse('--12-31').success).toBe(true);
  });
});

describe('birthdays', () => {
  it('every year on the day and month of the birth, with the age', () => {
    expect(birthdaysBetween(readBirthDate('1986-11-23')!, '2025-01-01', '2026-12-31')).toEqual([
      { date: '2025-11-23', age: 39 },
      { date: '2026-11-23', age: 40 },
    ]);
  });

  it('never before the birth, nor on it', () => {
    expect(birthdaysBetween(readBirthDate('2024-03-10')!, '2023-01-01', '2025-12-31')).toEqual([{ date: '2025-03-10', age: 1 }]);
  });

  it('29 February falls on the 28th of a year without one', () => {
    expect(birthdaysBetween(readBirthDate('2000-02-29')!, '2026-01-01', '2028-12-31').map((birthday) => birthday.date)).toEqual(['2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('without year: no age', () => {
    expect(birthdaysBetween(readBirthDate('--11-23')!, '2026-11-23', '2026-11-23')).toEqual([{ date: '2026-11-23', age: null }]);
  });

  it('« Anniversaire de Paul — 40 ans », the age left out without year', () => {
    expect(birthdayLabel('Paul', 40)).toBe('Anniversaire de Paul — 40 ans');
    expect(birthdayLabel('Paul', 1)).toBe('Anniversaire de Paul — 1 an');
    expect(birthdayLabel('Paul', null)).toBe('Anniversaire de Paul');
  });
});
