import {
  addDays,
  calendarEventInputSchema,
  daysBetween,
  formatDay,
  occurrenceDates,
  occurrencesBefore,
  parseDay,
  recurrenceSchema,
  zonedInstant,
  type CalendarEventInput,
  type EventScope,
  type Recurrence,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type CalendarEvent, type CalendarEventException } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

export interface CalendarLink {
  url: string;
  label: string;
}

/** One occurrence of an event in a period, with the fields of its series (or of its own changes). */
export interface EventOccurrence {
  /** Unique key: the event id, followed by the occurrence date for a recurring event. */
  key: string;
  eventId: string;
  /** Date of the occurrence in its series (null for a one-off event). */
  occurrenceDate: string | null;
  /** Changed on its own. */
  modified: boolean;
  title: string;
  description: string | null;
  location: string | null;
  links: CalendarLink[];
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  timeZone: string;
  /** Start and end instants (midnight UTC of the dates for an all-day event). */
  start: Date;
  end: Date;
  recurrence: Recurrence | null;
  /** First date of the series. */
  seriesStartDate: string;
  reminders: number[];
  projectId: string | null;
  contributorIds: string[];
  categoryIds: string[];
  /** Cancelled but kept in the calendar. */
  calledOff: boolean;
  /** Event (and occurrence) this one postpones. */
  postponedFrom: { eventId: string; date: string | null; title: string } | null;
  /** Events postponing this occurrence. */
  postponedTo: { eventId: string; title: string; startDate: string; startTime: string | null }[];
}

type EventWithRelations = CalendarEvent & {
  exceptions: CalendarEventException[];
  contributors: { id: string }[];
  categories: { id: string }[];
  postponedFrom: { title: string } | null;
  postponements: { id: string; title: string; startDate: Date; startTime: string | null; postponedFromDate: Date | null }[];
};

const occurrenceInclude = {
  exceptions: true,
  contributors: { select: { id: true } },
  categories: { select: { id: true } },
  postponedFrom: { select: { title: true } },
  postponements: { select: { id: true, title: true, startDate: true, startTime: true, postponedFromDate: true } },
} as const;

/**
 * Validated recurrence rule stored in JSON, or null.
 * @param {unknown} value JSON value.
 * @returns {Recurrence | null} Rule.
 */
export function storedRecurrence(value: unknown): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Validates event fields and the project, contributors and categories they point to.
 * @param {CalendarEventInput} input Event fields.
 * @returns {Promise<ReturnType<typeof calendarEventInputSchema.parse>>} Validated fields.
 */
async function parseEvent(input: CalendarEventInput) {
  const event = parseInput(calendarEventInputSchema, input);
  if (event.projectId && !(await prisma.project.findUnique({ where: { id: event.projectId }, select: { id: true } }))) {
    throw notFound('Projet');
  }
  if ((await prisma.contributor.count({ where: { id: { in: event.contributorIds } } })) !== new Set(event.contributorIds).size) {
    throw notFound('Contributeur');
  }
  if ((await prisma.calendarCategory.count({ where: { id: { in: event.categoryIds } } })) !== new Set(event.categoryIds).size) {
    throw notFound('Catégorie');
  }
  if (event.allDay) {
    event.startTime = null;
    event.endTime = null;
  }
  return event;
}

/**
 * Prisma data of validated event fields.
 * @param {Awaited<ReturnType<typeof parseEvent>>} event Fields.
 * @returns {object} Scalar data and relations.
 */
function eventData(event: Awaited<ReturnType<typeof parseEvent>>) {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    links: event.links,
    allDay: event.allDay,
    startDate: parseDay(event.startDate),
    startTime: event.startTime,
    endDate: parseDay(event.endDate),
    endTime: event.endTime,
    timeZone: event.timeZone,
    recurrence: (event.recurrence ?? undefined) as Prisma.InputJsonValue | undefined,
    reminders: [...new Set(event.reminders)].sort((a, b) => a - b),
    projectId: event.projectId,
  };
}

/**
 * Loads an event or throws NOT_FOUND.
 * @param {string} id Event id.
 * @returns {Promise<CalendarEvent>} Event.
 */
async function findEvent(id: string): Promise<CalendarEvent> {
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event) throw notFound('Évènement');
  return event;
}

/**
 * Creates an event.
 * @param {CalendarEventInput} input Event.
 * @returns {Promise<CalendarEvent>} Event.
 */
export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const event = await parseEvent(input);
  return prisma.calendarEvent.create({
    data: {
      ...eventData(event),
      recurrence: event.recurrence ?? undefined,
      contributors: { connect: event.contributorIds.map((id) => ({ id })) },
      categories: { connect: event.categoryIds.map((id) => ({ id })) },
    },
  });
}

/**
 * Checks the occurrence a scoped change applies to.
 * @param {CalendarEvent} event Event.
 * @param {string | null | undefined} occurrenceDate Occurrence.
 * @returns {{ rule: Recurrence, date: string } | null} Rule and date, or null for a one-off event.
 */
function occurrenceOf(event: CalendarEvent, occurrenceDate: string | null | undefined): { rule: Recurrence; date: string } | null {
  const rule = storedRecurrence(event.recurrence);
  if (!rule) return null;
  if (!occurrenceDate) throw clientError('BAD_USER_INPUT', 'Occurrence manquante.');
  return { rule, date: occurrenceDate };
}

/**
 * Ends a series the day before a date (its count is reduced accordingly) and drops its changes from then.
 * @param {CalendarEvent} event Series.
 * @param {Recurrence} rule Its rule.
 * @param {string} date First date no longer in the series.
 * @param {Prisma.TransactionClient} tx Transaction.
 * @returns {Promise<void>}
 */
async function endSeriesBefore(event: CalendarEvent, rule: Recurrence, date: string, tx: Prisma.TransactionClient): Promise<void> {
  const start = formatDay(event.startDate);
  const ended: Recurrence =
    rule.count !== null ? { ...rule, count: Math.max(1, occurrencesBefore(rule, start, date)) } : { ...rule, until: addDays(date, -1) };
  await tx.calendarEvent.update({ where: { id: event.id }, data: { recurrence: ended } });
  await tx.calendarEventException.deleteMany({ where: { eventId: event.id, date: { gte: parseDay(date) } } });
}

/**
 * Updates an event. For a recurring event, the change applies to one occurrence (THIS: project,
 * contributors and categories stay those of the series), to it and the following ones (FOLLOWING: the
 * series is split), or to the whole series (ALL: dates moved by as much as the occurrence was).
 * @param {string} id Event id.
 * @param {CalendarEventInput} input New fields (dates of the occurrence).
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence changed. Optional for a one-off event.
 * @returns {Promise<CalendarEvent>} Updated (or new, after a split) event.
 */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
  scope: EventScope,
  occurrenceDate?: string | null,
): Promise<CalendarEvent> {
  const event = await findEvent(id);
  const fields = await parseEvent(input);
  const occurrence = occurrenceOf(event, occurrenceDate);
  const relations = {
    contributors: { set: fields.contributorIds.map((contributorId) => ({ id: contributorId })) },
    categories: { set: fields.categoryIds.map((categoryId) => ({ id: categoryId })) },
  };

  if (!occurrence) {
    return prisma.calendarEvent.update({ where: { id }, data: { ...eventData(fields), recurrence: fields.recurrence ?? Prisma.JsonNull, ...relations } });
  }
  const seriesStart = formatDay(event.startDate);

  if (scope === 'THIS') {
    const override = {
      cancelled: false,
      title: fields.title,
      description: fields.description,
      location: fields.location,
      links: fields.links,
      allDay: fields.allDay,
      startDate: parseDay(fields.startDate),
      startTime: fields.startTime,
      endDate: parseDay(fields.endDate),
      endTime: fields.endTime,
    };
    await prisma.calendarEventException.upsert({
      where: { eventId_date: { eventId: id, date: parseDay(occurrence.date) } },
      create: { eventId: id, date: parseDay(occurrence.date), ...override },
      update: override,
    });
    return event;
  }

  if (scope === 'ALL' || occurrence.date === seriesStart) {
    // The series moves by as much as the occurrence did; its changes no longer match once moved.
    const shift = daysBetween(occurrence.date, fields.startDate);
    const startDate = addDays(seriesStart, shift);
    const endDate = addDays(startDate, daysBetween(fields.startDate, fields.endDate));
    return prisma.$transaction(async (tx) => {
      if (shift !== 0) await tx.calendarEventException.deleteMany({ where: { eventId: id } });
      return tx.calendarEvent.update({
        where: { id },
        data: {
          ...eventData(fields),
          startDate: parseDay(startDate),
          endDate: parseDay(endDate),
          recurrence: fields.recurrence ?? Prisma.JsonNull,
          ...relations,
        },
      });
    });
  }

  // FOLLOWING: the series ends before the occurrence, a new one starts with the changes.
  return prisma.$transaction(async (tx) => {
    await endSeriesBefore(event, occurrence.rule, occurrence.date, tx);
    let rule = fields.recurrence;
    if (rule && rule.count !== null && occurrence.rule.count === rule.count) {
      rule = { ...rule, count: Math.max(1, rule.count - occurrencesBefore(occurrence.rule, seriesStart, occurrence.date)) };
    }
    return tx.calendarEvent.create({
      data: {
        ...eventData(fields),
        recurrence: rule ?? undefined,
        contributors: { connect: fields.contributorIds.map((contributorId) => ({ id: contributorId })) },
        categories: { connect: fields.categoryIds.map((categoryId) => ({ id: categoryId })) },
      },
    });
  });
}

/**
 * Deletes an event, or for a recurring one: one occurrence, it and the following ones, or the whole series.
 * @param {string} id Event id.
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence. Optional for a one-off event.
 * @returns {Promise<void>}
 */
export async function deleteCalendarEvent(id: string, scope: EventScope, occurrenceDate?: string | null): Promise<void> {
  const event = await findEvent(id);
  const occurrence = occurrenceOf(event, occurrenceDate);
  if (!occurrence || scope === 'ALL' || (scope === 'FOLLOWING' && occurrence.date === formatDay(event.startDate))) {
    await prisma.calendarEvent.delete({ where: { id } });
    return;
  }
  if (scope === 'THIS') {
    await prisma.calendarEventException.upsert({
      where: { eventId_date: { eventId: id, date: parseDay(occurrence.date) } },
      create: { eventId: id, date: parseDay(occurrence.date), cancelled: true },
      update: { cancelled: true },
    });
    return;
  }
  await prisma.$transaction((tx) => endSeriesBefore(event, occurrence.rule, occurrence.date, tx));
}

/**
 * Occurrence of an event on a date, with its own changes.
 * @param {EventWithRelations} event Event.
 * @param {string | null} date Occurrence date (null for a one-off event).
 * @param {CalendarEventException | undefined} change Own changes.
 * @returns {EventOccurrence} Occurrence.
 */
function toOccurrence(event: EventWithRelations, date: string | null, change: CalendarEventException | undefined): EventOccurrence {
  const seriesStart = formatDay(event.startDate);
  const span = daysBetween(seriesStart, formatDay(event.endDate));
  const allDay = change?.allDay ?? event.allDay;
  const startDate = change?.startDate ? formatDay(change.startDate) : (date ?? seriesStart);
  const endDate = change?.endDate ? formatDay(change.endDate) : addDays(startDate, span);
  const startTime = allDay ? null : (change ? change.startTime : event.startTime);
  const endTime = allDay ? null : (change ? change.endTime : event.endTime);
  const instant = (day: string, time: string | null) => (time ? zonedInstant(day, time, event.timeZone) : parseDay(day));
  return {
    key: date ? `${event.id}:${date}` : event.id,
    eventId: event.id,
    occurrenceDate: date,
    modified: change !== undefined,
    title: change?.title ?? event.title,
    description: change ? change.description : event.description,
    location: change ? change.location : event.location,
    links: ((change?.links ?? event.links) as unknown as CalendarLink[]) ?? [],
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    timeZone: event.timeZone,
    start: instant(startDate, startTime),
    end: allDay ? parseDay(addDays(endDate, 1)) : instant(endDate, endTime),
    recurrence: storedRecurrence(event.recurrence),
    seriesStartDate: seriesStart,
    reminders: event.reminders,
    projectId: event.projectId,
    contributorIds: event.contributors.map((contributor) => contributor.id),
    categoryIds: event.categories.map((category) => category.id),
    calledOff: event.calledOff || (change?.calledOff ?? false),
    postponedFrom: event.postponedFromId
      ? { eventId: event.postponedFromId, date: event.postponedFromDate ? formatDay(event.postponedFromDate) : null, title: event.postponedFrom?.title ?? '' }
      : null,
    postponedTo: event.postponements
      .filter((postponement) => (postponement.postponedFromDate ? formatDay(postponement.postponedFromDate) : null) === date)
      .map((postponement) => ({ eventId: postponement.id, title: postponement.title, startDate: formatDay(postponement.startDate), startTime: postponement.startTime })),
  };
}

/**
 * Occurrences of the events overlapping a period (dates included).
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {Promise<EventOccurrence[]>} Occurrences, by start.
 */
export async function eventOccurrences(from: string, to: string): Promise<EventOccurrence[]> {
  const events = await prisma.calendarEvent.findMany({
    // Recurring events may occur in the period whatever their first date.
    where: { startDate: { lte: parseDay(addDays(to, 62)) }, OR: [{ recurrence: { not: Prisma.DbNull } }, { endDate: { gte: parseDay(addDays(from, -62)) } }] },
    include: occurrenceInclude,
  });
  const result: EventOccurrence[] = [];
  for (const event of events) {
    const rule = storedRecurrence(event.recurrence);
    const changes = new Map(event.exceptions.map((change) => [formatDay(change.date), change]));
    const span = daysBetween(formatDay(event.startDate), formatDay(event.endDate));
    // Moved occurrences may come from a little outside the period.
    const dates = rule ? occurrenceDates(rule, formatDay(event.startDate), addDays(from, -span - 62), addDays(to, 62)) : [null];
    for (const date of dates) {
      const change = date ? changes.get(date) : undefined;
      if (change?.cancelled) continue;
      const occurrence = toOccurrence(event, date, change);
      if (occurrence.endDate >= from && occurrence.startDate <= to) result.push(occurrence);
    }
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}


/**
 * Fields of a series (or one-off event) moved to start on a date, as an input of a change.
 * @param {EventWithRelations} event Event.
 * @param {string} date New first date.
 * @returns {CalendarEventInput} Input.
 */
function seriesInput(event: EventWithRelations, date: string): CalendarEventInput {
  const span = daysBetween(formatDay(event.startDate), formatDay(event.endDate));
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    links: (event.links as unknown as CalendarLink[]) ?? [],
    allDay: event.allDay,
    startDate: date,
    startTime: event.startTime,
    endDate: addDays(date, span),
    endTime: event.endTime,
    timeZone: event.timeZone,
    recurrence: storedRecurrence(event.recurrence),
    reminders: event.reminders,
    projectId: event.projectId,
    contributorIds: event.contributors.map((contributor) => contributor.id),
    categoryIds: event.categories.map((category) => category.id),
  };
}

/**
 * Loads an event with what its occurrences need, or throws NOT_FOUND.
 * @param {string} id Event id.
 * @returns {Promise<EventWithRelations>} Event.
 */
async function findEventWithRelations(id: string): Promise<EventWithRelations> {
  const event = await prisma.calendarEvent.findUnique({ where: { id }, include: occurrenceInclude });
  if (!event) throw notFound('Évènement');
  return event;
}

/**
 * Cancels an event, keeping it in the calendar struck through, or restores it. For a recurring event: one
 * occurrence, it and the following ones (the series is split), or the whole series.
 * @param {string} id Event id.
 * @param {EventScope} scope Scope.
 * @param {string | null | undefined} occurrenceDate Occurrence. Optional for a one-off event.
 * @param {boolean} calledOff Cancelled (true) or restored (false).
 * @returns {Promise<void>}
 */
export async function setEventCalledOff(id: string, scope: EventScope, occurrenceDate: string | null | undefined, calledOff: boolean): Promise<void> {
  const event = await findEventWithRelations(id);
  const occurrence = occurrenceOf(event, occurrenceDate);
  if (!occurrence || scope === 'ALL') {
    await prisma.$transaction([
      prisma.calendarEvent.update({ where: { id }, data: { calledOff } }),
      // The whole series: its occurrences follow.
      prisma.calendarEventException.updateMany({ where: { eventId: id }, data: { calledOff } }),
    ]);
    return;
  }
  if (scope === 'THIS') {
    const existing = event.exceptions.find((change) => formatDay(change.date) === occurrence.date);
    // A restored occurrence of a cancelled series stays cancelled with it: only its own flag changes.
    if (existing) {
      await prisma.calendarEventException.update({ where: { id: existing.id }, data: { calledOff } });
      return;
    }
    // The exception keeps the fields of the occurrence (an exception overrides them all).
    const current = toOccurrence(event, occurrence.date, undefined);
    await prisma.calendarEventException.create({
      data: {
        eventId: id,
        date: parseDay(occurrence.date),
        calledOff,
        title: current.title,
        description: current.description,
        location: current.location,
        links: current.links as unknown as Prisma.InputJsonValue,
        allDay: current.allDay,
        startDate: parseDay(current.startDate),
        startTime: current.startTime,
        endDate: parseDay(current.endDate),
        endTime: current.endTime,
      },
    });
    return;
  }
  // FOLLOWING: the series is split at the occurrence, the new one carries the state.
  const split = await updateCalendarEvent(id, seriesInput(event, occurrence.date), 'FOLLOWING', occurrence.date);
  await prisma.calendarEvent.update({ where: { id: split.id }, data: { calledOff } });
}

/**
 * Postpones an event (one occurrence of a recurring one): it is cancelled and kept struck through, and a new
 * one-off event, linked to it, takes the new date.
 * @param {string} id Event id.
 * @param {string | null | undefined} occurrenceDate Occurrence. Optional for a one-off event.
 * @param {CalendarEventInput} input New event (its dates, title…).
 * @returns {Promise<CalendarEvent>} New event.
 */
export async function postponeCalendarEvent(id: string, occurrenceDate: string | null | undefined, input: CalendarEventInput): Promise<CalendarEvent> {
  const event = await findEvent(id);
  const occurrence = occurrenceOf(event, occurrenceDate);
  const fields = await parseEvent({ ...input, recurrence: null });
  const created = await prisma.calendarEvent.create({
    data: {
      ...eventData(fields),
      recurrence: undefined,
      postponedFromId: id,
      postponedFromDate: occurrence ? parseDay(occurrence.date) : null,
      contributors: { connect: fields.contributorIds.map((contributorId) => ({ id: contributorId })) },
      categories: { connect: fields.categoryIds.map((categoryId) => ({ id: categoryId })) },
    },
  });
  await setEventCalledOff(id, 'THIS', occurrence?.date ?? null, true);
  return created;
}
