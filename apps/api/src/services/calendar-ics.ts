import { addDays, formatDay, occurrenceDates, zonedInstant, type Recurrence } from '@ordo/shared';
import { prisma } from '../db';
import type { CalendarEvent, CalendarEventException } from '../generated/prisma/client';
import { notFound } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';

/** Repeated events without end are written with their exclusions up to this many years ahead. */
const HORIZON_YEARS = 10;
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/**
 * Text of an iCalendar value: backslashes, semicolons, commas and line breaks escaped.
 * @param {string} value Text.
 * @returns {string} Escaped text.
 */
function text(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/**
 * Content line folded at 75 octets (RFC 5545), continuation lines starting with a space.
 * @param {string} line Line.
 * @returns {string} Folded line.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (parts.length ? 74 : 75), bytes.length);
    // Never split a UTF-8 character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

/**
 * YYYYMMDD of a calendar date.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} iCalendar date.
 */
const icsDate = (day: string) => day.replaceAll('-', '');

/**
 * Local date-time of a date and an HH:MM time.
 * @param {string} day YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @returns {string} YYYYMMDDTHHMM00.
 */
const icsDateTime = (day: string, time: string) => `${icsDate(day)}T${time.replace(':', '')}00`;

/**
 * UTC timestamp.
 * @param {Date} date Instant.
 * @returns {string} YYYYMMDDTHHMMSSZ.
 */
const icsStamp = (date: Date) => `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

/**
 * Property of a moment: a date for an all-day event, a local time in the event's time zone otherwise.
 * @param {string} name Property (DTSTART…).
 * @param {string} day YYYY-MM-DD.
 * @param {string | null} time HH:MM, null for an all-day event.
 * @param {string} timeZone IANA time zone.
 * @returns {string} Content line.
 */
function moment(name: string, day: string, time: string | null, timeZone: string): string {
  return time ? `${name};TZID=${timeZone}:${icsDateTime(day, time)}` : `${name};VALUE=DATE:${icsDate(day)}`;
}

/**
 * Dates of a rule falling on the last day of a month that lacks its day (the 30th of April for the 31st): the
 * iCalendar rule skips those months, they are added as RDATE (up to the end of the rule, or the horizon).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string | null} until Last date, if any.
 * @returns {string[]} Dates.
 */
function clampedDates(rule: Recurrence, start: string, until: string | null): string[] {
  const day = Number(start.slice(8, 10));
  if (day <= 28 || !(rule.frequency === 'YEARLY' || (rule.frequency === 'MONTHLY' && rule.monthlyMode === 'DAY'))) return [];
  const horizon = addDays(start, 366 * HORIZON_YEARS);
  const pattern = { ...rule, count: null, until: null, exceptions: [], pauses: [] };
  return occurrenceDates(pattern, start, start, until && until < horizon ? until : horizon).filter((date) => Number(date.slice(8, 10)) !== day);
}

/**
 * RRULE of a rule, ending on its last occurrence (a count of Ordo leaves out paused and excluded dates, an
 * iCalendar count does not: the end date keeps the same occurrences).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string | null} time Time of the occurrences (none: all day).
 * @param {string} timeZone Time zone of the times.
 * @returns {string[]} RRULE content line, and RDATE ones for the months lacking the day.
 */
function rrule(rule: Recurrence, start: string, time: string | null, timeZone: string): string[] {
  const first = new Date(`${start}T00:00:00Z`);
  const isoWeekday = ((first.getUTCDay() + 6) % 7) + 1;
  const parts = [`FREQ=${rule.frequency}`, `INTERVAL=${rule.interval}`];
  if (rule.frequency === 'WEEKLY') {
    parts.push(`BYDAY=${(rule.weekdays.length ? rule.weekdays : [isoWeekday]).map((day) => WEEKDAYS[day - 1]).join(',')}`, 'WKST=MO');
  }
  if (rule.frequency === 'MONTHLY') {
    if (rule.monthlyMode === 'WEEKDAY') {
      const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const position = first.getUTCDate() + 7 > daysInMonth ? -1 : Math.ceil(first.getUTCDate() / 7);
      parts.push(`BYDAY=${position}${WEEKDAYS[isoWeekday - 1]}`);
    } else parts.push(`BYMONTHDAY=${first.getUTCDate()}`);
  }
  if (rule.frequency === 'YEARLY') parts.push(`BYMONTH=${first.getUTCMonth() + 1}`, `BYMONTHDAY=${first.getUTCDate()}`);
  let until = rule.until;
  if (rule.count !== null) {
    const dates = occurrenceDates(rule, start, start, addDays(start, 366 * 100));
    until = dates.at(-1) ?? start;
  }
  // With a time zone, the end is in UTC (RFC 5545): the end of its last day.
  if (until) parts.push(`UNTIL=${time ? icsStamp(zonedInstant(until, '23:59', timeZone)) : icsDate(until)}`);
  return [`RRULE:${parts.join(';')}`, ...clampedDates(rule, start, until).map((date) => moment('RDATE', date, time, timeZone))];
}

/**
 * Dates of the pattern of a rule that do not occur: excluded dates, and those of its paused periods.
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string[]} cancelled Occurrences deleted (exceptions marked cancelled).
 * @returns {string[]} Dates.
 */
function excludedDates(rule: Recurrence, start: string, cancelled: string[]): string[] {
  const pattern = { ...rule, count: null, exceptions: [], pauses: [] };
  const horizon = addDays(start, 366 * HORIZON_YEARS);
  const paused = rule.pauses.flatMap((pause) => occurrenceDates(pattern, start, pause.from, pause.to < horizon ? pause.to : horizon));
  return [...new Set([...rule.exceptions, ...paused, ...cancelled])].filter((date) => date >= start).sort();
}

/**
 * Alarms of an event: one per reminder.
 * @param {number[]} reminders Minutes before the start.
 * @param {string} summary Title.
 * @returns {string[]} Content lines.
 */
function alarms(reminders: number[], summary: string): string[] {
  return reminders.flatMap((minutes) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(summary)}`, `TRIGGER:-PT${minutes}M`, 'END:VALARM']);
}

type ExportedEvent = CalendarEvent & { exceptions: CalendarEventException[]; categories: { name: string }[] };

/**
 * VEVENT blocks of an event: the series (with its repetition and the dates that do not occur) and its occurrences
 * changed on their own.
 * @param {ExportedEvent} event Event.
 * @param {Date} stamp Time of the export.
 * @returns {string[]} Content lines.
 */
function eventLines(event: ExportedEvent, stamp: Date): string[] {
  const start = formatDay(event.startDate);
  const span = Math.round((event.endDate.getTime() - event.startDate.getTime()) / 86_400_000);
  const rule = storedRecurrence(event.recurrence);
  const uid = `${event.id}@ordo`;
  const links = (event.links as { url: string; label: string }[] | null) ?? [];

  /**
   * Fields of an occurrence (the series, or one changed on its own).
   * @param {object} fields Fields.
   * @returns {string[]} Content lines.
   */
  const body = (fields: {
    title: string;
    description: string | null;
    location: string | null;
    allDay: boolean;
    startDate: string;
    startTime: string | null;
    endDate: string;
    endTime: string | null;
    calledOff: boolean;
  }) => [
    `SUMMARY:${text(fields.title)}`,
    ...(fields.description
      ? [`DESCRIPTION:${text([fields.description, ...links.map((link) => `${link.label}: ${link.url}`)].join('\n'))}`]
      : links.length
        ? [`DESCRIPTION:${text(links.map((link) => `${link.label}: ${link.url}`).join('\n'))}`]
        : []),
    ...(fields.location ? [`LOCATION:${text(fields.location)}`] : []),
    ...(links[0] ? [`URL:${links[0].url}`] : []),
    moment('DTSTART', fields.startDate, fields.allDay ? null : fields.startTime, event.timeZone),
    // All-day: the end date is exclusive.
    fields.allDay ? moment('DTEND', addDays(fields.endDate, 1), null, event.timeZone) : moment('DTEND', fields.endDate, fields.endTime, event.timeZone),
    ...(fields.calledOff ? ['STATUS:CANCELLED'] : ['STATUS:CONFIRMED']),
  ];

  const series = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(stamp)}`,
    `LAST-MODIFIED:${icsStamp(event.updatedAt)}`,
    ...body({
      title: event.title,
      description: event.description,
      location: event.location,
      allDay: event.allDay,
      startDate: start,
      startTime: event.startTime,
      endDate: formatDay(event.endDate),
      endTime: event.endTime,
      calledOff: event.calledOff,
    }),
    ...(event.categories.length ? [`CATEGORIES:${event.categories.map((category) => text(category.name)).join(',')}`] : []),
  ];
  if (rule) {
    const time = event.allDay ? null : event.startTime;
    series.push(...rrule(rule, start, time, event.timeZone));
    const excluded = excludedDates(
      rule,
      start,
      event.exceptions.filter((change) => change.cancelled).map((change) => formatDay(change.date)),
    );
    for (const date of excluded) series.push(moment('EXDATE', date, time, event.timeZone));
  }
  series.push(...alarms(event.reminders, event.title), 'END:VEVENT');

  // Occurrences changed on their own: the same event at its original date (RECURRENCE-ID).
  const changed = rule
    ? event.exceptions
        .filter((change) => !change.cancelled)
        .flatMap((change) => {
          const date = formatDay(change.date);
          const allDay = change.allDay ?? event.allDay;
          const startDate = change.startDate ? formatDay(change.startDate) : date;
          return [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${icsStamp(stamp)}`,
            moment('RECURRENCE-ID', date, event.allDay ? null : event.startTime, event.timeZone),
            ...body({
              title: change.title ?? event.title,
              description: change.description ?? event.description,
              location: change.location ?? event.location,
              allDay,
              startDate,
              startTime: allDay ? null : change.startTime,
              endDate: change.endDate ? formatDay(change.endDate) : addDays(startDate, span),
              endTime: allDay ? null : change.endTime,
              calledOff: event.calledOff || change.calledOff,
            }),
            ...alarms(event.reminders, change.title ?? event.title),
            'END:VEVENT',
          ];
        })
    : [];
  return [...series, ...changed];
}

/**
 * iCalendar file of a calendar of the workspace, or of all of them: its events, repeated ones with their
 * repetition, exclusions and changed occurrences, reminders as alarms.
 * @param {string | null} calendarId Calendar, or null for every calendar of the workspace.
 * @returns {Promise<{ name: string, content: string }>} File name (without extension) and content.
 */
export async function calendarIcs(calendarId: string | null): Promise<{ name: string; content: string }> {
  const calendar = calendarId ? await prisma.calendar.findUnique({ where: { id: calendarId }, select: { name: true } }) : null;
  if (calendarId && !calendar) throw notFound('Calendrier');
  const events = await prisma.calendarEvent.findMany({
    where: calendarId ? { calendarId } : {},
    include: { exceptions: true, categories: { select: { name: true } } },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
  });
  const name = calendar?.name ?? 'Agenda';
  const stamp = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ordo//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    ...events.flatMap((event) => eventLines(event, stamp)),
    'END:VCALENDAR',
  ];
  return { name, content: `${lines.map(fold).join('\r\n')}\r\n` };
}
