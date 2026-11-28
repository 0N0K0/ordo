import {
  addDays,
  type CalendarEventInput,
  calendarEventInputSchema,
  daysBetween,
  entrySeconds,
  type EventScope,
  formatDay,
  formatOptionalDay,
  groupBy,
  type ItemLink,
  maxSpanDays,
  occurrenceDates,
  occurrencesBefore,
  subtreeOf,
  cutSeries,
  type MovedSeries,
  seriesHolding,
  seriesOn,
  parseDay,
  parseOptionalDay,
  type Recurrence,
  sharePeople,
  spanEnd,
  sumOf,
  zonedInstant,
  occurrenceKey,
  normalizedReminders,
  readReminders,
  type Reminder,
  type EffectiveTask,
  shiftedSeries,
  storedRecurrence,
  shiftedRoutineLink,
  linkedEventOccurrence,
  occurrencesShowing,
  prunedExceptions,
  postponedRestoreRefusal,
  lastShownOccurrence,
  firstShownOccurrence as firstShownDay,
} from '@ordo/shared';
import { inTransaction, prisma } from '../../db';
import { PARIS } from '../../today';
import { assertBeneficiaries } from '../core/beneficiaries';
import { Prisma, type CalendarEvent, type CalendarEventException } from '../../generated/prisma/client';
import { linkedSavedCountdowns } from '../tasks/saved-countdowns';
import { copiedEventSheetLinks } from '../shopping/sheets';
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
import { assertLossConfirmed, confirmLostOccurrences, refusedLoss, deleteGoneOccurrenceRows, remapOccurrenceRows } from '../core/occurrence-rows';
import { placeLegacyComments } from '../core/comments';
import { readLinks } from '../core/links';
import { storedLocation } from '../core/geo';
import { effectiveTasks } from '../tasks/task-inheritance';
import { effectiveRoutineOf, loadRoutineInheritance, type StoredInheritingRoutine } from '../routines/routine-inheritance';
import { linkShownDays, loadLinkShownDays, resolveRoutineLinks, ROUTINE_LINK_SELECT, type RoutineLinkRow } from './routine-link-days';
import { loadScheduleContext, type ScheduleContext } from '../routines/routine-occurrences';

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
  /** Last occurrence of its series still shown (the day of its rule; those deleted alone left out): null without an end or for a one-off event. */
  lastShownDate: string | null;
  /** First occurrence of its series still shown (the day of its rule; those deleted alone left out): null for a one-off event. */
  firstShownDate: string | null;
}

/** An occurrence of a series deleted, cancelled or changed alone (`CalendarEventException`), as its exceptions list it. */
export interface EventException {
  /** Day of its rule: the day that identifies it (its comments, times, checklist). */
  date: string;
  /** Deleted alone: nothing that day. */
  cancelled: boolean;
  /** Cancelled, kept struck through. */
  calledOff: boolean;
  /** Postponed: the first day of its postponement; else null. */
  postponedTo: string | null;
  /** Its label (that of its series when not changed). */
  label: string;
  /** Days and hours it shows on (those of its series when not moved). */
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  /** Other hours (or days length, or whole day) than its series on its day. */
  otherHours: boolean;
  /** Another label, description, place, links or travel than its series on its day. */
  changed: boolean;
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
 * First occurrence of a recurring event shown in the calendar: the first day of its rule (its « rien » exceptions
 * left out), not deleted on its own (a `cancelled` exception); scanned year by year (`firstShownOccurrence` of `@ordo/shared`).
 * @param {Pick<CalendarEvent, 'id' | 'startDate' | 'recurrence'>} event Event.
 * @param {object} [client] Client or transaction. Optional. Default = the client of the workspace.
 * @returns {Promise<string | null>} Day, null for a one-off event or without any.
 */
export async function firstShownOccurrence(event: Pick<CalendarEvent, 'id' | 'startDate' | 'recurrence'>, client: Prisma.TransactionClient = prisma): Promise<string | null> {
  const rule = storedRecurrence(event.recurrence);
  if (!rule) return null;
  const deleted = new Set((await client.calendarEventException.findMany({ where: { eventId: event.id, cancelled: true }, select: { date: true } })).map((change) => formatDay(change.date)));
  return firstShownDay(rule, formatDay(event.startDate), deleted) ?? null;
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

/** Days the routine links of an event loaded show on (`linkShownDays`), by its list of links: computed once for all its occurrences. */
const linkDaysOfEvent = new WeakMap<readonly RoutineLinkRow[], (link: RoutineLinkRow) => string>();

/** Without the schedules loaded: the days of the rules only (an occurrence its condition moves back is not seen). */
const RULE_DAYS_ONLY: ScheduleContext = { slotsOn: () => [] };

/**
 * Loads once what tells the days the routine links of some events show on (`linkShownDays`: the real due day of each
 * occurrence, with the schedules of the workspace), before their occurrences are built (`linksWithin`).
 * @param {readonly { routineLinks: readonly RoutineLinkRow[] }[]} events Events loaded.
 * @returns {Promise<void>}
 */
async function primeLinkDays(events: readonly { routineLinks: readonly RoutineLinkRow[] }[]): Promise<void> {
  const unknown = events.filter((event) => event.routineLinks.length && !linkDaysOfEvent.has(event.routineLinks));
  if (!unknown.length) return;
  const shownDay = linkShownDays(await loadScheduleContext());
  for (const event of unknown) linkDaysOfEvent.set(event.routineLinks, shownDay);
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
  // One computation per event loaded, shared by all its occurrences (loaded with the schedules: `primeLinkDays`).
  let shownDay = linkDaysOfEvent.get(links);
  if (!shownDay) linkDaysOfEvent.set(links, (shownDay = linkShownDays(RULE_DAYS_ONLY)));
  return links
    .map((link) => ({ routineId: link.routineId, date: formatDay(link.date), shownDate: shownDay(link) }))
    .filter((link) => link.shownDate >= from && link.shownDate <= to);
}

/** Days of an occurrence (first and last, included). */
interface OccurrenceDays {
  from: string;
  to: string;
}

/**
 * Routine links of an event, with what tells the day each one shows on (`linkShownDays`).
 * @param {string} eventId Event.
 * @param {Prisma.TransactionClient} [client] Client or transaction. Optional. Default = the client of the workspace.
 * @returns {Promise<(RoutineLinkRow & { id: string })[]>} Links.
 */
function heldRoutineLinks(eventId: string, client: Prisma.TransactionClient = prisma): Promise<(RoutineLinkRow & { id: string })[]> {
  return client.calendarEventRoutine.findMany({ where: { eventId }, select: { id: true, ...ROUTINE_LINK_SELECT } });
}

/**
 * Where of the routine links of an event on some days: by the day each occurrence shows on (one kept apart is stored
 * on the day of its rule).
 * @param {string} eventId Event.
 * @param {{ from: string, to?: string } | null} days Days (no `to`: from that day on); null: every link of the event.
 * @returns {Promise<Prisma.CalendarEventRoutineWhereInput>} Where of those links.
 */
async function routineLinksOn(eventId: string, days: { from: string; to?: string } | null): Promise<Prisma.CalendarEventRoutineWhereInput> {
  if (!days) return { eventId };
  const held = await heldRoutineLinks(eventId);
  const shownDay = linkShownDays(await loadScheduleContext());
  const within = held.filter((link) => {
    const day = shownDay(link);
    return day >= days.from && (days.to === undefined || day <= days.to);
  });
  return { eventId, id: { in: within.map((link) => link.id) } };
}

/**
 * Where of the routine links of occurrences of a series that go (deleted, postponed), by their identity: those shown on
 * the days of these occurrences (as shown, moved alone included), but those shown on a day of an occurrence that
 * stays (an earlier one moved past a cut, another one moved onto those days: they show them too); from a cut on, a
 * link of a day no occurrence shows goes as well.
 * @param {EventWithRelations} event Event (its exceptions as they are before the change).
 * @param {{ on: string } | { from: string }} gone The occurrence identified by that day, or every one from that day on.
 * @returns {Promise<Prisma.CalendarEventRoutineWhereInput>} Where of those links.
 */
async function goneRoutineLinks(event: EventWithRelations, gone: { on: string } | { from: string }): Promise<Prisma.CalendarEventRoutineWhereInput> {
  const { held, occurrences } = await shownRoutineLinks(event);
  const goes = (occurrence: EventOccurrence) => occurrence.occurrenceDate !== null && ('on' in gone ? occurrence.occurrenceDate === gone.on : occurrence.occurrenceDate >= gone.from);
  const within = held.filter(({ day }) => {
    const shown = occurrencesShowing(occurrences, day);
    if (!shown.length) return 'from' in gone && day >= gone.from;
    return shown.some(goes) && shown.every(goes);
  });
  return { eventId: event.id, id: { in: within.map((link) => link.id) } };
}

/**
 * Number of the routine links of an event that go with occurrences a change makes disappear: those following one of
 * them (`linkedEventOccurrence`, as they move with a series: `moveRoutineLinks`); its repetition removed, every link
 * from an occurrence on but those shown on the days of the occurrence edited (they are given anew).
 * @param {EventWithRelations} event Event (its exceptions as they are before the change).
 * @param {(day: string) => boolean} gone Whether an occurrence (the day that identifies it) disappears.
 * @param {{ from: string, kept: OccurrenceDays }} [replaced] Repetition removed: the first occurrence whose links leave
 * the event, and the days of the occurrence edited. Optional. Default = a series kept.
 * @returns {Promise<number>} Links.
 */
async function lostRoutineLinks(event: EventWithRelations, gone: (day: string) => boolean, replaced?: { from: string; kept: OccurrenceDays }): Promise<number> {
  const { held, occurrences } = await shownRoutineLinks(event);
  return held.filter((link) => {
    const occurrence = linkedEventOccurrence(occurrences, link.day);
    if (replaced) return (occurrence ?? link.day) >= replaced.from && (link.day < replaced.kept.from || link.day > replaced.kept.to);
    return occurrence !== null && gone(occurrence);
  }).length;
}

/**
 * Where of the routine links that a deletion of an event (or of some of its occurrences) takes, for its confirmation:
 * every one of a whole event, those of its occurrences deleted otherwise (`goneRoutineLinks`).
 * @param {GoneOccurrences} gone Occurrences deleted (`goneOccurrences`).
 * @returns {Promise<Prisma.CalendarEventRoutineWhereInput>} Where of those links.
 */
export async function routineLinksGoneWhere(gone: GoneOccurrences): Promise<Prisma.CalendarEventRoutineWhereInput> {
  if (!gone.on && !gone.from) return { eventId: gone.eventId };
  return goneRoutineLinks(await findEventWithRelations(gone.eventId), gone.on ? { on: gone.on } : { from: gone.from! });
}

/**
 * Routine links of an event, each with the day it shows on (`linkShownDays`), and the occurrences of the event shown
 * on those days (as the event is loaded: its exceptions before a change).
 * @param {EventWithRelations} event Event.
 * @param {Prisma.TransactionClient} [client] Client or transaction. Optional. Default = the client of the workspace.
 * @returns {Promise<{ held: (RoutineLinkRow & { id: string, day: string })[], occurrences: EventOccurrence[] }>} Links and occurrences.
 */
async function shownRoutineLinks(
  event: EventWithRelations,
  client: Prisma.TransactionClient = prisma,
): Promise<{ held: (RoutineLinkRow & { id: string; day: string })[]; occurrences: EventOccurrence[] }> {
  // The days computed when the event was loaded (`findEventWithRelations`), else with the schedules loaded now.
  const shownDay = linkDaysOfEvent.get(event.routineLinks) ?? linkShownDays(await loadScheduleContext());
  const held = (await heldRoutineLinks(event.id, client)).map((link) => ({ ...link, day: shownDay(link) }));
  const days = held.map((link) => link.day).sort();
  return { held, occurrences: days.length ? seriesOccurrences(event, days[0], days.at(-1)!) : [] };
}

/**
 * Sets the routines of the days of an occurrence: the links of the days it had are replaced by those given (the links
 * of its other days kept, as those already on its new days: another occurrence may have them), each once by
 * `routineId|date`.
 * @param {string} eventId Event the occurrence belongs to.
 * @param {readonly { routineId: string, date: string, shownDate?: string }[]} given Routines of its days (`shownDate`: moved with it, `resolveRoutineLinks`).
 * @param {OccurrenceDays | null} replaced Days whose links are replaced; null: every link of the event (a one-off event).
 * @returns {Promise<void>}
 */
async function saveRoutineLinks(eventId: string, given: readonly { routineId: string; date: string; shownDate?: string }[], replaced: OccurrenceDays | null): Promise<void> {
  // Moved with the event: each goes to the occurrence shown on its new day (none: dropped).
  const links = await resolveRoutineLinks(given);
  // The links of its days: by the day each occurrence shows on.
  const gone = await routineLinksOn(eventId, replaced);
  await prisma.$transaction([
    prisma.calendarEventRoutine.deleteMany({ where: gone }),
    prisma.calendarEventRoutine.createMany({
      data: [...new Map(links.map((link) => [occurrenceKey(link.routineId, link.date), link])).values()].map((link) => ({ eventId, routineId: link.routineId, date: parseDay(link.date) })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * Moves the routine links of the occurrences of a series from an occurrence, with them: each follows its occurrence
 * (`linkedEventOccurrence`: the one shown on its day, by the day that identifies it, as comments and times do; none or
 * several shown there: by its day), by as many days as it is moved (from the day each occurrence of a routine shows
 * on: the occurrence of that routine shown on the new day is linked, none there: the link is dropped,
 * `resolveRoutineLinks`), and / or to another event (a series split, or split into several).
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {EventWithRelations} event Event, as it was before the change (its exceptions tell the days of its occurrences).
 * @param {string | null} from First occurrence moved (the day that identifies it); null: every link.
 * @param {number} shift Days moved.
 * @param {string | ((day: string, occurrence: string | null) => string | null)} [to] Event they go to, or the event of
 * each one by the new day it shows on and the day that identifies its occurrence once moved (null: none followed); a
 * null event: the link goes, with its occurrence lost by the change. Optional. Default = the same.
 * @returns {Promise<void>}
 */
async function moveRoutineLinks(
  tx: Prisma.TransactionClient,
  event: EventWithRelations,
  from: string | null,
  shift: number,
  to: string | ((day: string, occurrence: string | null) => string | null) = event.id,
): Promise<void> {
  if (shift === 0 && to === event.id) return;
  const targetOf = typeof to === 'string' ? () => to : to;
  const { held, occurrences } = await shownRoutineLinks(event, tx);
  const moving = held.flatMap((link) => {
    const occurrence = linkedEventOccurrence(occurrences, link.day);
    if (from && (occurrence ?? link.day) < from) return [];
    return [{ id: link.id, occurrence: occurrence && addDays(occurrence, shift), ...shiftedRoutineLink({ routineId: link.routineId, date: formatDay(link.date) }, link.day, shift) }];
  });
  if (!moving.length) return;
  await tx.calendarEventRoutine.deleteMany({ where: { id: { in: moving.map((link) => link.id) } } });
  for (const [target, group] of groupBy(moving, (link) => targetOf(link.shownDate, link.occurrence))) {
    if (target === null) continue;
    const links = shift === 0 ? group.map(({ routineId, date }) => ({ routineId, date })) : await resolveRoutineLinks(group);
    await tx.calendarEventRoutine.createMany({
      data: links.map((link) => ({ eventId: target, routineId: link.routineId, date: parseDay(link.date) })),
      skipDuplicates: true,
    });
  }
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
  const loaded = await loadLinkShownDays(event.routineLinks);
  // Moved with the event: the day it shows on now is given.
  const shownOn = (link: { routineId: string; date: string; shownDate?: string }) => link.shownDate ?? loaded(link);
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
      recurrence: event.recurrence ? prunedExceptions(event.recurrence, event.startDate) : undefined,
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
 * @param {boolean} [confirmLoss] Occurrences made to disappear, with comments, times or checklists, confirmed (`confirmLostOccurrences`). Optional.
 * @param {Recurrence | null} [movedRule] New rule of a series on the last day of the month moved to another day (FOLLOWING,
 * ALL), chosen by the user; none there: refused with the rule proposed (`RULE_CHOICE_REQUIRED`). Optional.
 * @param {EventExceptionsChange} [exceptions] Exceptions of the series restored (`restoreEventException`) and changed
 * alone (`changeEventException`) with the save, first, in the same transaction: all or nothing. Optional.
 * @returns {Promise<CalendarEvent>} Updated (or new, after a split) event.
 */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
  scope: EventScope,
  occurrenceDate?: string | null,
  confirmLoss?: boolean,
  movedRule?: Recurrence | null,
  exceptions?: EventExceptionsChange,
): Promise<CalendarEvent> {
  if (!exceptions || (!exceptions.restored.length && !exceptions.changed.length)) return savedCalendarEvent(id, input, scope, occurrenceDate, confirmLoss, movedRule);
  // Its exceptions restored and changed first, on the series as it is, then the save: all or nothing.
  // Their losses and those of the save are confirmed together: added up, then nothing changed while unconfirmed.
  return inTransaction(async () => {
    let links = 0;
    for (const date of exceptions.restored) links += await restoreEventException(id, date);
    // One restored is not changed too.
    for (const change of exceptions.changed.filter((item) => !exceptions.restored.includes(item.date))) await changeEventException(id, change);
    let saved: CalendarEvent;
    try {
      saved = await savedCalendarEvent(id, input, scope, occurrenceDate, confirmLoss, movedRule);
    } catch (error) {
      const lost = refusedLoss(error);
      if (lost) assertLossConfirmed([lost, { times: 0, comments: 0, checklists: 0, links }], false);
      throw error;
    }
    assertLossConfirmed([{ times: 0, comments: 0, checklists: 0, links }], confirmLoss);
    return saved;
  });
}

/**
 * Saves a change of an event (`updateCalendarEvent` without exceptions given).
 * @param {string} id Event id.
 * @param {CalendarEventInput} input Fields.
 * @param {EventScope} scope Scope.
 * @param {string | null} [occurrenceDate] Occurrence. Optional for a one-off event.
 * @param {boolean} [confirmLoss] Loss confirmed. Optional.
 * @param {Recurrence | null} [movedRule] New rule chosen for a series on the last day of the month. Optional.
 * @returns {Promise<CalendarEvent>} Event saved.
 */
async function savedCalendarEvent(
  id: string,
  input: CalendarEventInput,
  scope: EventScope,
  occurrenceDate?: string | null,
  confirmLoss?: boolean,
  movedRule?: Recurrence | null,
): Promise<CalendarEvent> {
  const before = (await findEvent(id)).projectId;
  const { event: updated, linkDays, linkShift = 0 } = await updateEventFields(id, input, scope, occurrenceDate, confirmLoss, movedRule ?? null);
  const fields = parseInput(calendarEventInputSchema, input);
  // A new project (not for one occurrence: it keeps the one of its series): the contributors follow the event into it.
  await followProject(before, updated.projectId, fields.contributorIds);
  // The routines of the days of the occurrence edited, on the event it now belongs to (given on the days of its series,
  // they go to its own days when it was changed alone: shown on other days).
  const shownOn = linkShift ? await loadLinkShownDays(fields.routineLinks) : null;
  const links = shownOn ? fields.routineLinks.map((link) => shiftedRoutineLink(link, link.shownDate ?? shownOn(link), linkShift)) : fields.routineLinks;
  await saveRoutineLinks(updated.id, links, linkDays);
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
 * @param {Recurrence | null} [movedRule] New rule chosen for a series on the last day of the month moved (`shiftedSeries`,
 * `cutSeries`). Optional. Default = none.
 * @returns {Promise<{ event: CalendarEvent, linkDays: OccurrenceDays | null, linkShift?: number }>} Event the occurrence
 * belongs to, the days whose routine links its own replace (null: every link of a one-off event), and the days from
 * those the input gives to its own (an occurrence changed alone, edited with its series: shown on other days).
 */
async function updateEventFields(
  id: string,
  input: CalendarEventInput,
  scope: EventScope,
  occurrenceDate?: string | null,
  confirmLoss?: boolean,
  movedRule: Recurrence | null = null,
): Promise<{ event: CalendarEvent; linkDays: OccurrenceDays | null; linkShift?: number }> {
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
      const saved = await tx.calendarEvent.update({ where: { id }, data: { ...eventData(fields), recurrence: fields.recurrence ? prunedExceptions(fields.recurrence, fields.startDate) : Prisma.DbNull, ...relations } });
      // Now repeating: the comments and times of its single occurrence go to its first one shown.
      const first = fields.recurrence ? await firstShownOccurrence(saved, tx) : null;
      if (first) await remapOccurrenceRows('eventId', id, (date) => (date === null ? first : undefined), { client: tx });
      return saved;
    });
    return { event: updated, linkDays: null };
  }
  const seriesStart = formatDay(event.startDate);
  // As it is before the change: the days of its occurrences tell those their routine links follow.
  const loaded = await findEventWithRelations(id);

  if (scope === 'THIS') {
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
  // month or of the year, once moved). Weekly with its weeks counted, the weekdays changing week apart from the others
  // make series of their own (a single rule cannot hold both).
  const shift = daysBetween(occurrence.date, fields.startDate);
  const span = daysBetween(fields.startDate, fields.endDate);

  if (scope === 'ALL' || occurrence.date === seriesStart) {
    // Its repetition removed: the event becomes the occurrence edited, on its day; else the series moves by as much as
    // the occurrence did, the event keeping the series of the occurrence edited.
    // On the last day of the month: the new rule chosen (none: refused with the rule proposed for the day it goes to).
    const series = fields.recurrence ? shiftedSeries(fields.recurrence, seriesStart, shift, movedRule, fields.startDate) : [];
    const own = series.length ? seriesOn(series, fields.startDate) : null;
    const startDate = own ? own.start : fields.startDate;
    const moved = own ? movedOccurrence(seriesStart, shift, true) : movedOccurrence(occurrence.date, 0, false);
    // Occurrences that no longer exist once moved (another rule, no longer repeating): their comments, times,
    // checklists and routine links go, with the save.
    const gone = (day: string) => {
      if (!occursOn(occurrence.rule, seriesStart, day)) return false;
      const after = moved(day);
      if (after === null) return false;
      return !series.some((item) => occursOn(item.rule, item.start, after ?? day));
    };
    // No longer repeating: the links of its other occurrences go (`saveRoutineLinks` replaces every one).
    const shown = shownOccurrence(loaded, occurrence.date);
    const replaced = own ? undefined : { from: seriesStart, kept: { from: shown.startDate, to: shown.endDate } };
    const settle = await confirmLostOccurrences('eventId', id, gone, confirmLoss, await lostRoutineLinks(loaded, gone, replaced));
    const updated = await prisma.$transaction(async (tx) => {
      await settle(tx);
      if (own) {
        // The other series are new events; the occurrences edited alone, comments, times and routine links follow
        // their occurrence into its series (moved, the fields changed applied).
        const others = series.filter((item) => item !== own);
        const created = await createSeries(tx, event, fields, others, span);
        const targets = [{ ...own, to: id }, ...others.map((item, index) => ({ ...item, to: created[index].id }))];
        await followSeries(tx, loaded, fields, { from: seriesStart, shift, targets, span });
      } else {
        // A one-off event now: no occurrence of its own.
        await tx.calendarEventException.deleteMany({ where: { eventId: id } });
        await remapOccurrenceRows('eventId', id, moved, { client: tx });
      }
      return tx.calendarEvent.update({
        where: { id },
        data: {
          ...eventData(fields),
          startDate: parseDay(startDate),
          endDate: parseDay(addDays(startDate, span)),
          recurrence: own?.rule ? prunedExceptions(own.rule, startDate) : Prisma.DbNull,
          ...relations,
        },
      });
    });
    // A one-off event now: its routine links are those of its days.
    return own ? { event: updated, ...(await editedOccurrenceDays(updated.id, addDays(occurrence.date, shift), newDays)) } : { event: updated, linkDays: null };
  }

  // FOLLOWING: the series ends before the occurrence, a new one starts with the changes (one per group of weekdays
  // changing week apart, see above).
  const series = fields.recurrence ? cutSeries(fields.recurrence, occurrence.rule, seriesStart, occurrence.date, shift, movedRule) : [];
  const own = series.length ? seriesOn(series, fields.startDate) : null;
  // Following occurrences that the new series do not have once moved: their comments, times, checklists and routine
  // links go, with the save.
  const gone = (day: string) =>
    day >= occurrence.date && occursOn(occurrence.rule, seriesStart, day) && (own ? !series.some((item) => occursOn(item.rule, item.start, addDays(day, shift))) : day !== occurrence.date);
  // No longer repeating: the links of the following occurrences go with them (moved, then replaced: `saveRoutineLinks`).
  const shown = shownOccurrence(loaded, occurrence.date);
  const replaced = own ? undefined : { from: occurrence.date, kept: { from: shown.startDate, to: shown.endDate } };
  const settle = await confirmLostOccurrences('eventId', id, gone, confirmLoss, await lostRoutineLinks(loaded, gone, replaced));
  const created = await prisma.$transaction(async (tx) => {
    await settle(tx);
    if (!own) {
      // No longer repeating: the occurrence edited is the new event.
      const [split] = await createSeries(tx, event, fields, [{ rule: null, start: fields.startDate }], span);
      await endSeriesBefore(event, occurrence.rule, occurrence.date, tx);
      await remapOccurrenceRows('eventId', id, movedOccurrence(occurrence.date, shift, false), { to: split.id, client: tx });
      await moveRoutineLinks(tx, loaded, occurrence.date, shift, split.id);
      return split;
    }
    // Its following occurrences edited alone, comments, times and routine links go to the new series of their
    // occurrence, moved as the occurrence was; then the old one ends before the cut.
    const created = await createSeries(tx, event, fields, series, span);
    const targets = series.map((item, index) => ({ ...item, to: created[index].id }));
    const ownTarget = targets[series.indexOf(own)];
    await followSeries(tx, loaded, fields, { from: occurrence.date, shift, targets: [ownTarget, ...targets.filter((target) => target !== ownTarget)], span });
    await endSeriesBefore(event, occurrence.rule, occurrence.date, tx);
    return created[series.indexOf(own)];
  });
  return own ? { event: created, ...(await editedOccurrenceDays(created.id, addDays(occurrence.date, shift), newDays)) } : { event: created, linkDays: null };
}

/** A series an event's occurrences go to once moved: its rule, its first day, and its event. */
interface SeriesTarget extends MovedSeries {
  to: string;
}

/**
 * Creates the events of new series of an event changed (a cut, or the series its weekdays changing week apart make):
 * its fields changed, each on its rule and from its first day, cancelled if the event was (`calledOff` kept), with its
 * saved timers and its sheets.
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {CalendarEvent} event Event before the change.
 * @param {Awaited<ReturnType<typeof parseEvent>>} fields Its fields once changed.
 * @param {readonly { rule: Recurrence | null, start: string }[]} series Series (no rule: a one-off event).
 * @param {number} span Days from the first day of an occurrence to its last.
 * @returns {Promise<CalendarEvent[]>} Events created, in the order of the series.
 */
async function createSeries(
  tx: Prisma.TransactionClient,
  event: CalendarEvent,
  fields: Awaited<ReturnType<typeof parseEvent>>,
  series: readonly { rule: Recurrence | null; start: string }[],
  span: number,
): Promise<CalendarEvent[]> {
  const created: CalendarEvent[] = [];
  for (const item of series) {
    created.push(
      await tx.calendarEvent.create({
        data: {
          ...eventData(fields),
          startDate: parseDay(item.start),
          endDate: parseDay(addDays(item.start, span)),
          recurrence: item.rule ? prunedExceptions(item.rule, item.start) : undefined,
          // A cancelled series stays so.
          calledOff: event.calledOff,
          ...eventRelations(fields),
          // The new series keeps the saved timers of the event.
          savedCountdowns: await linkedSavedCountdowns('EVENT', event.id, tx),
          // And its sheets: the checklists of its occurrences to come.
          sheetLinks: await copiedEventSheetLinks(event.id, tx),
        },
      }),
    );
  }
  return created;
}

/**
 * The series of an occurrence among those an event's occurrences go to: the one with an occurrence starting on a day or
 * within the days before it the occurrences last (a day shown by a routine link); the first one otherwise.
 * @param {readonly SeriesTarget[]} targets Series (the first: that of the occurrence edited).
 * @param {string} day Day, once moved.
 * @param {number} [span=0] Days an occurrence lasts after its first. Optional. Default = 0 (the day an occurrence starts).
 * @returns {SeriesTarget} Series.
 */
function targetOn(targets: readonly SeriesTarget[], day: string, span = 0): SeriesTarget {
  return seriesHolding(targets, day, span) ?? targets[0];
}

/**
 * Everything kept per occurrence of a series follows its occurrence from a day into the series it goes to, moved by as
 * many days: the occurrences edited alone (`carryExceptions`), their comments and times (`remapOccurrenceRows`), the
 * routine links with the occurrence shown on their day (`moveRoutineLinks`, by their day when none or several show
 * it); what fits none goes to the series of the occurrence edited.
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {EventWithRelations} event Series before the change (its exceptions as they were).
 * @param {Awaited<ReturnType<typeof parseEvent>>} fields Its fields once changed.
 * @param {{ from: string, shift: number, targets: SeriesTarget[], span: number }} change First occurrence moved, days
 * moved, series they go to (the first: that of the occurrence edited) and days an occurrence lasts after its first.
 * @returns {Promise<void>}
 */
async function followSeries(
  tx: Prisma.TransactionClient,
  event: EventWithRelations,
  fields: Awaited<ReturnType<typeof parseEvent>>,
  change: { from: string; shift: number; targets: SeriesTarget[]; span: number },
): Promise<void> {
  const { from, shift, targets } = change;
  await carryExceptions(tx, event, fields, { from, shift, targets });
  // Those leaving the event first, then those staying on it: a row leaves a day before another takes it.
  const ordered = [...targets.filter((target) => target.to !== event.id), ...targets.filter((target) => target.to === event.id)];
  for (const target of ordered) {
    await remapOccurrenceRows(
      'eventId',
      event.id,
      (date) => {
        if (date === null || date < from) return undefined;
        const after = addDays(date, shift);
        return targetOn(targets, after) === target ? after : undefined;
      },
      { to: target.to, client: tx },
    );
  }
  // A link of an occurrence goes to the series of that occurrence, as its comments (none has it: it goes with its
  // comments); one of no occurrence, by its day.
  await moveRoutineLinks(tx, event, from, shift, (day, occurrence) => (occurrence ? (seriesHolding(targets, occurrence)?.to ?? null) : targetOn(targets, day, change.span).to));
}

/**
 * Days an occurrence edited with its series shows on once saved: those of its series (`newDays`), or, changed alone
 * (an exception carried with the series), its own (as many as its series has, from its first: those it has more keep
 * their links); and the days from the former to the latter.
 * @param {string} eventId Event it now belongs to.
 * @param {string} date Day that identifies it now.
 * @param {OccurrenceDays} newDays Its days in the series, as given.
 * @returns {Promise<{ linkDays: OccurrenceDays, linkShift: number }>} Its days whose routine links are replaced, and the days its routine links move by.
 */
async function editedOccurrenceDays(eventId: string, date: string, newDays: OccurrenceDays): Promise<{ linkDays: OccurrenceDays; linkShift: number }> {
  const exception = await prisma.calendarEventException.findUnique({ where: { eventId_date: { eventId, date: parseDay(date) } }, select: { startDate: true, endDate: true } });
  if (!exception?.startDate || !exception.endDate) return { linkDays: newDays, linkShift: 0 };
  const from = formatDay(exception.startDate);
  const to = formatDay(exception.endDate);
  // The links given are those of its days in the series, moved onto its own: longer than its series, the links of its
  // days past those are not given, and stay.
  const given = addDays(from, daysBetween(newDays.from, newDays.to));
  return { linkDays: { from, to: given < to ? given : to }, linkShift: daysBetween(newDays.from, from) };
}

/** Fields of an occurrence edited alone that a change of its series gives it too, when the series' value changes. */
const EXCEPTION_FIELDS = ['label', 'description', 'location', 'locationLat', 'locationLon', 'links', 'allDay', 'startTime', 'endTime', 'travelBefore', 'travelAfter'] as const;

/**
 * The occurrences of a series edited alone (its exceptions) follow a change of the series: moved to the new series of
 * a cut and / or shifted by as many days as the series, each into the series that has it once moved, a deleted one
 * staying deleted, a called off one called off, its postponements still pointing at it; the fields the change gives the
 * series another value take that value, the others stay theirs. One that no series has once moved goes (its comments
 * and times went with it).
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {CalendarEvent} event Series before the change.
 * @param {Awaited<ReturnType<typeof parseEvent>>} fields Its fields once changed.
 * @param {{ from: string, shift: number, targets: SeriesTarget[] }} change From which occurrence, days moved, series
 * they go to (the first: that of the occurrence edited).
 * @returns {Promise<void>}
 */
async function carryExceptions(
  tx: Prisma.TransactionClient,
  event: CalendarEvent,
  fields: Awaited<ReturnType<typeof parseEvent>>,
  change: { from: string; shift: number; targets: SeriesTarget[] },
): Promise<void> {
  const since = { gte: parseDay(change.from) };
  const exceptions = await tx.calendarEventException.findMany({ where: { eventId: event.id, date: since }, orderBy: { date: change.shift > 0 ? 'desc' : 'asc' } });
  const comparable = (field: (typeof EXCEPTION_FIELDS)[number], value: unknown) => JSON.stringify(field === 'links' ? readLinks(value as Prisma.JsonValue) : (value ?? null));
  const changed = Object.fromEntries(EXCEPTION_FIELDS.filter((field) => comparable(field, event[field]) !== comparable(field, fields[field])).map((field) => [field, field === 'links' ? toJson(fields.links) : fields[field]]));
  // Its length changed: theirs too.
  const span = daysBetween(fields.startDate, fields.endDate);
  const spanChanged = span !== daysBetween(formatDay(event.startDate), formatDay(event.endDate));
  for (const exception of exceptions) {
    const date = addDays(formatDay(exception.date), change.shift);
    const target = change.targets.find((item) => occursOn(item.rule, item.start, date));
    if (!target) {
      await tx.calendarEventException.delete({ where: { id: exception.id } });
      continue;
    }
    const startDate = exception.startDate ? addDays(formatDay(exception.startDate), change.shift) : null;
    const endDate = spanChanged && startDate ? addDays(startDate, span) : exception.endDate ? addDays(formatDay(exception.endDate), change.shift) : null;
    await tx.calendarEventException.update({
      where: { id: exception.id },
      data: { eventId: target.to, date: parseDay(date), startDate: startDate && parseDay(startDate), endDate: endDate && parseDay(endDate), ...changed },
    });
  }
  // Its postponements still come from it.
  const postponed = await tx.calendarEvent.findMany({ where: { postponedFromId: event.id, postponedFromDate: since }, select: { id: true, postponedFromDate: true } });
  for (const item of postponed) {
    const from = formatOptionalDay(item.postponedFromDate);
    const date = from && addDays(from, change.shift);
    await tx.calendarEvent.update({ where: { id: item.id }, data: { postponedFromId: date ? targetOn(change.targets, date).to : change.targets[0].to, postponedFromDate: parseOptionalDay(date) } });
  }
}

/**
 * Whether a day is an occurrence of a rule (its excluded dates left out).
 * @param {Recurrence} rule Rule.
 * @param {string} start First day of the series.
 * @param {string} day Day.
 * @returns {boolean} An occurrence.
 */
function occursOn(rule: Recurrence, start: string, day: string): boolean {
  return occurrenceDates(rule, start, day, day).includes(day);
}

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
  // From its first occurrence shown (an earlier one deleted alone does not count): the whole event.
  const first = scope === 'FOLLOWING' && occurrence ? ((await firstShownOccurrence(event)) ?? formatDay(event.startDate)) : null;
  if (!occurrence || scope === 'ALL' || (first !== null && occurrence.date <= first)) return { eventId: id };
  return scope === 'THIS' ? { eventId: id, on: occurrence.date } : { eventId: id, from: occurrence.date };
}

/**
 * Deletes an event, or for a recurring one: one occurrence, it and the following ones, or the whole series. The times
 * left with nothing attached are deleted first (billed ones kept), the times on the
 * occurrences deleted leave them, and their comments, checklists and the routine links of their days are deleted.
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
  // The routine links of the occurrences deleted, by their identity (a whole event: in cascade).
  const goneLinks = gone.on || gone.from ? await goneRoutineLinks(await findEventWithRelations(id), gone.on ? { on: gone.on } : { from: gone.from! }) : null;
  // Together: their times, comments and routine links go only with the occurrences.
  await prisma.$transaction(async (tx) => {
    await releaseSubjectTime({ events: [gone] }, tx);
    // The comments and checklists of the occurrences deleted go with them (a whole event: in cascade).
    if (gone.on || gone.from) await deleteGoneOccurrenceRows({ events: [{ id, on: gone.on, from: gone.from }] }, tx);
    if (goneLinks) await tx.calendarEventRoutine.deleteMany({ where: goneLinks });
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
    lastShownDate: date ? shownBoundsOf(event).last : null,
    firstShownDate: date ? shownBoundsOf(event).first : null,
  };
}

/** First and last days shown of the series of an event once computed (every occurrence of it read gives them). */
const shownBoundsOfEvent = new WeakMap<object, ShownBounds>();

/** First and last occurrences of a series still shown, the days of its rule (null: a one-off event; last null: no end). */
interface ShownBounds {
  first: string | null;
  last: string | null;
}

/**
 * First and last occurrences of a series still shown, the days of its rule (`firstShownOccurrence`,
 * `lastShownOccurrence`: those deleted alone left out); the last one null without an end. « Celle-ci et les
 * suivantes » is not offered from either.
 * @param {EventWithRelations} event Event.
 * @returns {ShownBounds} Days.
 */
function shownBoundsOf(event: EventWithRelations): ShownBounds {
  const known = shownBoundsOfEvent.get(event);
  if (known) return known;
  const rule = storedRecurrence(event.recurrence);
  const start = formatDay(event.startDate);
  const deleted = new Set(event.exceptions.filter((change) => change.cancelled).map((change) => formatDay(change.date)));
  const bounds = rule ? { first: firstShownDay(rule, start, deleted) ?? start, last: lastShownOccurrence(rule, start, deleted) ?? start } : { first: null, last: null };
  shownBoundsOfEvent.set(event, bounds);
  return bounds;
}

/** Fields of an occurrence whose change makes it « modified » apart from its days and hours. */
const CHANGED_FIELDS = ['label', 'description', 'location', 'travelBefore', 'travelAfter'] as const;

/**
 * Occurrences of a recurring event deleted, cancelled or changed alone, sorted by day: those on a day of its rule
 * (one its rule no longer has is left, as in its exports).
 * @param {EventWithRelations} event Event.
 * @returns {EventException[]} Exceptions.
 */
function eventExceptions(event: EventWithRelations): EventException[] {
  const rule = storedRecurrence(event.recurrence);
  const start = formatDay(event.startDate);
  return rule
    ? event.exceptions
        .map((change) => ({ change, date: formatDay(change.date) }))
        .filter(({ date }) => occursOn(rule, start, date))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ change, date }): EventException => {
          const own = toOccurrence(event, date, change);
          const series = toOccurrence(event, date, undefined);
          const postponement = own.postponedTo[0];
          return {
            date,
            cancelled: change.cancelled,
            calledOff: change.calledOff,
            postponedTo: postponement ? postponement.startDate : null,
            label: own.label,
            allDay: own.allDay,
            startDate: own.startDate,
            startTime: own.startTime,
            endDate: own.endDate,
            endTime: own.endTime,
            otherHours: own.allDay !== series.allDay || own.startTime !== series.startTime || own.endTime !== series.endTime || daysBetween(own.startDate, own.endDate) !== daysBetween(series.startDate, series.endDate),
            changed: CHANGED_FIELDS.some((field) => own[field] !== series[field]) || JSON.stringify(own.links) !== JSON.stringify(series.links),
          };
        })
    : [];
}

/**
 * Occurrences of an event deleted, cancelled or changed alone, sorted by day (`eventExceptions`); none for a one-off
 * event.
 * @param {string} id Event.
 * @returns {Promise<EventException[]>} Exceptions.
 */
export async function calendarEventExceptions(id: string): Promise<EventException[]> {
  return eventExceptions(await findEventWithRelations(id));
}

/**
 * Refuses to give back an occurrence that was postponed: its postponement stays an event of its own, both would take
 * place (`postponedRestoreRefusal`, BAD_USER_INPUT).
 * @param {EventWithRelations} event Event.
 * @param {string | null} date Day of the rule of the occurrence (null: a one-off event).
 * @returns {void}
 */
function assertNotPostponed(event: EventWithRelations, date: string | null): void {
  const postponement = event.postponements.find((item) => formatOptionalDay(item.postponedFromDate) === date);
  if (postponement) throw clientError('BAD_USER_INPUT', postponedRestoreRefusal(formatDay(postponement.startDate)));
}

/** An occurrence of a series changed alone from the list of its exceptions: its label, days and hours. */
export interface EventExceptionChange {
  /** Day of its rule. */
  date: string;
  label: string;
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
}

/** Exceptions of a series changed with a save of it: those restored (days of their rule) and those changed. */
export interface EventExceptionsChange {
  restored: readonly string[];
  changed: readonly EventExceptionChange[];
}

/**
 * Changes an occurrence of a series alone (« Cette occurrence », the `THIS` write) from the list of its exceptions:
 * its label, days and hours; its other fields as it has them; its routine links moved with it, as from its panel.
 * @param {string} id Event.
 * @param {EventExceptionChange} change Change.
 * @returns {Promise<void>}
 */
async function changeEventException(id: string, change: EventExceptionChange): Promise<void> {
  const loaded = await findEventWithRelations(id);
  if (!occurrenceOf(loaded, change.date)) throw notFound('Exception');
  // Deleted alone (nothing that day) or postponed: not changed from here.
  if (loaded.exceptions.some((item) => formatDay(item.date) === change.date && item.cancelled)) throw notFound('Exception');
  assertNotPostponed(loaded, change.date);
  const shown = shownOccurrence(loaded, change.date);
  const shift = daysBetween(shown.startDate, change.startDate);
  const { label, allDay, startDate, endDate } = change;
  await updateCalendarEvent(
    id,
    {
      ...seriesInput(loaded, change.date),
      ...seriesFieldsOf(shown),
      label,
      allDay,
      startDate,
      endDate,
      startTime: allDay ? null : change.startTime,
      endTime: allDay ? null : change.endTime,
      // Moved with it, those of its new days only (as from its panel).
      routineLinks: shown.routineLinks.map((link) => shiftedRoutineLink(link, link.shownDate, shift)).filter((link) => link.shownDate >= startDate && link.shownDate <= endDate),
    },
    'THIS',
    change.date,
  );
}

/**
 * Removes an exception of a recurring event (an occurrence deleted, cancelled or changed alone): the occurrence goes
 * back to its series, on its day and hours there, with the fields of its series. Its comments, times and checklist
 * stay (they are on the day that identifies it); its routine links follow it back (each moved by as many days as it
 * is, to the occurrence of its routine shown on the new day, `shiftedRoutineLink`, `resolveRoutineLinks`); those that
 * then fall on no day of it, or find no occurrence of their routine, go: their number is given back, confirmed with
 * the other losses of the save (`updateCalendarEvent`).
 * @param {string} id Event.
 * @param {string} occurrenceDate Day of the rule of the occurrence.
 * @returns {Promise<number>} Routine links lost.
 */
async function restoreEventException(id: string, occurrenceDate: string): Promise<number> {
  const loaded = await findEventWithRelations(id);
  await assertEventWritable(loaded);
  const occurrence = occurrenceOf(loaded, occurrenceDate);
  const change = occurrence && loaded.exceptions.find((item) => formatDay(item.date) === occurrence.date);
  if (!occurrence || !change) throw notFound('Exception');
  assertNotPostponed(loaded, occurrence.date);
  // Its days as shown now and once back in its series: its routine links move by as many days.
  const back = toOccurrence(loaded, occurrence.date, undefined);
  const { held, occurrences } = await shownRoutineLinks(loaded);
  const own = change.cancelled ? [] : held.filter((link) => linkedEventOccurrence(occurrences, link.day) === occurrence.date);
  const shift = change.cancelled ? 0 : daysBetween(shownOccurrence(loaded, occurrence.date).startDate, back.startDate);
  const moved = own.map((link) => shiftedRoutineLink({ routineId: link.routineId, date: formatDay(link.date) }, link.day, shift));
  const within = moved.filter((link) => link.shownDate >= back.startDate && link.shownDate <= back.endDate);
  const resolved = shift === 0 ? within.map(({ routineId, date }) => ({ routineId, date })) : await resolveRoutineLinks(within);
  // Each once by `routineId|date`: two going to the same occurrence of a routine make one, the other is lost.
  const links = [...new Map(resolved.map((link) => [occurrenceKey(link.routineId, link.date), link])).values()];
  await prisma.$transaction(async (tx) => {
    await tx.calendarEventException.delete({ where: { id: change.id } });
    if (!own.length) return;
    await tx.calendarEventRoutine.deleteMany({ where: { id: { in: own.map((link) => link.id) } } });
    await tx.calendarEventRoutine.createMany({ data: links.map((link) => ({ eventId: id, routineId: link.routineId, date: parseDay(link.date) })), skipDuplicates: true });
  });
  return own.length - links.length;
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
 * Occurrences of an event overlapping a period (dates included), as shown: with their own changes, those deleted alone
 * left out; archived, those started before the day it was archived only.
 * @param {EventWithRelations} event Event.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {EventOccurrence[]} Occurrences.
 */
function seriesOccurrences(event: EventWithRelations, from: string, to: string): EventOccurrence[] {
  const result: EventOccurrence[] = [];
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
  return result;
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
    // Recurring events may occur in the period whatever their first date (a one-off one: no rule, or a JSON null left by
    // a former change).
    where: {
      OR: [
        { startDate: { lte: parseDay(addDays(to, 62)) }, OR: [{ AND: [{ recurrence: { not: Prisma.DbNull } }, { recurrence: { not: Prisma.JsonNull } }] }, { endDate: { gte: parseDay(addDays(from, -62)) } }] },
        // An occurrence moved alone into the period from further away.
        { exceptions: { some: { cancelled: false, startDate: { lte: parseDay(to) }, endDate: { gte: parseDay(from) } } } },
      ],
      ...(calendarIds ? { calendarId: { in: calendarIds } } : {}),
      ...(activeOnly ? { archivedAt: null, calendar: { archivedAt: null } } : {}),
    },
    include: occurrenceInclude,
  });
  await primeLinkDays(events);
  const result = events.flatMap((event) => seriesOccurrences(event, from, to));
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
async function findEventWithRelations(id: string): Promise<EventWithRelations> {
  const event = await orNotFound(prisma.calendarEvent.findUnique({ where: { id }, include: occurrenceInclude }), 'Évènement');
  await primeLinkDays([event]);
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
  // A one-off event postponed is not given back either.
  if (!occurrence && !calledOff) assertNotPostponed(event, null);
  if (!occurrence || scope === 'ALL') {
    // The series only: its occurrences called off one by one (or postponed) stay so when it is restored.
    await prisma.calendarEvent.update({ where: { id }, data: { calledOff } });
    return;
  }
  if (scope === 'THIS') {
    if (!calledOff) assertNotPostponed(event, occurrence.date);
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
  // FOLLOWING: the series is split at the occurrence, the new one carries the state. Nothing else changes: the routine
  // links follow their occurrences into it as they are (none given anew: an occurrence moved alone keeps its own).
  const { event: split } = await updateEventFields(id, seriesInput(event, occurrence.date), 'FOLLOWING', occurrence.date);
  await prisma.calendarEvent.update({ where: { id: split.id }, data: { calledOff } });
}

/**
 * Postpones an event (one occurrence of a recurring one): it is cancelled and kept struck through, and a new
 * one-off event, linked to it, takes the new date, with the comments, times and checklist of the occurrence, and the
 * saved timers and sheets of the event.
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
      // And its sheets, as a new series of a cut: the checklist of the occurrence follows it below.
      sheetLinks: await copiedEventSheetLinks(id),
    },
  });
  // Its routine links before it is postponed (by its identity: not those of another occurrence on its days) go with it.
  const goneLinks = occurrence ? await goneRoutineLinks(await findEventWithRelations(id), { on: occurrence.date }) : { eventId: id };
  await setEventCalledOff(id, 'THIS', occurrence?.date ?? null, true);
  // The comments and times of the occurrence follow it to its postponement (a one-off event: its single occurrence),
  // and its routine links (those given, on its new days).
  const from = occurrence?.date ?? null;
  await remapOccurrenceRows('eventId', id, (date) => (date === from ? null : undefined), { to: created.id });
  await prisma.calendarEventRoutine.deleteMany({ where: goneLinks });
  await saveRoutineLinks(created.id, fields.routineLinks, null);
  // Postponed into another project: its contributors follow.
  await followProject(event.projectId, created.projectId, fields.contributorIds);
  return created;
}
