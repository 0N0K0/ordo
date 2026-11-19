import { addDays, dayOfMonthOf, fileName, formatDay, occurrenceDates, type ItemLink, type Recurrence, ruleValues, weekdayOfDate, zonedInstant } from '@ordo/shared';
import { prisma } from '../../db';
import { orNotFound } from '../../graphql/errors';
import { occurrenceInclude, storedRecurrence, toOccurrence, type EventWithRelations } from './calendar-events';
import { readLinks } from '../core/links';
import { PARIS } from '../../today';

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
 * Property of a moment: a date for an all-day event, a Paris time otherwise (every event is in Paris time).
 * @param {string} name Property (DTSTART…).
 * @param {string} day YYYY-MM-DD.
 * @param {string | null} time HH:MM, null for an all-day event.
 * @returns {string} Content line.
 */
function moment(name: string, day: string, time: string | null): string {
  return time ? `${name};TZID=${PARIS}:${icsDateTime(day, time)}` : `${name};VALUE=DATE:${icsDate(day)}`;
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
  const day = ruleValues(rule, start).monthDay;
  if (day <= 28 || rule.monthlyMode !== 'DAY' || (rule.frequency !== 'YEARLY' && rule.frequency !== 'MONTHLY')) return [];
  const horizon = addDays(start, 366 * HORIZON_YEARS);
  const pattern = { ...rule, count: null, until: null, exceptions: [], pauses: [] };
  return occurrenceDates(pattern, start, start, until && until < horizon ? until : horizon).filter((date) => dayOfMonthOf(date) !== day);
}

/**
 * RRULE of a rule, ending on its last occurrence (a count of Ordo leaves out paused and excluded dates, an
 * iCalendar count does not: the end date keeps the same occurrences).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string | null} time Time of the occurrences (none: all day), in Paris time.
 * @returns {string[]} RRULE content line, and RDATE ones for the months lacking the day.
 */
function rrule(rule: Recurrence, start: string, time: string | null): string[] {
  // Values of the monthly and yearly modes: chosen, else those of the first date.
  const values = ruleValues(rule, start);
  const parts = [`FREQ=${rule.frequency}`, `INTERVAL=${rule.interval}`];
  if (rule.frequency === 'WEEKLY') {
    parts.push(`BYDAY=${(rule.weekdays.length ? rule.weekdays : [weekdayOfDate(start)]).map((day) => WEEKDAYS[day - 1]).join(',')}`, 'WKST=MO');
  }
  if (rule.frequency === 'MONTHLY') {
    if (rule.monthlyMode === 'WEEKDAY') parts.push(`BYDAY=${values.position}${WEEKDAYS[values.weekday - 1]}`);
    else parts.push(`BYMONTHDAY=${values.monthDay}`);
  }
  if (rule.frequency === 'YEARLY') {
    if (rule.monthlyMode === 'WEEK') parts.push(`BYWEEKNO=${values.week}`, `BYDAY=${WEEKDAYS[values.weekday - 1]}`, 'WKST=MO');
    else if (rule.monthlyMode === 'WEEKDAY') parts.push(`BYMONTH=${values.month}`, `BYDAY=${values.position}${WEEKDAYS[values.weekday - 1]}`);
    else parts.push(`BYMONTH=${values.month}`, `BYMONTHDAY=${values.monthDay}`);
  }
  let until = rule.until;
  if (rule.count !== null) {
    const dates = occurrenceDates(rule, start, start, addDays(start, 366 * 100));
    until = dates.at(-1) ?? start;
  }
  // With a time zone, the end is in UTC (RFC 5545): the end of its last day.
  if (until) parts.push(`UNTIL=${time ? icsStamp(zonedInstant(until, '23:59', PARIS)) : icsDate(until)}`);
  return [`RRULE:${parts.join(';')}`, ...clampedDates(rule, start, until).map((date) => moment('RDATE', date, time))];
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
 * Travel time to an event, as Apple Calendar reads it (others ignore it; the way back has no property).
 * @param {number} minutes Travel time to the event.
 * @returns {string[]} Content lines, none without travel.
 */
function travel(minutes: number): string[] {
  return minutes > 0 ? [`X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT${minutes}M`] : [];
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

type ExportedEvent = Omit<EventWithRelations, 'categories'> & { categories: { id: string; label: string }[] };

/**
 * VEVENT blocks of an event: the series (with its repetition and the dates that do not occur) and its occurrences
 * changed on their own.
 * @param {ExportedEvent} event Event.
 * @param {Date} stamp Time of the export.
 * @returns {string[]} Content lines.
 */
function eventLines(event: ExportedEvent, stamp: Date): string[] {
  const start = formatDay(event.startDate);
  const rule = storedRecurrence(event.recurrence);
  const uid = `${event.id}@ordo`;

  /**
   * Fields of an occurrence (the series, or one changed on its own).
   * @param {object} fields Fields.
   * @returns {string[]} Content lines.
   */
  const body = (fields: {
    label: string;
    links: ItemLink[];
    description: string | null;
    location: string | null;
    allDay: boolean;
    startDate: string;
    startTime: string | null;
    endDate: string;
    endTime: string | null;
    calledOff: boolean;
  }) => [
    `SUMMARY:${text(fields.label)}`,
    ...(fields.description || fields.links.length
      ? [`DESCRIPTION:${text([...(fields.description ? [fields.description] : []), ...fields.links.map((link) => `${link.label}: ${link.url}`)].join('\n'))}`]
      : []),
    ...(fields.location ? [`LOCATION:${text(fields.location)}`] : []),
    ...(fields.links[0] ? [`URL:${fields.links[0].url}`] : []),
    moment('DTSTART', fields.startDate, fields.allDay ? null : fields.startTime),
    // All-day: the end date is exclusive.
    fields.allDay ? moment('DTEND', addDays(fields.endDate, 1), null) : moment('DTEND', fields.endDate, fields.endTime),
    ...(fields.calledOff ? ['STATUS:CANCELLED'] : ['STATUS:CONFIRMED']),
  ];

  const series = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(stamp)}`,
    `LAST-MODIFIED:${icsStamp(event.updatedAt)}`,
    ...body({
      label: event.label,
      links: readLinks(event.links),
      description: event.description,
      location: event.location,
      allDay: event.allDay,
      startDate: start,
      startTime: event.startTime,
      endDate: formatDay(event.endDate),
      endTime: event.endTime,
      calledOff: event.calledOff,
    }),
    ...(event.categories.length ? [`CATEGORIES:${event.categories.map((category) => text(category.label)).join(',')}`] : []),
  ];
  if (rule) {
    const time = event.allDay ? null : event.startTime;
    series.push(...rrule(rule, start, time));
    const excluded = excludedDates(
      rule,
      start,
      event.exceptions.filter((change) => change.cancelled).map((change) => formatDay(change.date)),
    );
    for (const date of excluded) series.push(moment('EXDATE', date, time));
  }
  series.push(...travel(event.allDay ? 0 : event.travelBefore), ...alarms(event.reminders, event.label), 'END:VEVENT');

  // Occurrences changed on their own: the same event at its original date (RECURRENCE-ID), as the app shows them.
  const changed = rule
    ? event.exceptions
        .filter((change) => !change.cancelled)
        .flatMap((change) => {
          const date = formatDay(change.date);
          const occurrence = toOccurrence(event, date, change);
          return [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${icsStamp(stamp)}`,
            moment('RECURRENCE-ID', date, event.allDay ? null : event.startTime),
            ...body(occurrence),
            ...travel(occurrence.allDay ? 0 : occurrence.travelBefore),
            ...alarms(event.reminders, occurrence.label),
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
 * @returns {Promise<{ filename: string, content: string }>} File name and content (as the other exports).
 */
export async function calendarIcs(calendarId: string | null): Promise<{ filename: string; content: string }> {
  const calendar = calendarId ? await orNotFound(prisma.calendar.findUnique({ where: { id: calendarId }, select: { label: true } }), 'Calendrier') : null;
  const events = await prisma.calendarEvent.findMany({
    // Archived events left out, and the archived calendars from the file of all of them.
    where: calendarId ? { calendarId, archivedAt: null } : { archivedAt: null, calendar: { archivedAt: null } },
    include: { ...occurrenceInclude, categories: { select: { id: true, label: true } } },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
  });
  const name = calendar?.label ?? 'Agenda';
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
  return { filename: fileName(name, 'ics'), content: `${lines.map(fold).join('\r\n')}\r\n` };
}
