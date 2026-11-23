import {
  addDays,
  type CalendarEventInput,
  calendarEventInputSchema,
  daysBetween,
  entrySeconds,
  type EventScope,
  formatDay,
  formatOptionalDay,
  type ItemLink,
  maxSpanDays,
  occurrenceDates,
  occurrencesBefore,
  subtreeOf,
  cutSeriesRule,
  parseDay,
  parseOptionalDay,
  type Recurrence,
  recurrenceSchema,
  sharePeople,
  spanEnd,
  sumOf,
  zonedInstant,
  occurrenceKey,
  normalizedReminders,
  readReminders,
  type Reminder,
  type EffectiveTask,
  shiftedSeriesRule,
} from '@ordo/shared';
import { prisma } from '../../db';
import { PARIS } from '../../today';
import { assertBeneficiaries } from '../core/beneficiaries';
import { Prisma, type CalendarEvent, type CalendarEventException } from '../../generated/prisma/client';
import { linkedSavedCountdowns } from '../tasks/saved-countdowns';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { runInWorkspace } from '../../workspace-context';
import { listSubscriptions, resolveCalendarId } from './calendars';
import { assertProjectContributors, followProject } from '../projects/contributors';
import { assertAllExist, findOrNotFound } from '../core/lookup';
import { archivedError, assertActive, assertNotArchived, activeIds, archivedOn, refuseArchived } from '../core/archive';
import { connectIds } from '../core/relations';
import { checkLinkedDocuments, LINKED_DOCUMENTS_SELECT, linkedDocumentIds } from '../projects/linked-documents';
import { loadProjectRootOf } from '../projects/project-tree';
import { releaseSubjectTime, type GoneOccurrences } from '../tasks/time-entries';
import { toJson } from '../core/json';
import { confirmLostOccurrences, remapOccurrenceRows } from '../core/occurrence-rows';
import { deleteGoneComments, placeLegacyComments } from '../core/comments';
import { readLinks } from '../core/links';
import { storedLocation } from '../core/geo';
import { effectiveTasks } from '../tasks/task-inheritance';
import { effectiveRoutineOf, loadRoutineInheritance, type StoredInheritingRoutine } from '../routines/routine-inheritance';
import { linkShownDay, loadLinkShownDays, ROUTINE_LINK_SELECT, type RoutineLinkRow } from './routine-link-days';

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
  links: ItemLink[];
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  /** Start and end instants (midnight UTC of the dates for an all-day event). */
  start: Date;
  end: Date;
  recurrence: Recurrence | null;
  /** First date of the series. */
  seriesStartDate: string;
  reminders: Reminder[];
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
  /** Documents linked to the event (its whole series): of the library, and of its project tree. */
  libraryDocumentIds: string[];
  projectResourceIds: string[];
  /** Saved timers launched from the event (its whole series). */
  savedCountdownIds: string[];
  /** Routines of a day of the occurrence it is about (their occurrence of that day is done during it): the day that identifies each occurrence, and the day it shows on. */
  routineLinks: { routineId: string; date: string; shownDate: string }[];
  /** Cancelled but kept in the calendar. */
  calledOff: boolean;
  /** Event (and occurrence) this one postpones. */
  postponedFrom: { eventId: string; date: string | null; label: string } | null;
  /** Events postponing this occurrence. */
  postponedTo: { eventId: string; label: string; startDate: string; startTime: string | null }[];
  /** Time tracked on this occurrence, in seconds (running timers until now). */
  trackedSeconds: number;
  /** Changed on its own: its fields as its series has them on its date (what « Toutes les occurrences » edits); else null. */
  series: EventSeriesFields | null;
}

/** Fields an occurrence changed on its own may have apart from its series. */
const OWN_FIELDS = ['label', 'description', 'location', 'locationLat', 'locationLon', 'links', 'allDay', 'startDate', 'startTime', 'endDate', 'endTime', 'travelBefore', 'travelAfter'] as const;

/** Fields of an occurrence as its series has them on its date. */
export type EventSeriesFields = Pick<EventOccurrence, (typeof OWN_FIELDS)[number]>;

/** Event with what its occurrences are built from (`occurrenceInclude`). */
export type EventWithRelations = CalendarEvent & {
  exceptions: CalendarEventException[];
  contributors: { id: string }[];
  relations: { id: string }[];
  beneficiaries: { id: string }[];
  beneficiaryRelations: { id: string }[];
  categories: { id: string }[];
  tasks: { id: string }[];
  libraryDocuments: { id: string }[];
  projectResources: { id: string }[];
  savedCountdowns: { id: string }[];
  routineLinks: RoutineLinkRow[];
  postponedFrom: { label: string } | null;
  postponements: { id: string; label: string; startDate: Date; startTime: string | null; postponedFromDate: Date | null }[];
  timeEntryLinks: {
    occurrenceDate: Date | null;
    timeEntry: { startedAt: Date; endedAt: Date | null; pausedAt: Date | null; pausedSeconds: number; duration: number | null; _count: { events: number } };
  }[];
};

/** Prisma `include` of an event for its occurrences (toOccurrence). */
export const occurrenceInclude = {
  exceptions: true,
  contributors: { select: { id: true } },
  relations: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  categories: { select: { id: true } },
  savedCountdowns: { select: { id: true } },
  tasks: { select: { id: true } },
  ...LINKED_DOCUMENTS_SELECT,
  routineLinks: { select: ROUTINE_LINK_SELECT },
  postponedFrom: { select: { label: true } },
  postponements: { select: { id: true, label: true, startDate: true, startTime: true, postponedFromDate: true } },
  timeEntryLinks: {
    select: { occurrenceDate: true, timeEntry: { select: { startedAt: true, endedAt: true, pausedAt: true, pausedSeconds: true, duration: true, _count: { select: { events: true } } } } },
  },
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
 * First occurrence of a recurring event shown in the calendar: the first day of its rule (its excluded dates and pauses
 * left out), not deleted on its own (a `cancelled` exception); scanned year by year over ten years.
 * @param {Pick<CalendarEvent, 'id' | 'startDate' | 'recurrence'>} event Event.
 * @param {object} [client] Client or transaction. Optional. Default = the client of the workspace.
 * @returns {Promise<string | null>} Day, null for a one-off event or without any.
 */
export async function firstShownOccurrence(event: Pick<CalendarEvent, 'id' | 'startDate' | 'recurrence'>, client: Prisma.TransactionClient = prisma): Promise<string | null> {
  const rule = storedRecurrence(event.recurrence);
  if (!rule) return null;
  const deleted = new Set((await client.calendarEventException.findMany({ where: { eventId: event.id, cancelled: true }, select: { date: true } })).map((change) => formatDay(change.date)));
  const start = formatDay(event.startDate);
  for (let year = 0, from = start; year < 10; year += 1, from = addDays(from, 366)) {
    const found = occurrenceDates(rule, start, from, addDays(from, 365)).find((date) => !deleted.has(date));
    if (found) return found;
  }
  return null;
}

/**
 * Places the comments of recurring events written before they were on occurrences on the first
 * occurrence shown of their series (`firstShownOccurrence`), and saves them there; those of one-off events are theirs.
 * @param {readonly string[]} ids Events read.
 * @returns {Promise<void>}
 */
export async function placeLegacyEventComments(ids: readonly string[]): Promise<void> {
  await placeLegacyComments('EVENT', ids, async (eventIds) => {
    const events = await prisma.calendarEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, startDate: true, recurrence: true } });
    const firsts = new Map(await Promise.all(events.map(async (event) => [event.id, await firstShownOccurrence(event)] as const)));
    return (eventId) => firsts.get(eventId) ?? null;
  });
}

/**
 * Routines linked on the days of an occurrence: those shown on one of its days (an occurrence moved there and kept
 * apart included, its link stored on the day of its rule).
 * @param {RoutineLinkRow[]} links Links of the event.
 * @param {string} from First day (YYYY-MM-DD).
 * @param {string} to Last day, included.
 * @returns {{ routineId: string, date: string, shownDate: string }[]} Links of those days (the day that identifies each occurrence, the day it shows on).
 */
function linksWithin(links: readonly RoutineLinkRow[], from: string, to: string): { routineId: string; date: string; shownDate: string }[] {
  return links
    .map((link) => ({ routineId: link.routineId, date: formatDay(link.date), shownDate: linkShownDay(link) }))
    .filter((link) => link.shownDate >= from && link.shownDate <= to);
}

/** Days of an occurrence (first and last, included). */
interface OccurrenceDays {
  from: string;
  to: string;
}

/**
 * Sets the routines of the days of an occurrence: the links of the days it had are replaced by those given (the links
 * of its other days kept, as those already on its new days: another occurrence may have them), each once by
 * `routineId|date`.
 * @param {string} eventId Event the occurrence belongs to.
 * @param {readonly { routineId: string, date: string }[]} links Routines of its days.
 * @param {OccurrenceDays | null} replaced Days whose links are replaced; null: every link of the event (a one-off event).
 * @returns {Promise<void>}
 */
async function saveRoutineLinks(eventId: string, links: readonly { routineId: string; date: string }[], replaced: OccurrenceDays | null): Promise<void> {
  // The links of its days: by the day each occurrence shows on (one kept apart is stored on the day of its rule).
  const held = replaced ? await prisma.calendarEventRoutine.findMany({ where: { eventId }, select: { id: true, ...ROUTINE_LINK_SELECT } }) : [];
  const gone = held.filter((link) => {
    const day = linkShownDay(link);
    return day >= replaced!.from && day <= replaced!.to;
  });
  await prisma.$transaction([
    prisma.calendarEventRoutine.deleteMany({ where: { eventId, ...(replaced && { id: { in: gone.map((link) => link.id) } }) } }),
    prisma.calendarEventRoutine.createMany({
      data: [...new Map(links.map((link) => [occurrenceKey(link.routineId, link.date), link])).values()].map((link) => ({ eventId, routineId: link.routineId, date: parseDay(link.date) })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * Moves the routine links of the occurrences of a series from a day, with them: by as many days as they are moved,
 * and / or to another event (a series split).
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {string} eventId Event.
 * @param {string | null} from First day moved; null: every link.
 * @param {number} shift Days moved.
 * @param {string} [to] Event they go to. Optional. Default = the same.
 * @returns {Promise<void>}
 */
async function moveRoutineLinks(tx: Prisma.TransactionClient, eventId: string, from: string | null, shift: number, to: string = eventId): Promise<void> {
  if (shift === 0 && to === eventId) return;
  const where = { eventId, ...(from && { date: { gte: parseDay(from) } }) };
  const links = await tx.calendarEventRoutine.findMany({ where, select: { routineId: true, date: true } });
  if (!links.length) return;
  await tx.calendarEventRoutine.deleteMany({ where });
  await tx.calendarEventRoutine.createMany({
    data: links.map((link) => ({ eventId: to, routineId: link.routineId, date: parseDay(addDays(formatDay(link.date), shift)) })),
    skipDuplicates: true,
  });
}

/**
 * Contributors, categories, beneficiaries and relations of an event (they may stay when its project changes, or once
 * archived).
 * @param {string} id Event.
 * @returns {Promise<[string[], string[], string[], string[], string[], string[]]>} Contributor ids, category ids, beneficiary ids, relation ids (beneficiaries or linked), its project and its documents of projects.
 */
async function eventKept(id: string): Promise<[string[], string[], string[], string[], string[], string[], string[]]> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    select: {
      projectId: true,
      contributors: { select: { id: true } },
      categories: { select: { id: true } },
      beneficiaries: { select: { id: true } },
      beneficiaryRelations: { select: { id: true } },
      relations: { select: { id: true } },
      projectResources: { select: { id: true } },
      tasks: { select: { id: true } },
    },
  });
  const ids = (items: { id: string }[] | undefined) => (items ?? []).map((item) => item.id);
  return [
    ids(event?.contributors),
    ids(event?.categories),
    ids(event?.beneficiaries),
    [...ids(event?.beneficiaryRelations), ...ids(event?.relations)],
    event?.projectId ? [event.projectId] : [],
    ids(event?.projectResources),
    ids(event?.tasks),
  ];
}

/**
 * Refuses a change of an archived event, or of an event of an archived calendar.
 * @param {Pick<CalendarEvent, 'archivedAt' | 'calendarId'>} event Event, loaded.
 * @returns {Promise<void>}
 */
async function assertEventWritable(event: Pick<CalendarEvent, 'archivedAt' | 'calendarId'>): Promise<void> {
  refuseArchived(event);
  await assertNotArchived('calendar', event.calendarId);
}

/**
 * Refuses to archive or restore events of an archived calendar (« Élément archivé… »): its events are read only.
 * @param {readonly string[]} ids Events.
 * @returns {Promise<void>}
 */
export async function assertEventsArchivable(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  if (await prisma.calendarEvent.count({ where: { id: { in: [...ids] }, calendar: { archivedAt: { not: null } } } })) throw archivedError();
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
 * @param {string[]} [keepProject] Project already of the event (kept even if archived). Optional.
 * @param {string[]} [keepResources] Documents of projects already linked to the event: those out of its project tree
 * stay while its tree does not change, and are dropped when it moves to another one. Optional.
 * @param {string[]} [keepTasks] Tasks already linked to the event (kept even if archived or out of its project tree). Optional.
 * @returns {Promise<ReturnType<typeof calendarEventInputSchema.parse>>} Validated fields.
 */
async function parseEvent(
  input: CalendarEventInput,
  keep: string[] = [],
  keepCategories: string[] = [],
  keepBeneficiaries: string[] = [],
  keepRelations: string[] = [],
  keepProject: string[] = [],
  keepResources: string[] = [],
  keepTasks: string[] = [],
) {
  const event = parseInput(calendarEventInputSchema, input);
  await assertActive(prisma.project, event.projectId, 'Projet', { keep: keepProject, field: 'projectId' });
  const rootOf = await loadProjectRootOf();
  event.projectResourceIds =
    (await checkLinkedDocuments(event, { projectId: event.projectId, previous: keepResources, moved: rootOf(keepProject[0] ?? null) !== rootOf(event.projectId), rootOf })) ?? [];
  await assertAllExist(prisma.contributor, event.contributorIds, 'Contributeur');
  await assertProjectContributors(event.projectId ?? null, event.contributorIds, keep, 'contributorIds');
  await assertBeneficiaries({ contributorIds: event.beneficiaryIds, relationIds: event.beneficiaryRelationIds }, { keep: { contributorIds: keepBeneficiaries, relationIds: keepRelations } });
  await activeIds(prisma.treasuryRelation, event.relationIds, 'Relation', { keep: keepRelations, field: 'relationIds' });
  await activeIds(prisma.calendarCategory, event.categoryIds, 'Catégorie', { keep: keepCategories, field: 'categoryIds' });
  const tasks = await prisma.task.findMany({ where: { id: { in: event.taskIds } }, select: { id: true, label: true, projectId: true, archivedAt: true } });
  if (tasks.length !== new Set(event.taskIds).size) throw notFound('Tâche');
  // Tasks added: not archived; with a project, of its project, its sub-projects or of none (those already linked stay).
  const added = tasks.filter((task) => !keepTasks.includes(task.id));
  for (const task of added) refuseArchived(task, 'taskIds');
  if (event.projectId && added.some((task) => task.projectId !== null)) {
    const subtree = subtreeOf(await prisma.project.findMany({ select: { id: true, parentId: true } }), event.projectId);
    if (added.some((task) => task.projectId !== null && !subtree.has(task.projectId))) throw fieldError('taskIds', 'Les tâches doivent être du projet de l’évènement, de l’un de ses sous-projets, ou sans projet.');
  }
  // A task is about an event of someone of its assignees, its own or inherited (or either side has nobody).
  const taskAssignees = tasks.length ? await effectiveTasks(tasks.map((task) => task.id)) : new Map<string, EffectiveTask>();
  const apart: { label: string }[] = tasks.filter((task) => !sharePeople([...(taskAssignees.get(task.id)?.assigneeIds ?? [])], event.contributorIds));
  // Routines of a day of the event (the one edited, for an occurrence): by the day each occurrence shows on (one moved
  // there and kept apart is identified by the day of its rule).
  const shownOn = await loadLinkShownDays(event.routineLinks);
  if (event.routineLinks.some((link) => shownOn(link) < event.startDate || shownOn(link) > event.endDate)) {
    const message = 'Une routine rattachée doit l’être un jour de l’évènement.';
    throw fieldError('routineLinks', message);
  }
  const routineIds = [...new Set(event.routineLinks.map((link) => link.routineId))];
  const routines = await prisma.routine.findMany({ where: { id: { in: routineIds } }, select: { id: true, label: true } });
  if (routines.length !== routineIds.length) throw notFound('Routine');
  const inheritance = routines.length ? await loadRoutineInheritance() : new Map<string, StoredInheritingRoutine>();
  apart.push(...routines.filter((routine) => !sharePeople(effectiveRoutineOf(inheritance, routine.id)?.routine.assigneeIds ?? [], event.contributorIds)));
  if (apart.length) {
    const message = `Sans contributeur en commun avec l’évènement : ${apart.map((task) => `« ${task.label} »`).join(', ')}.`;
    throw fieldError(routines.some((routine) => apart.includes(routine)) && !tasks.some((task) => apart.includes(task)) ? 'routineLinks' : 'taskIds', message);
  }
  Object.assign(event, storedLocation(event));
  if (event.allDay) {
    event.startTime = null;
    event.endTime = null;
    // No travel time to a whole day.
    event.travelBefore = 0;
    event.travelAfter = 0;
  }
  const calendarId = await resolveCalendarId(event.calendarId);
  await assertNotArchived('calendar', calendarId, { field: 'calendarId' });
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
    libraryDocuments: { [mode]: connectIds(event.libraryDocumentIds) },
    projectResources: { [mode]: connectIds(event.projectResourceIds) },
  };
}

/**
 * Ids of the relations of a loaded event, as its input gives them.
 * @param {EventWithRelations} event Event.
 * @returns {Record<string, string[]>} Ids of its contributors, relations, beneficiaries, categories, tasks and documents.
 */
function relationIdsOf(
  event: EventWithRelations,
): Record<'contributorIds' | 'relationIds' | 'beneficiaryIds' | 'beneficiaryRelationIds' | 'categoryIds' | 'taskIds' | 'libraryDocumentIds' | 'projectResourceIds', string[]> {
  return {
    contributorIds: event.contributors.map((contributor) => contributor.id),
    relationIds: event.relations.map((relation) => relation.id),
    beneficiaryIds: event.beneficiaries.map((beneficiary) => beneficiary.id),
    beneficiaryRelationIds: event.beneficiaryRelations.map((relation) => relation.id),
    categoryIds: event.categories.map((category) => category.id),
    taskIds: event.tasks.map((task) => task.id),
    ...linkedDocumentIds(event),
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
    recurrence: event.recurrence ? toJson(event.recurrence) : undefined,
    reminders: toJson(normalizedReminders(event.reminders)),
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
function findEvent(id: string): Promise<CalendarEvent> {
  return findOrNotFound(prisma.calendarEvent, id, 'Évènement');
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
  await saveRoutineLinks(created.id, event.routineLinks, null);
  return created;
}

/**
 * Checks the occurrence a scoped change applies to.
 * @param {CalendarEvent} event Event.
 * @param {string | null | undefined} occurrenceDate Occurrence.
 * @returns {{ rule: Recurrence, date: string } | null} Rule and date, or null for a one-off event (NOT_FOUND-like refusal
 * « Occurrence introuvable. » for a date that is not one of its rule).
 */
function occurrenceOf(event: CalendarEvent, occurrenceDate: string | null | undefined): { rule: Recurrence; date: string } | null {
  const rule = storedRecurrence(event.recurrence);
  if (!rule) return null;
  if (!occurrenceDate) throw clientError('BAD_USER_INPUT', 'Occurrence manquante.');
  // One of its days: another date (before its start, out of its rule) would change the series from nowhere.
  if (!occursOn(rule, formatDay(event.startDate), occurrenceDate)) throw clientError('BAD_USER_INPUT', 'Occurrence introuvable.');
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
 * @param {boolean} [confirmLoss] Occurrences made to disappear, with comments or times, confirmed (`confirmLostOccurrences`). Optional.
 * @returns {Promise<CalendarEvent>} Updated (or new, after a split) event.
 */
export async function updateCalendarEvent(id: string, input: CalendarEventInput, scope: EventScope, occurrenceDate?: string | null, confirmLoss?: boolean): Promise<CalendarEvent> {
  const before = (await findEvent(id)).projectId;
  const { event: updated, linkDays } = await updateEventFields(id, input, scope, occurrenceDate, confirmLoss);
  const fields = parseInput(calendarEventInputSchema, input);
  // A new project (not for one occurrence: it keeps the one of its series): the contributors follow the event into it.
  await followProject(before, updated.projectId, fields.contributorIds);
  // The routines of the days of the occurrence edited, on the event it now belongs to.
  await saveRoutineLinks(updated.id, fields.routineLinks, linkDays);
  return updated;
}

/** Fields of a recurring event that are those of its whole series: one occurrence alone (`THIS`) does not change them. */
const SERIES_FIELDS = [
  'recurrence',
  'reminders',
  'projectId',
  'calendarId',
  'contributorIds',
  'relationIds',
  'beneficiaryIds',
  'beneficiaryRelationIds',
  'categoryIds',
  'taskIds',
  'libraryDocumentIds',
  'projectResourceIds',
] as const;

/** Fields of the series given as lists of ids: compared whatever their order. */
const SERIES_ID_LISTS = new Set<string>(['contributorIds', 'relationIds', 'beneficiaryIds', 'beneficiaryRelationIds', 'categoryIds', 'taskIds', 'libraryDocumentIds', 'projectResourceIds']);

/** Message of the error refusing a field of the series changed for one occurrence alone. */
const SERIES_FIELD_MESSAGE = 'Ce champ vaut pour toute la série : modifiez « Celle-ci et les suivantes » ou « Toutes les occurrences ».';

/**
 * Refuses, for one occurrence alone, a field of the series given with another value than the series has
 * (BAD_USER_INPUT under the field): sent unchanged, they are kept as the series has them. A calendar not given
 * (null) is that of the series. Nothing is compared when the series' own values no longer pass the rules (former data).
 * @param {CalendarEventInput} given Fields given (validated), with the calendar as sent.
 * @param {CalendarEventInput} series Fields of the series on that occurrence (`seriesInput`).
 * @returns {void}
 */
function assertSeriesFieldsKept(given: CalendarEventInput, series: CalendarEventInput): void {
  const stored = calendarEventInputSchema.safeParse(series);
  if (!stored.success) return;
  /**
   * Comparable form of a field's value.
   * @param {string} field Field.
   * @param {unknown} value Value.
   * @returns {string} JSON (a list of ids sorted).
   */
  const comparable = (field: string, value: unknown): string => JSON.stringify(SERIES_ID_LISTS.has(field) && Array.isArray(value) ? [...(value as string[])].sort() : (value ?? null));
  for (const field of SERIES_FIELDS) {
    if (field === 'calendarId' && !given.calendarId) continue;
    if (comparable(field, given[field]) !== comparable(field, stored.data[field])) throw fieldError(field, SERIES_FIELD_MESSAGE);
  }
}

/**
 * Fields of an event (or of some of its occurrences) changed, the routines of its days aside; the routine links of the
 * occurrences moved follow them.
 * @param {string} id Event.
 * @param {CalendarEventInput} input Fields.
 * @param {EventScope} scope Occurrences changed.
 * @param {string | null} [occurrenceDate] Occurrence edited. Optional.
 * @param {boolean} [confirmLoss] Occurrences made to disappear confirmed (`confirmLostOccurrences`). Optional.
 * @returns {Promise<{ event: CalendarEvent, linkDays: OccurrenceDays | null }>} Event the occurrence belongs to, and the
 * days whose routine links its own replace (null: every link of a one-off event).
 */
async function updateEventFields(
  id: string,
  input: CalendarEventInput,
  scope: EventScope,
  occurrenceDate?: string | null,
  confirmLoss?: boolean,
): Promise<{ event: CalendarEvent; linkDays: OccurrenceDays | null }> {
  const event = await findEvent(id);
  await assertEventWritable(event);
  // Comments written before they were on occurrences: placed before the occurrences change.
  await placeLegacyEventComments([id]);
  const fields = await parseEvent(input, ...(await eventKept(id)));
  const occurrence = occurrenceOf(event, occurrenceDate);
  const relations = eventRelations(fields, 'set');
  const newDays = { from: fields.startDate, to: fields.endDate };

  if (!occurrence) {
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.calendarEvent.update({ where: { id }, data: { ...eventData(fields), recurrence: fields.recurrence ?? Prisma.JsonNull, ...relations } });
      // Now repeating: the comments and times of its single occurrence go to its first one shown.
      const first = fields.recurrence ? await firstShownOccurrence(saved, tx) : null;
      if (first) await remapOccurrenceRows('eventId', id, (date) => (date === null ? first : undefined), { client: tx });
      return saved;
    });
    return { event: updated, linkDays: null };
  }
  const seriesStart = formatDay(event.startDate);

  if (scope === 'THIS') {
    const loaded = await findEventWithRelations(id);
    assertSeriesFieldsKept({ ...fields, calendarId: input.calendarId ?? null }, seriesInput(loaded, occurrence.date));
    // Its days as they were: their routine links are its own, moved with it (those of its new days stay).
    const shown = shownOccurrence(loaded, occurrence.date);
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
    return { event, linkDays: { from: shown.startDate, to: shown.endDate } };
  }

  // Days the occurrence edited moves by; its series moves with it (its rule too: on the same days of the week, of the
  // month or of the year, once moved).
  const shift = daysBetween(occurrence.date, fields.startDate);

  if (scope === 'ALL' || occurrence.date === seriesStart) {
    // Its repetition removed: the event becomes the occurrence edited, on its day; else the series moves by as much as
    // the occurrence did.
    const recurring = Boolean(fields.recurrence);
    const rule = fields.recurrence && shiftedSeriesRule(fields.recurrence, seriesStart, shift);
    const startDate = recurring ? addDays(seriesStart, shift) : fields.startDate;
    const endDate = addDays(startDate, daysBetween(fields.startDate, fields.endDate));
    const moved = recurring ? movedOccurrence(seriesStart, shift, true) : movedOccurrence(occurrence.date, 0, false);
    // Occurrences that no longer exist once moved (another rule, no longer repeating): their comments and times go,
    // with the save.
    const settle = await confirmLostOccurrences(
      'eventId',
      id,
      (day) => {
        if (!occursOn(occurrence.rule, seriesStart, day)) return false;
        const after = moved(day);
        if (after === null) return false;
        return !rule || !occursOn(rule, startDate, after ?? day);
      },
      confirmLoss,
    );
    const updated = await prisma.$transaction(async (tx) => {
      await settle(tx);
      // Its occurrences edited alone follow the series (moved, the fields changed on it applied); none once it is a
      // one-off event.
      if (rule) await carryExceptions(tx, event, fields, { shift, to: id, rule, start: startDate });
      else await tx.calendarEventException.deleteMany({ where: { eventId: id } });
      await remapOccurrenceRows('eventId', id, moved, { client: tx });
      if (recurring) await moveRoutineLinks(tx, id, null, shift);
      return tx.calendarEvent.update({
        where: { id },
        data: {
          ...eventData(fields),
          startDate: parseDay(startDate),
          endDate: parseDay(endDate),
          recurrence: rule ?? Prisma.JsonNull,
          ...relations,
        },
      });
    });
    // A one-off event now: its routine links are those of its days.
    return { event: updated, linkDays: recurring ? newDays : null };
  }

  // FOLLOWING: the series ends before the occurrence, a new one starts with the changes.
  const rule = fields.recurrence && cutSeriesRule(fields.recurrence, occurrence.rule, seriesStart, occurrence.date, shift);
  // Following occurrences that the new series does not have once moved: their comments and times go, with the save.
  const settle = await confirmLostOccurrences(
    'eventId',
    id,
    (day) => day >= occurrence.date && occursOn(occurrence.rule, seriesStart, day) && (rule ? !occursOn(rule, fields.startDate, addDays(day, shift)) : day !== occurrence.date),
    confirmLoss,
  );
  const created = await prisma.$transaction(async (tx) => {
    await settle(tx);
    const split = await tx.calendarEvent.create({
      data: {
        ...eventData(fields),
        recurrence: rule ?? undefined,
        // A cancelled series stays so.
        calledOff: event.calledOff,
        ...eventRelations(fields),
        // The new series keeps the saved timers of the event.
        savedCountdowns: await linkedSavedCountdowns('EVENT', id, tx),
      },
    });
    // Its following occurrences edited alone go to the new series (none when it no longer repeats), then the old one
    // ends before the cut.
    if (rule) await carryExceptions(tx, event, fields, { from: occurrence.date, shift, to: split.id, rule, start: fields.startDate });
    await endSeriesBefore(event, occurrence.rule, occurrence.date, tx);
    // The comments, times and routine links of the following occurrences go to the new series, moved as the occurrence was.
    await remapOccurrenceRows('eventId', id, movedOccurrence(occurrence.date, shift, Boolean(rule)), { to: split.id, client: tx });
    await moveRoutineLinks(tx, id, occurrence.date, shift, split.id);
    return split;
  });
  return { event: created, linkDays: rule ? newDays : null };
}

/** Fields of an occurrence edited alone that a change of its series gives it too, when the series' value changes. */
const EXCEPTION_FIELDS = ['label', 'description', 'location', 'locationLat', 'locationLon', 'links', 'allDay', 'startTime', 'endTime', 'travelBefore', 'travelAfter'] as const;

/**
 * The occurrences of a series edited alone (its exceptions) follow a change of the series: moved to the new series of
 * a cut and / or shifted by as many days as the series, a deleted one staying deleted, a called off one called off,
 * its postponements still pointing at it; the fields the change gives the series another value take that value, the
 * others stay theirs. One that the new rule no longer has once moved goes (its comments and times went with it).
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {CalendarEvent} event Series before the change.
 * @param {Awaited<ReturnType<typeof parseEvent>>} fields Its fields once changed.
 * @param {{ from?: string, shift: number, to: string, rule: Recurrence, start: string }} change From which occurrence
 * (none: all), days moved, series they go to, its rule and first day.
 * @returns {Promise<void>}
 */
async function carryExceptions(
  tx: Prisma.TransactionClient,
  event: CalendarEvent,
  fields: Awaited<ReturnType<typeof parseEvent>>,
  change: { from?: string; shift: number; to: string; rule: Recurrence; start: string },
): Promise<void> {
  const since = change.from ? { gte: parseDay(change.from) } : undefined;
  const exceptions = await tx.calendarEventException.findMany({ where: { eventId: event.id, ...(since && { date: since }) }, orderBy: { date: change.shift > 0 ? 'desc' : 'asc' } });
  const comparable = (field: (typeof EXCEPTION_FIELDS)[number], value: unknown) => JSON.stringify(field === 'links' ? readLinks(value as Prisma.JsonValue) : (value ?? null));
  const changed = Object.fromEntries(EXCEPTION_FIELDS.filter((field) => comparable(field, event[field]) !== comparable(field, fields[field])).map((field) => [field, field === 'links' ? toJson(fields.links) : fields[field]]));
  // Its length changed: theirs too.
  const span = daysBetween(fields.startDate, fields.endDate);
  const spanChanged = span !== daysBetween(formatDay(event.startDate), formatDay(event.endDate));
  for (const exception of exceptions) {
    const date = addDays(formatDay(exception.date), change.shift);
    if (!occursOn(change.rule, change.start, date)) {
      await tx.calendarEventException.delete({ where: { id: exception.id } });
      continue;
    }
    const startDate = exception.startDate ? addDays(formatDay(exception.startDate), change.shift) : null;
    const endDate = spanChanged && startDate ? addDays(startDate, span) : exception.endDate ? addDays(formatDay(exception.endDate), change.shift) : null;
    await tx.calendarEventException.update({
      where: { id: exception.id },
      data: { eventId: change.to, date: parseDay(date), startDate: startDate && parseDay(startDate), endDate: endDate && parseDay(endDate), ...changed },
    });
  }
  // Its postponements still come from it.
  const postponed = await tx.calendarEvent.findMany({ where: { postponedFromId: event.id, ...(since && { postponedFromDate: since }) }, select: { id: true, postponedFromDate: true } });
  for (const item of postponed) {
    const from = formatOptionalDay(item.postponedFromDate);
    await tx.calendarEvent.update({ where: { id: item.id }, data: { postponedFromId: change.to, postponedFromDate: parseOptionalDay(from && addDays(from, change.shift)) } });
  }
}

/**
 * Whether a day is an occurrence of a rule (its excluded dates left out).
 * @param {Recurrence} rule Rule.
 * @param {string} start First day of the series.
 * @param {string} day Day.
 * @returns {boolean} An occurrence.
 */
const occursOn = (rule: Recurrence, start: string, day: string): boolean => occurrenceDates(rule, start, day, day).includes(day);

/**
 * Day of the occurrences of a series from a date once moved (a series moved, or split from that date): as many days
 * later or earlier; for a series that no longer repeats, its first occurrence becomes the single one (null) and the
 * others are left.
 * @param {string} from First occurrence moved.
 * @param {number} shift Days moved.
 * @param {boolean} recurring The series still repeats.
 * @returns {(date: string | null) => string | null | undefined} New day of an occurrence (undefined: left).
 */
function movedOccurrence(from: string, shift: number, recurring: boolean): (date: string | null) => string | null | undefined {
  return (date) => {
    if (date === null || date < from) return undefined;
    if (recurring) return addDays(date, shift);
    return date === from ? null : undefined;
  };
}

/**
 * Occurrences an event deletion takes: the whole event (a one-off event, every occurrence, or from the first one), one
 * occurrence, or it and the following ones.
 * @param {string} id Event id.
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence. Optional for a one-off event.
 * @returns {Promise<GoneOccurrences>} Occurrences deleted.
 */
export async function goneOccurrences(id: string, scope: EventScope, occurrenceDate?: string | null): Promise<GoneOccurrences> {
  const event = await findEvent(id);
  const occurrence = occurrenceOf(event, occurrenceDate);
  if (!occurrence || scope === 'ALL' || (scope === 'FOLLOWING' && occurrence.date === formatDay(event.startDate))) return { eventId: id };
  return scope === 'THIS' ? { eventId: id, on: occurrence.date } : { eventId: id, from: occurrence.date };
}

/**
 * Deletes an event, or for a recurring one: one occurrence, it and the following ones, or the whole series. The times
 * left with nothing attached are deleted first (billed ones kept), the times on the
 * occurrences deleted leave them, and their comments are deleted.
 * @param {string} id Event id.
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence. Optional for a one-off event.
 * @returns {Promise<void>}
 */
export async function deleteCalendarEvent(id: string, scope: EventScope, occurrenceDate?: string | null): Promise<void> {
  const event = await findEvent(id);
  const occurrence = occurrenceOf(event, occurrenceDate);
  const gone = await goneOccurrences(id, scope, occurrenceDate);
  await placeLegacyEventComments([id]);
  // Together: their times and comments go only with the occurrences.
  await prisma.$transaction(async (tx) => {
    await releaseSubjectTime({ events: [gone] }, tx);
    // The comments of the occurrences deleted go with them (a whole event: in cascade).
    if (gone.on || gone.from) await deleteGoneComments({ events: [{ id, on: gone.on, from: gone.from }] }, tx);
    if (!occurrence || (!gone.on && !gone.from)) {
      await tx.calendarEvent.delete({ where: { id } });
      return;
    }
    if (gone.on) {
      await tx.calendarEventException.upsert({
        where: { eventId_date: { eventId: id, date: parseDay(occurrence.date) } },
        create: { eventId: id, date: parseDay(occurrence.date), cancelled: true },
        update: { cancelled: true },
      });
      return;
    }
    await endSeriesBefore(event, occurrence.rule, occurrence.date, tx);
  });
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
  const instant = (day: string, time: string | null) => (time ? zonedInstant(day, time, PARIS) : parseDay(day));
  return {
    key: date ? occurrenceKey(event.id, date) : event.id,
    eventId: event.id,
    occurrenceDate: date,
    modified: change !== undefined,
    label: change?.label ?? event.label,
    description: change ? change.description : event.description,
    location: change ? change.location : event.location,
    locationLat: change ? change.locationLat : event.locationLat,
    locationLon: change ? change.locationLon : event.locationLon,
    links: readLinks(change?.links ?? event.links),
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    start: instant(startDate, startTime),
    end: allDay ? parseDay(addDays(endDate, 1)) : instant(endDate, endTime),
    recurrence: storedRecurrence(event.recurrence),
    seriesStartDate: seriesStart,
    reminders: readReminders(event.reminders),
    travelBefore: change?.travelBefore ?? event.travelBefore,
    travelAfter: change?.travelAfter ?? event.travelAfter,
    projectId: event.projectId,
    calendarId: event.calendarId,
    archived: event.archivedAt !== null,
    ...relationIdsOf(event),
    savedCountdownIds: event.savedCountdowns.map((saved) => saved.id),
    routineLinks: linksWithin(event.routineLinks, startDate, endDate),
    calledOff: event.calledOff || (change?.calledOff ?? false),
    postponedFrom: event.postponedFromId ? { eventId: event.postponedFromId, date: formatOptionalDay(event.postponedFromDate), label: event.postponedFrom?.label ?? '' } : null,
    postponedTo: event.postponements
      .filter((postponement) => formatOptionalDay(postponement.postponedFromDate) === date)
      .map((postponement) => ({ eventId: postponement.id, label: postponement.label, startDate: formatDay(postponement.startDate), startTime: postponement.startTime })),
    // A time on several events (occurrences) is shared equally between them, as between its tasks.
    trackedSeconds: Math.round(
      sumOf(
        event.timeEntryLinks.filter((link) => formatOptionalDay(link.occurrenceDate) === date),
        ({ timeEntry: entry }) =>
          entrySeconds({
            startedAt: entry.startedAt.toISOString(),
            endedAt: entry.endedAt?.toISOString() ?? null,
            pausedAt: entry.pausedAt?.toISOString() ?? null,
            pausedSeconds: entry.pausedSeconds,
            duration: entry.duration,
          }) / Math.max(1, entry._count.events),
      ),
    ),
    series: change ? seriesFieldsOf(toOccurrence(event, date, undefined)) : null,
  };
}

/**
 * Fields an occurrence changed on its own may have apart from its series, of an occurrence.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {EventSeriesFields} Fields.
 */
function seriesFieldsOf(occurrence: EventOccurrence): EventSeriesFields {
  return Object.fromEntries(OWN_FIELDS.map((field) => [field, occurrence[field]])) as EventSeriesFields;
}

/**
 * Occurrence of a recurring event on a date, as shown: with its own changes.
 * @param {EventWithRelations} event Event.
 * @param {string} date Occurrence date.
 * @returns {EventOccurrence} Occurrence.
 */
function shownOccurrence(event: EventWithRelations, date: string): EventOccurrence {
  return toOccurrence(event, date, event.exceptions.find((change) => formatDay(change.date) === date));
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
      OR: [
        { startDate: { lte: parseDay(addDays(to, 62)) }, OR: [{ recurrence: { not: Prisma.DbNull } }, { endDate: { gte: parseDay(addDays(from, -62)) } }] },
        // An occurrence moved alone into the period from further away.
        { exceptions: { some: { cancelled: false, startDate: { lte: parseDay(to) }, endDate: { gte: parseDay(from) } } } },
      ],
      ...(calendarIds ? { calendarId: { in: calendarIds } } : {}),
      ...(activeOnly ? { archivedAt: null, calendar: { archivedAt: null } } : {}),
    },
    include: occurrenceInclude,
  });
  const result: EventOccurrence[] = [];
  for (const event of events) {
    const rule = storedRecurrence(event.recurrence);
    // Archived: its occurrences started before the day it was archived stay (archived), none starting on or after it.
    const archived = archivedOn(event);
    const changes = new Map(event.exceptions.map((change) => [formatDay(change.date), change]));
    const span = daysBetween(formatDay(event.startDate), formatDay(event.endDate));
    // Moved occurrences may come from a little outside the period.
    const longest = Math.max(span, rule?.duration ? maxSpanDays(rule.duration) : 0);
    const near: (string | null)[] = rule ? occurrenceDates(rule, formatDay(event.startDate), addDays(from, -longest - 62), addDays(to, 62)) : [null];
    // Occurrences moved alone into the period from further away (one of the rule's days).
    const far = rule
      ? event.exceptions
          .filter((change) => !change.cancelled && change.startDate && formatDay(change.startDate) <= to && formatDay(change.endDate ?? change.startDate) >= from)
          .map((change) => formatDay(change.date))
          .filter((date) => !near.includes(date) && occursOn(rule, formatDay(event.startDate), date))
      : [];
    const dates = [...near, ...far];
    for (const date of dates) {
      const change = date ? changes.get(date) : undefined;
      if (change?.cancelled) continue;
      const occurrence = toOccurrence(event, date, change);
      if (archived && occurrence.startDate >= archived) continue;
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
    links: readLinks(event.links),
    allDay: event.allDay,
    startDate: date,
    startTime: event.startTime,
    endDate: addDays(date, span),
    endTime: event.endTime,
    recurrence: storedRecurrence(event.recurrence),
    reminders: readReminders(event.reminders),
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
function findEventWithRelations(id: string): Promise<EventWithRelations> {
  return orNotFound(prisma.calendarEvent.findUnique({ where: { id }, include: occurrenceInclude }), 'Évènement');
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
    // The series only: its occurrences called off one by one (or postponed) stay so when it is restored.
    await prisma.calendarEvent.update({ where: { id }, data: { calledOff } });
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
        links: toJson(current.links),
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
 * one-off event, linked to it, takes the new date, with the comments and times of the occurrence.
 * @param {string} id Event id.
 * @param {string | null | undefined} occurrenceDate Occurrence. Optional for a one-off event.
 * @param {CalendarEventInput} input New event (its dates, label…).
 * @returns {Promise<CalendarEvent>} New event.
 */
export async function postponeCalendarEvent(id: string, occurrenceDate: string | null | undefined, input: CalendarEventInput): Promise<CalendarEvent> {
  const event = await findEvent(id);
  await assertEventWritable(event);
  await placeLegacyEventComments([id]);
  const occurrence = occurrenceOf(event, occurrenceDate);
  const fields = await parseEvent({ ...input, recurrence: null }, ...(await eventKept(id)));
  const created = await prisma.calendarEvent.create({
    data: {
      ...eventData(fields),
      recurrence: undefined,
      postponedFromId: id,
      postponedFromDate: parseOptionalDay(occurrence?.date ?? null),
      ...eventRelations(fields),
      savedCountdowns: await linkedSavedCountdowns('EVENT', id),
    },
  });
  // Its days before it is postponed: their routine links go with it.
  const shown = occurrence ? shownOccurrence(await findEventWithRelations(id), occurrence.date) : null;
  await setEventCalledOff(id, 'THIS', occurrence?.date ?? null, true);
  // The comments and times of the occurrence follow it to its postponement (a one-off event: its single occurrence),
  // and its routine links (those given, on its new days).
  const from = occurrence?.date ?? null;
  await remapOccurrenceRows('eventId', id, (date) => (date === from ? null : undefined), { to: created.id });
  await prisma.calendarEventRoutine.deleteMany({
    where: { eventId: id, ...(shown && { date: { gte: parseDay(shown.startDate), lte: parseDay(shown.endDate) } }) },
  });
  await saveRoutineLinks(created.id, fields.routineLinks, null);
  // Postponed into another project: its contributors follow.
  await followProject(event.projectId, created.projectId, fields.contributorIds);
  return created;
}
