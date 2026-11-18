import { addDays, formatDay, monthOfYear, quarterOf, yearOfDay } from './days';

/** Calendar periods: a month, a quarter, a year. */
export const CALENDAR_SCALES = ['month', 'quarter', 'year'] as const;
export type CalendarScale = (typeof CALENDAR_SCALES)[number];

/** Name of each length of a period, from the day to the year (« Mois », « Trimestre »…). */
export const SCALE_LABELS = { day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre', year: 'Année' } as const;

/** The calendar scales with their name, for a choice (SegmentedControl). */
export const CALENDAR_SCALE_OPTIONS: { value: CalendarScale; label: string }[] = CALENDAR_SCALES.map((value) => ({ value, label: SCALE_LABELS[value] }));

/** Months in a period of each scale. */
const MONTHS: Record<CalendarScale, number> = { month: 1, quarter: 3, year: 12 };

/**
 * First day of a month, the months overflowing the year (month 12 is january of the next one).
 * @param {number} year Year.
 * @param {number} month Month, from 0.
 * @returns {string} YYYY-MM-DD.
 */
const firstDay = (year: number, month: number) => formatDay(new Date(Date.UTC(year, month, 1)));

/**
 * First day of the month, quarter or year of a day.
 * @param {CalendarScale} scale Scale.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} First day.
 */
export function calendarStart(scale: CalendarScale, day: string): string {
  const year = yearOfDay(day);
  const month = monthOfYear(day) - 1;
  if (scale === 'year') return `${year}-01-01`;
  return firstDay(year, scale === 'quarter' ? (quarterOf(day) - 1) * 3 : month);
}

/**
 * First day of the month, quarter or year after (or before) another one.
 * @param {CalendarScale} scale Scale.
 * @param {string} start First day of a period.
 * @param {number} delta Periods to move (negative: back).
 * @returns {string} First day.
 */
export function shiftCalendar(scale: CalendarScale, start: string, delta: number): string {
  return firstDay(yearOfDay(start), monthOfYear(start) - 1 + delta * MONTHS[scale]);
}

/**
 * Last day of the month, quarter or year starting on a day.
 * @param {CalendarScale} scale Scale.
 * @param {string} start First day of the period.
 * @returns {string} Last day.
 */
export function calendarEnd(scale: CalendarScale, start: string): string {
  return addDays(shiftCalendar(scale, start, 1), -1);
}
