import { formatDay, marksInherited, occurrenceDueDay, routineMoveSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';

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
