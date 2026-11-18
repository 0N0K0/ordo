import {
  addDays,
  type CalendarEventInput,
  calendarEventInputSchema,
  daysBetween,
  entrySeconds,
  type EventScope,
  formatDay,
  formatOptionalDay,
  maxSpanDays,
  occurrenceDates,
  occurrencesBefore,
  parseDay,
  type Recurrence,
  recurrenceSchema,
  sharePeople,
  spanEnd,
  zonedInstant,
} from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type CalendarEvent, type CalendarEventException } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { runInWorkspace } from '../../workspace-context';
import { listSubscriptions, resolveCalendarId } from './calendars';
import { assertActiveContributors, assertActiveRelations, assertProjectContributors } from '../workspace/contributors';
import { assertAllExist, assertExists } from '../core/lookup';
import { assertNoneArchived, assertNotArchived } from '../core/archive';
import { connectIds } from '../core/relations';

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
  label: string;
  description: string | null;
  location: string | null;
  /** Point of the location, when known. */
  locationLat: number | null;
  locationLon: number | null;
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
  /** Travel time to the event and back from it, in minutes. */
  travelBefore: number;
  travelAfter: number;
  projectId: string | null;
  /** Calendar of the event (of its series). */
  calendarId: string;
  /** The event (its series) is archived: hidden by default, read only. */
  archived: boolean;
  contributorIds: string[];
  /** Relations without contributor taking part. */
  relationIds: string[];
  /** « Bénéficiaires »: whom the event is for (contributors, relations). */
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
  categoryIds: string[];
  /** Tasks the event is about. */
  taskIds: string[];
  /** Routines of a day of the occurrence it is about (their occurrence of that day is done during it). */
  routineLinks: { routineId: string; date: string }[];
  /** Cancelled but kept in the calendar. */
  calledOff: boolean;
  /** Event (and occurrence) this one postpones. */
  postponedFrom: { eventId: string; date: string | null; label: string } | null;
  /** Events postponing this occurrence. */
  postponedTo: { eventId: string; label: string; startDate: string; startTime: string | null }[];
  /** Time tracked on this occurrence, in seconds (running timers until now). */
  trackedSeconds: number;
}

/** Event with what its occurrences are built from (`occurrenceInclude`). */
export type EventWithRelations = CalendarEvent & {
  exceptions: CalendarEventException[];
  contributors: { id: string }[];
  relations: { id: string }[];
  beneficiaries: { id: string }[];
  beneficiaryRelations: { id: string }[];
  categories: { id: string }[];
  tasks: { id: string }[];
  routineLinks: { routineId: string; date: Date }[];
  postponedFrom: { label: string } | null;
  postponements: { id: string; label: string; startDate: Date; startTime: string | null; postponedFromDate: Date | null }[];
  timeEntries: { calendarOccurrenceDate: Date | null; startedAt: Date; endedAt: Date | null; pausedAt: Date | null; pausedSeconds: number; duration: number | null }[];
};

/** Prisma `include` of an event for its occurrences (toOccurrence). */
export const occurrenceInclude = {
  exceptions: true,
  contributors: { select: { id: true } },
  relations: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  categories: { select: { id: true } },
  tasks: { select: { id: true } },
  routineLinks: { select: { routineId: true, date: true } },
  postponedFrom: { select: { label: true } },
  postponements: { select: { id: true, label: true, startDate: true, startTime: true, postponedFromDate: true } },
  timeEntries: { select: { calendarOccurrenceDate: true, startedAt: true, endedAt: true, pausedAt: true, pausedSeconds: true, duration: true } },
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
 * Routines linked on the days of an occurrence.
 * @param {{ routineId: string, date: Date }[]} links Links of the event.
 * @param {string} from First day (YYYY-MM-DD).
 * @param {string} to Last day, included.
 * @returns {{ routineId: string, date: string }[]} Links of those days.
 */
function linksWithin(links: readonly { routineId: string; date: Date }[], from: string, to: string): { routineId: string; date: string }[] {
  return links.map((link) => ({ routineId: link.routineId, date: formatDay(link.date) })).filter((link) => link.date >= from && link.date <= to);
}

/**
 * Sets the routines of the days of an occurrence (those of its other days kept): on the event it now belongs to; when
 * an edit split the series, the links of the following days go with the new event.
 * @param {string} formerId Event edited.
 * @param {string} eventId Event the occurrence belongs to after the edit.
 * @param {{ startDate: string, endDate: string, routineLinks: { routineId: string, date: string }[] }} fields Occurrence days and routines.
 * @returns {Promise<void>}
 */
async function saveRoutineLinks(formerId: string | null, eventId: string, fields: { startDate: string; endDate: string; routineLinks: { routineId: string; date: string }[] }): Promise<void> {
  const days = { gte: parseDay(fields.startDate), lte: parseDay(fields.endDate) };
  await prisma.$transaction([
    ...(formerId && formerId !== eventId ? [prisma.calendarEventRoutine.updateMany({ where: { eventId: formerId, date: { gte: parseDay(fields.startDate) } }, data: { eventId } })] : []),
    prisma.calendarEventRoutine.deleteMany({ where: { eventId, date: days } }),
    prisma.calendarEventRoutine.createMany({
      data: [...new Map(fields.routineLinks.map((link) => [`${link.routineId}|${link.date}`, link])).values()].map((link) => ({ eventId, routineId: link.routineId, date: parseDay(link.date) })),
    }),
  ]);
}

/**
 * Contributors, categories, beneficiaries and relations of an event (they may stay when its project changes, or once
 * archived).
 * @param {string} id Event.
 * @returns {Promise<[string[], string[], string[], string[]]>} Contributor ids, category ids, beneficiary ids and relation ids (beneficiaries or linked).
 */
async function eventKept(id: string): Promise<[string[], string[], string[], string[]]> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    select: {
      contributors: { select: { id: true } },
      categories: { select: { id: true } },
      beneficiaries: { select: { id: true } },
      beneficiaryRelations: { select: { id: true } },
      relations: { select: { id: true } },
    },
  });
  const ids = (items: { id: string }[] | undefined) => (items ?? []).map((item) => item.id);
  return [ids(event?.contributors), ids(event?.categories), ids(event?.beneficiaries), [...ids(event?.beneficiaryRelations), ...ids(event?.relations)]];
}

/**
 * Refuses a change of an archived event, or of an event of an archived calendar.
 * @param {Pick<CalendarEvent, 'id' | 'calendarId'>} event Event.
 * @returns {Promise<void>}
 */
async function assertEventWritable(event: Pick<CalendarEvent, 'id' | 'calendarId'>): Promise<void> {
  await assertNotArchived('calendarEvent', event.id);
  await assertNotArchived('calendar', event.calendarId);
}

/**
 * Validates event fields and the project, contributors (of the project only, those already there stay), relations
 * and categories they point to. Its calendar must not be archived, nor its new categories, beneficiaries and relations
 * (those already there stay).
 * @param {CalendarEventInput} input Event fields.
 * @param {string[]} [keep] Contributors already on the event. Optional.
 * @param {string[]} [keepCategories] Categories already on the event. Optional.
 * @param {string[]} [keepBeneficiaries] Beneficiaries (contributors) already on the event. Optional.
 * @param {string[]} [keepRelations] Relations already on the event (beneficiaries or linked). Optional.
 * @returns {Promise<ReturnType<typeof calendarEventInputSchema.parse>>} Validated fields.
 */
async function parseEvent(input: CalendarEventInput, keep: string[] = [], keepCategories: string[] = [], keepBeneficiaries: string[] = [], keepRelations: string[] = []) {
  const event = parseInput(calendarEventInputSchema, input);
  await assertExists(prisma.project, event.projectId, 'Projet');
  await assertAllExist(prisma.contributor, event.contributorIds, 'Contributeur');
  await assertProjectContributors(event.projectId ?? null, event.contributorIds, keep, 'contributorIds');
  await assertAllExist(prisma.contributor, event.beneficiaryIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  await assertAllExist(prisma.treasuryRelation, event.beneficiaryRelationIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  await assertAllExist(prisma.treasuryRelation, event.relationIds, 'Relation');
  await assertActiveContributors(event.beneficiaryIds, keepBeneficiaries, 'beneficiaryIds');
  await assertActiveRelations(event.beneficiaryRelationIds, keepRelations, 'beneficiaryIds');
  await assertActiveRelations(event.relationIds, keepRelations, 'relationIds');
  await assertAllExist(prisma.calendarCategory, event.categoryIds, 'Catégorie');
  await assertNoneArchived(
    'calendarCategory',
    event.categoryIds.filter((id) => !keepCategories.includes(id)),
  );
  const tasks = await prisma.task.findMany({ where: { id: { in: event.taskIds } }, select: { label: true, assignees: { select: { id: true } } } });
  if (tasks.length !== new Set(event.taskIds).size) throw notFound('Tâche');
  // A task is about an event of someone of its assignees (or either side has nobody).
  const apart = tasks.filter(
    (task) =>
      !sharePeople(
        task.assignees.map((assignee) => assignee.id),
        event.contributorIds,
      ),
  );
  // Routines of a day of the event (the one edited, for an occurrence).
  if (event.routineLinks.some((link) => link.date < event.startDate || link.date > event.endDate)) {
    const message = 'Une routine rattachée doit l’être un jour de l’évènement.';
    throw fieldError('routineLinks', message);
  }
  const routineIds = [...new Set(event.routineLinks.map((link) => link.routineId))];
  const routines = await prisma.routine.findMany({ where: { id: { in: routineIds } }, select: { label: true, assignees: { select: { id: true } } } });
  if (routines.length !== routineIds.length) throw notFound('Routine');
  apart.push(
    ...routines.filter(
      (routine) =>
        !sharePeople(
          routine.assignees.map((assignee) => assignee.id),
          event.contributorIds,
        ),
    ),
  );
  if (apart.length) {
    const message = `Sans contributeur en commun avec l’évènement : ${apart.map((task) => `« ${task.label} »`).join(', ')}.`;
    throw fieldError(routines.some((routine) => apart.includes(routine)) && !tasks.some((task) => apart.includes(task)) ? 'routineLinks' : 'taskIds', message);
  }
  // A point goes with a location, both coordinates or none.
  if (!event.location || event.locationLat === null || event.locationLon === null) {
    event.locationLat = null;
    event.locationLon = null;
  }
  if (event.allDay) {
    event.startTime = null;
    event.endTime = null;
    // No travel time to a whole day.
    event.travelBefore = 0;
    event.travelAfter = 0;
  }
  const calendarId = await resolveCalendarId(event.calendarId);
  await assertNotArchived('calendar', calendarId);
  return { ...event, calendarId };
}

/**
 * Prisma writes of the relations of validated event fields: each list connected (a new event) or set (a changed one).
 * @param {Awaited<ReturnType<typeof parseEvent>>} event Fields.
 * @param {'connect' | 'set'} [mode='connect'] Write. Optional. Default = connect.
 * @returns {object} Relations.
 */
function eventRelations(event: Awaited<ReturnType<typeof parseEvent>>, mode: 'connect' | 'set' = 'connect') {
  return {
    contributors: { [mode]: connectIds(event.contributorIds) },
    relations: { [mode]: connectIds(event.relationIds) },
    beneficiaries: { [mode]: connectIds(event.beneficiaryIds) },
    beneficiaryRelations: { [mode]: connectIds(event.beneficiaryRelationIds) },
    categories: { [mode]: connectIds(event.categoryIds) },
    tasks: { [mode]: connectIds(event.taskIds) },
  };
}

/**
 * Ids of the relations of a loaded event, as its input gives them.
 * @param {EventWithRelations} event Event.
 * @returns {Record<string, string[]>} Ids of its contributors, relations, beneficiaries, categories and tasks.
 */
function relationIdsOf(event: EventWithRelations): Record<'contributorIds' | 'relationIds' | 'beneficiaryIds' | 'beneficiaryRelationIds' | 'categoryIds' | 'taskIds', string[]> {
  return {
    ...relationIdsOf(event),
  };
}

/**
 * Prisma data of validated event fields.
 * @param {Awaited<ReturnType<typeof parseEvent>>} event Fields.
 * @returns {object} Scalar data and relations.
 */
function eventData(event: Awaited<ReturnType<typeof parseEvent>>) {
  return {
    label: event.label,
    description: event.description,
    location: event.location,
    locationLat: event.locationLat,
    locationLon: event.locationLon,
    links: event.links,
    allDay: event.allDay,
    startDate: parseDay(event.startDate),
    startTime: event.startTime,
    endDate: parseDay(event.endDate),
    endTime: event.endTime,
    timeZone: event.timeZone,
    recurrence: (event.recurrence ?? undefined) as Prisma.InputJsonValue | undefined,
    reminders: [...new Set(event.reminders)].sort((a, b) => a - b),
    travelBefore: event.travelBefore,
    travelAfter: event.travelAfter,
    projectId: event.projectId,
    calendarId: event.calendarId,
  };
}

/**
 * Loads an event or throws NOT_FOUND.
 * @param {string} id Event id.
 * @returns {Promise<CalendarEvent>} Event.
 */
async function findEvent(id: string): Promise<CalendarEvent> {
  const event = await orNotFound(prisma.calendarEvent.findUnique({ where: { id } }), 'Évènement');
  return event;
}

/**
 * Creates an event.
 * @param {CalendarEventInput} input Event.
 * @returns {Promise<CalendarEvent>} Event.
 */
export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const event = await parseEvent(input);
  const created = await prisma.calendarEvent.create({
    data: {
      ...eventData(event),
      recurrence: event.recurrence ?? undefined,
      ...eventRelations(event),
    },
  });
  await saveRoutineLinks(null, created.id, event);
  return created;
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
  const ended: Recurrence = rule.count !== null ? { ...rule, count: Math.max(1, occurrencesBefore(rule, start, date)) } : { ...rule, until: addDays(date, -1) };
  await tx.calendarEvent.update({ where: { id: event.id }, data: { recurrence: ended } });
  await tx.calendarEventException.deleteMany({ where: { eventId: event.id, date: { gte: parseDay(date) } } });
}

/**
 * Updates an event. For a recurring event, the change applies to one occurrence (THIS: calendar, project,
 * contributors and categories stay those of the series), to it and the following ones (FOLLOWING: the
 * series is split), or to the whole series (ALL: dates moved by as much as the occurrence was).
 * @param {string} id Event id.
 * @param {CalendarEventInput} input New fields (dates of the occurrence).
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence changed. Optional for a one-off event.
 * @returns {Promise<CalendarEvent>} Updated (or new, after a split) event.
 */
export async function updateCalendarEvent(id: string, input: CalendarEventInput, scope: EventScope, occurrenceDate?: string | null): Promise<CalendarEvent> {
  const updated = await updateEventFields(id, input, scope, occurrenceDate);
  // The routines of the days of the occurrence edited, on the event it now belongs to.
  await saveRoutineLinks(id, updated.id, parseInput(calendarEventInputSchema, input));
  return updated;
}

/**
 * Fields of an event (or of some of its occurrences) changed, the routines of its days aside.
 * @param {string} id Event.
 * @param {CalendarEventInput} input Fields.
 * @param {EventScope} scope Occurrences changed.
 * @param {string | null} [occurrenceDate] Occurrence edited. Optional.
 * @returns {Promise<CalendarEvent>} Event the occurrence belongs to.
 */
async function updateEventFields(id: string, input: CalendarEventInput, scope: EventScope, occurrenceDate?: string | null): Promise<CalendarEvent> {
  const event = await findEvent(id);
  await assertEventWritable(event);
  const fields = await parseEvent(input, ...(await eventKept(id)));
  const occurrence = occurrenceOf(event, occurrenceDate);
  const relations = eventRelations(fields, 'set');

  if (!occurrence) {
    return prisma.calendarEvent.update({ where: { id }, data: { ...eventData(fields), recurrence: fields.recurrence ?? Prisma.JsonNull, ...relations } });
  }
  const seriesStart = formatDay(event.startDate);

  if (scope === 'THIS') {
    const override = {
      cancelled: false,
      label: fields.label,
      description: fields.description,
      location: fields.location,
      locationLat: fields.locationLat,
      locationLon: fields.locationLon,
      links: fields.links,
      allDay: fields.allDay,
      startDate: parseDay(fields.startDate),
      startTime: fields.startTime,
      endDate: parseDay(fields.endDate),
      endTime: fields.endTime,
      travelBefore: fields.travelBefore,
      travelAfter: fields.travelAfter,
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
        ...eventRelations(fields),
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
 * Occurrence of an event on a date, with its own changes: the same in the app and in its exports (ICS).
 * @param {EventWithRelations} event Event.
 * @param {string | null} date Occurrence date (null for a one-off event).
 * @param {CalendarEventException | undefined} change Own changes.
 * @returns {EventOccurrence} Occurrence.
 */
export function toOccurrence(event: EventWithRelations, date: string | null, change: CalendarEventException | undefined): EventOccurrence {
  const seriesStart = formatDay(event.startDate);
  const span = daysBetween(seriesStart, formatDay(event.endDate));
  const allDay = change?.allDay ?? event.allDay;
  const startDate = change?.startDate ? formatDay(change.startDate) : (date ?? seriesStart);
  // Its length: that of the rule (weeks, months, up to a week or a month of the year), else that of the event.
  const duration = date ? storedRecurrence(event.recurrence)?.duration : null;
  const endDate = change?.endDate ? formatDay(change.endDate) : duration && duration.unit !== 'DAYS' ? spanEnd(duration, startDate) : addDays(startDate, span);
  const startTime = allDay ? null : change ? change.startTime : event.startTime;
  const endTime = allDay ? null : change ? change.endTime : event.endTime;
  const instant = (day: string, time: string | null) => (time ? zonedInstant(day, time, event.timeZone) : parseDay(day));
  return {
    key: date ? `${event.id}:${date}` : event.id,
    eventId: event.id,
    occurrenceDate: date,
    modified: change !== undefined,
    label: change?.label ?? event.label,
    description: change ? change.description : event.description,
    location: change ? change.location : event.location,
    locationLat: change ? change.locationLat : event.locationLat,
    locationLon: change ? change.locationLon : event.locationLon,
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
    travelBefore: change?.travelBefore ?? event.travelBefore,
    travelAfter: change?.travelAfter ?? event.travelAfter,
    projectId: event.projectId,
    calendarId: event.calendarId,
    archived: event.archivedAt !== null,
    ...relationIdsOf(event),
    routineLinks: linksWithin(event.routineLinks, startDate, endDate),
    calledOff: event.calledOff || (change?.calledOff ?? false),
    postponedFrom: event.postponedFromId ? { eventId: event.postponedFromId, date: formatOptionalDay(event.postponedFromDate), label: event.postponedFrom?.label ?? '' } : null,
    postponedTo: event.postponements
      .filter((postponement) => formatOptionalDay(postponement.postponedFromDate) === date)
      .map((postponement) => ({ eventId: postponement.id, label: postponement.label, startDate: formatDay(postponement.startDate), startTime: postponement.startTime })),
    trackedSeconds: event.timeEntries
      .filter((entry) => formatOptionalDay(entry.calendarOccurrenceDate) === date)
      .reduce(
        (sum, entry) =>
          sum +
          entrySeconds({
            startedAt: entry.startedAt.toISOString(),
            endedAt: entry.endedAt?.toISOString() ?? null,
            pausedAt: entry.pausedAt?.toISOString() ?? null,
            pausedSeconds: entry.pausedSeconds,
            duration: entry.duration,
          }),
        0,
      ),
  };
}

/**
 * Occurrences of the events overlapping a period (dates included).
 * @param {string} from First date.
 * @param {string} to Last date.
 * @param {string[]} [calendarIds] Only the events of these calendars. Optional.
 * @param {boolean} [activeOnly] Without the archived events nor those of archived calendars. Optional. Default = all.
 * @returns {Promise<EventOccurrence[]>} Occurrences, by start.
 */
export async function eventOccurrences(from: string, to: string, calendarIds?: string[], activeOnly = false): Promise<EventOccurrence[]> {
  const events = await prisma.calendarEvent.findMany({
    // Recurring events may occur in the period whatever their first date.
    where: {
      startDate: { lte: parseDay(addDays(to, 62)) },
      OR: [{ recurrence: { not: Prisma.DbNull } }, { endDate: { gte: parseDay(addDays(from, -62)) } }],
      ...(calendarIds ? { calendarId: { in: calendarIds } } : {}),
      ...(activeOnly ? { archivedAt: null, calendar: { archivedAt: null } } : {}),
    },
    include: occurrenceInclude,
  });
  const result: EventOccurrence[] = [];
  for (const event of events) {
    const rule = storedRecurrence(event.recurrence);
    const changes = new Map(event.exceptions.map((change) => [formatDay(change.date), change]));
    const span = daysBetween(formatDay(event.startDate), formatDay(event.endDate));
    // Moved occurrences may come from a little outside the period.
    const longest = Math.max(span, rule?.duration ? maxSpanDays(rule.duration) : 0);
    const dates = rule ? occurrenceDates(rule, formatDay(event.startDate), addDays(from, -longest - 62), addDays(to, 62)) : [null];
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
 * Occurrences, in a period, of the calendars of other workspaces this one shows (read in their workspaces), archived
 * events and calendars left out.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {Promise<EventOccurrence[]>} Occurrences, by start.
 */
export async function subscribedOccurrences(from: string, to: string): Promise<EventOccurrence[]> {
  const byWorkspace = new Map<string, { workspace: { id: string; kind: 'PRO' | 'PERSO' }; calendarIds: string[] }>();
  for (const subscription of await listSubscriptions()) {
    const entry = byWorkspace.get(subscription.workspace.id) ?? { workspace: subscription.workspace, calendarIds: [] };
    entry.calendarIds.push(subscription.calendarId);
    byWorkspace.set(subscription.workspace.id, entry);
  }
  const lists = await Promise.all([...byWorkspace.values()].map(({ workspace, calendarIds }) => runInWorkspace(workspace, () => eventOccurrences(from, to, calendarIds, true))));
  return lists.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
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
    label: event.label,
    description: event.description,
    location: event.location,
    locationLat: event.locationLat,
    locationLon: event.locationLon,
    links: (event.links as unknown as CalendarLink[]) ?? [],
    allDay: event.allDay,
    startDate: date,
    startTime: event.startTime,
    endDate: addDays(date, span),
    endTime: event.endTime,
    timeZone: event.timeZone,
    recurrence: storedRecurrence(event.recurrence),
    reminders: event.reminders,
    travelBefore: event.travelBefore,
    travelAfter: event.travelAfter,
    projectId: event.projectId,
    calendarId: event.calendarId,
    ...relationIdsOf(event),
    routineLinks: linksWithin(event.routineLinks, date, addDays(date, span)),
  };
}

/**
 * Loads an event with what its occurrences need, or throws NOT_FOUND.
 * @param {string} id Event id.
 * @returns {Promise<EventWithRelations>} Event.
 */
async function findEventWithRelations(id: string): Promise<EventWithRelations> {
  const event = await orNotFound(prisma.calendarEvent.findUnique({ where: { id }, include: occurrenceInclude }), 'Évènement');
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
  await assertEventWritable(event);
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
        label: current.label,
        description: current.description,
        location: current.location,
        locationLat: current.locationLat,
        locationLon: current.locationLon,
        links: current.links as unknown as Prisma.InputJsonValue,
        allDay: current.allDay,
        startDate: parseDay(current.startDate),
        startTime: current.startTime,
        endDate: parseDay(current.endDate),
        endTime: current.endTime,
        travelBefore: current.travelBefore,
        travelAfter: current.travelAfter,
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
 * @param {CalendarEventInput} input New event (its dates, label…).
 * @returns {Promise<CalendarEvent>} New event.
 */
export async function postponeCalendarEvent(id: string, occurrenceDate: string | null | undefined, input: CalendarEventInput): Promise<CalendarEvent> {
  const event = await findEvent(id);
  await assertEventWritable(event);
  const occurrence = occurrenceOf(event, occurrenceDate);
  const fields = await parseEvent({ ...input, recurrence: null }, ...(await eventKept(id)));
  const created = await prisma.calendarEvent.create({
    data: {
      ...eventData(fields),
      recurrence: undefined,
      postponedFromId: id,
      postponedFromDate: occurrence ? parseDay(occurrence.date) : null,
      ...eventRelations(fields),
    },
  });
  await setEventCalledOff(id, 'THIS', occurrence?.date ?? null, true);
  return created;
}
