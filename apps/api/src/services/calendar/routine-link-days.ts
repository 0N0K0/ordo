import { formatDay, marksInherited, occurrenceDueDay, relinkedOccurrence, routineMoveSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { loadScheduleContext, occurrenceSpansBetween } from '../routines/routine-occurrences';

/** Exceptions of a routine and whether it inherits them, up its parents (a sub-routine may go by its parent's). */
interface MovesChain {
  moves: unknown;
  parentId: string | null;
  inheritedFields: string[];
  parent?: MovesChain | null;
}

/** One level of `MOVES_CHAIN`: its exceptions and whether it inherits them. */
const LEVEL = { moves: true, parentId: true, inheritedFields: true } as const;

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

const movesSchema = z.array(routineMoveSchema);

/**
 * Day an occurrence of a routine linked to an event shows on: its due day (the day it was moved to when moved onto a
 * day that has its own and kept apart), from the day that identifies it (the day stored in the link).
 * @param {string} date Day that identifies the occurrence.
 * @param {MovesChain | undefined} routine Routine with its exceptions (and those of its parents).
 * @returns {string} Day it shows on.
 */
function shownDay(date: string, routine: MovesChain | undefined): string {
  let current = routine;
  // Its exceptions inherited: those of its parent.
  while (current && marksInherited(current, 'MOVES') && current.parent) current = current.parent;
  const parsed = movesSchema.safeParse(current?.moves);
  return parsed.success ? occurrenceDueDay(parsed.data, date) : date;
}

/**
 * Day a link of an event with a routine shows on (`shownDay`).
 * @param {RoutineLinkRow} link Link.
 * @returns {string} Day.
 */
export const linkShownDay = (link: RoutineLinkRow): string => shownDay(formatDay(link.date), link.routine);

/**
 * Days links given to an event show on, the routines read once.
 * @param {readonly { routineId: string, date: string }[]} links Links (the day that identifies each occurrence).
 * @returns {Promise<(link: { routineId: string, date: string }) => string>} Day each one shows on.
 */
export async function loadLinkShownDays(links: readonly { routineId: string; date: string }[]): Promise<(link: { routineId: string; date: string }) => string> {
  const ids = [...new Set(links.map((link) => link.routineId))];
  const routines = ids.length ? await prisma.routine.findMany({ where: { id: { in: ids } }, select: { id: true, ...MOVES_CHAIN } }) : [];
  const byId = new Map<string, MovesChain>(routines.map((routine) => [routine.id, routine]));
  return (link) => shownDay(link.date, byId.get(link.routineId));
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
    return occurrenceSpansBetween(routine, day, day, schedules, true)
      .filter((span) => span.end === day)
      .map((span) => ({ routineId: routine.id, date: span.date, shownDate: span.end, cancelled: span.cancelled }));
  });
  return links.flatMap((link) => {
    if (!link.shownDate) return [{ routineId: link.routineId, date: link.date }];
    const date = relinkedOccurrence(link, occurrences);
    return date ? [{ routineId: link.routineId, date }] : [];
  });
}
