import { z } from 'zod';
import { twoDigits } from '../core/numbers';
import { dayIn, PARIS_ZONE, yearOfDay } from '../dates/days';
import { countOf } from '../core/text';
import { dayInMonth, daysInMonth } from '../dates/months';

/**
 * Birth dates of the people (contributors, members, relations) and the birthdays they give: whole-day
 * éphémérides derived at read time (no stored row), with the age when the year is known.
 *
 * A birth date is stored as text: `YYYY-MM-DD`, or `--MM-DD` when the year is not known (ISO 8601 / vCard form).
 */

/** A birth date read: its day and month, and its year when known. */
export interface BirthDate {
  month: number;
  day: number;
  year: number | null;
}

/** Earliest year of birth accepted. */
export const BIRTH_YEAR_MIN = 1900;

/** Form of a stored birth date. */
const BIRTH_DATE_PATTERN = /^(?:(\d{4})-|--)(\d{2})-(\d{2})$/;

/**
 * Birth date read from its text, null when it is none or invalid (a day the month does not have, 29 February of a year
 * that has none, a year before 1900).
 * @param {string | null | undefined} value `YYYY-MM-DD` or `--MM-DD`.
 * @returns {BirthDate | null} Birth date.
 */
export function readBirthDate(value: string | null | undefined): BirthDate | null {
  const match = value ? BIRTH_DATE_PATTERN.exec(value) : null;
  if (!match) return null;
  const year = match[1] === undefined ? null : Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Without year, 29 February is a day (a leap year: 2000).
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year ?? 2000, month)) return null;
  if (year !== null && year < BIRTH_YEAR_MIN) return null;
  return { month, day, year };
}

/**
 * Text of a birth date: `YYYY-MM-DD`, or `--MM-DD` without year.
 * @param {BirthDate} birth Birth date.
 * @returns {string} Text.
 */
export function birthDateText(birth: BirthDate): string {
  return `${birth.year === null ? '--' : `${birth.year}-`}${twoDigits(birth.month)}-${twoDigits(birth.day)}`;
}

/** Birth date of a person: `YYYY-MM-DD` or `--MM-DD`, not after today; empty → null. */
export const birthDateSchema = z
  .union([z.literal(''), z.string()])
  .nullable()
  .transform((value) => value || null)
  .refine((value) => value === null || readBirthDate(value) !== null, 'Date de naissance invalide.')
  .refine((value) => {
    const birth = readBirthDate(value);
    return !birth || birth.year === null || birthDateText(birth) <= dayIn(new Date(), PARIS_ZONE);
  }, 'La date de naissance ne peut pas être à venir.');

/**
 * Birthday of a year: the day and month of the birth date (29 February: 28 February when the year has none).
 * @param {BirthDate} birth Birth date.
 * @param {number} year Year.
 * @returns {string} YYYY-MM-DD.
 */
export function birthdayIn(birth: BirthDate, year: number): string {
  return dayInMonth(year, birth.month, birth.day);
}

/**
 * Age on a birthday (the years since the birth), null without year of birth.
 * @param {BirthDate} birth Birth date.
 * @param {string} day A birthday (YYYY-MM-DD).
 * @returns {number | null} Age.
 */
export function ageOn(birth: BirthDate, day: string): number | null {
  return birth.year === null ? null : yearOfDay(day) - birth.year;
}

/** A birthday: its day and the age then (null without year of birth). */
export interface Birthday {
  date: string;
  age: number | null;
}

/**
 * Birthdays from one day to another, both included (none before the birth, nor on it).
 * @param {BirthDate} birth Birth date.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {Birthday[]} Birthdays.
 */
export function birthdaysBetween(birth: BirthDate, from: string, to: string): Birthday[] {
  const result: Birthday[] = [];
  for (let year = yearOfDay(from); year <= yearOfDay(to); year += 1) {
    const date = birthdayIn(birth, year);
    const age = ageOn(birth, date);
    if (date >= from && date <= to && (age === null || age > 0)) result.push({ date, age });
  }
  return result;
}

/**
 * Label of a birthday in the calendar and its reminders: « Anniversaire de Paul — 40 ans », the age left out without
 * year of birth.
 * @param {string} name Name of the person.
 * @param {number | null} age Age that day.
 * @returns {string} Label.
 */
export function birthdayLabel(name: string, age: number | null): string {
  return `Anniversaire de ${name}${age === null ? '' : ` — ${countOf(age, 'an')}`}`;
}
