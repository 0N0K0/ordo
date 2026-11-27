import { effectiveRoutineTiming, formatDay, occurrenceDueDay, relinkedOccurrence, type InheritingRoutine } from '@ordo/shared';
import { prisma } from '../../db';
import type { Routine } from '../../generated/prisma/client';
import { liveMoves, loadScheduleContext, occurrenceSpansBetween, type RoutineTiming, type ScheduleContext } from '../routines/routine-occurrences';

/**
 * A routine with what tells the exceptions it goes by, up its parents: its « quand » (a sub-routine may go by its
 * parent's exceptions, which apply on the days of the rule it goes by).
 */
interface MovesChain extends RoutineTiming, Pick<Routine, 'scheduleId' | 'scheduleAnchor'> {
  id: string;
  parentId: string | null;
  inheritedFields: string[];
  parent?: MovesChain | null;
}

/** One level of `MOVES_CHAIN`: its « quand » (exceptions included), its parent and whether it inherits them. */
const LEVEL = {
  id: true,
  parentId: true,
  inheritedFields: true,
  startDate: true,
  recurrence: true,
  scheduleId: true,
  scheduleAnchor: true,
  cases: true,
  moves: true,
  moments: true,
  fromTime: true,
  dueTime: true,
  opensOn: true,
  slotCondition: true,
  scheduleIds: true,
  excludedScheduleIds: true,
} as const;

/** What tells the exceptions a routine goes by: its own, else those of its parents (four levels up). */
const MOVES_CHAIN = { ...LEVEL, parent: { select: { ...LEVEL, parent: { select: { ...LEVEL, parent: { select: { ...LEVEL, parent: { select: LEVEL } } } } } } } } as const;

/** Prisma `select` of a link of an event with a routine: the routine, its day, and what tells the day it shows on. */
export const ROUTINE_LINK_SELECT = { routineId: true, date: true, routine: { select: MOVES_CHAIN } } as const;

/** A link of an event with an occurrence of a routine, as `ROUTINE_LINK_SELECT` reads it. */
export interface RoutineLinkRow {
  routineId: string;
  date: Date;
  routine?: MovesChain;
}

/**
 * Day an occurrence of a routine linked to an event shows on: its real due day (the last day of its opening that its
 * condition allows a moment on, the occurrence shows on it in the agenda), else its due day (the day it was moved to
 * when moved onto a day that has its own and kept apart), from the day that identifies it (the day stored in the
 * link), by the exceptions that apply (`liveMoves`: one left by a change of its rule moves nothing), on the « quand »
 * it goes by (its parents' when it inherits it).
 * @param {string} date Day that identifies the occurrence.
 * @param {MovesChain | undefined} routine Routine with its « quand » (and that of its parents).
 * @param {ScheduleContext} schedules Schedules of the workspace (`loadScheduleContext`), its exceptions that apply remembered in it by routine.
 * @returns {string} Day it shows on.
 */
function shownDay(date: string, routine: MovesChain | undefined, schedules: ScheduleContext): string {
  if (!routine) return date;
  const byId = new Map<string, MovesChain>();
  for (let level: MovesChain | null | undefined = routine; level; level = level.parent) byId.set(level.id, level);
  // Only the columns of its « quand » are read up the chain.
  const timing = effectiveRoutineTiming(routine, byId as unknown as ReadonlyMap<string, InheritingRoutine>);
  const due = occurrenceDueDay(liveMoves(timing, schedules), date);
  // A cancelled one too: it shows struck through on its real due day.
  return occurrenceSpansBetween(timing, due, due, schedules, true).find((span) => span.date === date)?.due ?? due;
}

/**
 * Days links of events with routines show on (`shownDay`), for links read together (each routine computed once).
 * @param {ScheduleContext} schedules Schedules of the workspace (`loadScheduleContext`, loaded once for them).
 * @returns {(link: RoutineLinkRow) => string} Day of a link.
 */
export function linkShownDays(schedules: ScheduleContext): (link: RoutineLinkRow) => string {
  return (link) => shownDay(formatDay(link.date), link.routine, schedules);
}

/**
 * Days links given to an event show on, the routines and the schedules read once.
 * @param {readonly { routineId: string, date: string }[]} links Links (the day that identifies each occurrence).
 * @returns {Promise<(link: { routineId: string, date: string }) => string>} Day each one shows on.
 */
export async function loadLinkShownDays(links: readonly { routineId: string; date: string }[]): Promise<(link: { routineId: string; date: string }) => string> {
  const ids = [...new Set(links.map((link) => link.routineId))];
  const [routines, schedules] = ids.length ? await Promise.all([prisma.routine.findMany({ where: { id: { in: ids } }, select: MOVES_CHAIN }), loadScheduleContext()]) : [[], null];
  const byId = new Map<string, MovesChain>(routines.map((routine) => [routine.id, routine]));
  return (link) => (schedules ? shownDay(link.date, byId.get(link.routineId), schedules) : link.date);
}

/**
 * Links given to an event, each on the occurrence it goes to: as it is without `shownDate`; with it (the event moved
 * to other days), the occurrence of that routine shown on that day (`relinkedOccurrence`), by the day that identifies
 * it, dropped when it has none there.
 * @param {readonly { routineId: string, date: string, shownDate?: string | null }[]} links Links.
 * @returns {Promise<{ routineId: string, date: string }[]>} Links to store.
 */
export async function resolveRoutineLinks(links: readonly { routineId: string; date: string; shownDate?: string | null }[]): Promise<{ routineId: string; date: string }[]> {
  const moved = links.filter((link) => link.shownDate);
  if (!moved.length) return links.map(({ routineId, date }) => ({ routineId, date }));
  const schedules = await loadScheduleContext();
  const routines = new Map((await prisma.routine.findMany({ where: { id: { in: [...new Set(moved.map((link) => link.routineId))] } } })).map((routine) => [routine.id, routine]));
  const occurrences = moved.flatMap((link) => {
    const routine = routines.get(link.routineId);
    const day = link.shownDate!;
    if (!routine) return [];
    // The occurrences shown on that day: due there (their real due day; the occurrence covers it).
    return occurrenceSpansBetween(routine, day, day, schedules, true)
      .filter((span) => (span.due ?? span.end) === day)
      .map((span) => ({ routineId: routine.id, date: span.date, shownDate: span.due ?? span.end, cancelled: span.cancelled }));
  });
  return links.flatMap((link) => {
    if (!link.shownDate) return [{ routineId: link.routineId, date: link.date }];
    const date = relinkedOccurrence(link, occurrences);
    return date ? [{ routineId: link.routineId, date }] : [];
  });
}
