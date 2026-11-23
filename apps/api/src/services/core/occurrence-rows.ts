import { formatOptionalDay, parseOptionalDay, sumOf } from '@ordo/shared';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { clientError } from '../../graphql/errors';
import { releaseSubjectTime, timeLeftEmpty } from '../tasks/time-entries';
import { commentsLostOnDelete, deleteGoneComments, type GoneComments } from './comments';
import { modelDelegate } from './delegate';

/**
 * A model of rows kept per occurrence: its column of the day, and, when one occurrence has one row at most, the
 * other columns of that uniqueness (besides the item and the day).
 */
interface OccurrenceRowModel {
  model: 'comment' | 'timeEntryEvent' | 'checklist' | 'calendarEventRoutine';
  /** Column of the day. Optional. Default = `occurrenceDate`. */
  day?: 'occurrenceDate' | 'date';
  /** One row per occurrence (and per value of these columns): a row whose new day is taken stays. Optional. Default = several rows per occurrence. */
  unique?: readonly ('eventId')[];
}

/**
 * Rows kept per occurrence of an item: its comments and checklist, for an event the links of its times, for a routine
 * its links with events.
 */
const OCCURRENCE_ROWS: Record<'eventId' | 'routineId', readonly OccurrenceRowModel[]> = {
  eventId: [{ model: 'comment' }, { model: 'timeEntryEvent' }, { model: 'checklist', unique: [] }],
  routineId: [{ model: 'comment' }, { model: 'checklist', unique: [] }, { model: 'calendarEventRoutine', day: 'date', unique: ['eventId'] }],
};

/** Column naming the item of rows kept per occurrence. */
export type OccurrenceOwner = keyof typeof OCCURRENCE_ROWS;

/** Delegate of a model of rows kept per occurrence (`prisma.comment`, `prisma.timeEntryEvent`…). */
interface OccurrenceRowDelegate {
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): PromiseLike<Record<string, unknown>[]>;
  updateMany(args: { where: { id: { in: string[] } }; data: Record<string, unknown> }): PromiseLike<unknown>;
}

/**
 * Moves the rows of the occurrences of an item (its comments and checklists, the links of the times of an event, the
 * links of a routine with events) when its occurrences change: to other days (a series moved), and / or to another
 * item (a series split: the following occurrences go to the new one). The same for every model of rows, so that they
 * follow their occurrence together. A row of which an occurrence has one only (a checklist, a link with an event)
 * stays where it is when its new day already has one that does not move.
 * @param {OccurrenceOwner} owner Column of the item (`eventId`, `routineId`).
 * @param {string} id Item.
 * @param {(date: string | null) => string | null | undefined} map New day of an occurrence (null: the single occurrence of
 * a one-off event; undefined: the row stays as it is).
 * @param {object} [options] Options. Optional.
 * @param {string} [options.to] Item the rows mapped go to. Optional. Default = the same item.
 * @param {object} [options.client] Client or transaction. Optional. Default = the client of the workspace.
 * @returns {Promise<void>}
 */
export async function remapOccurrenceRows(
  owner: OccurrenceOwner,
  id: string,
  map: (date: string | null) => string | null | undefined,
  { to = id, client = prisma }: { to?: string; client?: object } = {},
): Promise<void> {
  for (const { model, day = 'occurrenceDate', unique } of OCCURRENCE_ROWS[owner]) {
    const delegate = modelDelegate<OccurrenceRowDelegate>(model, client);
    const columns = unique ?? [];
    const rows = await delegate.findMany({ where: { [owner]: id }, select: { id: true, [day]: true, ...Object.fromEntries(columns.map((column) => [column, true])) } });
    const keyOf = (row: Record<string, unknown>, date: string | null) => [date, ...columns.map((column) => String(row[column]))].join('|');
    const moving = rows.flatMap((row) => {
      const before = formatOptionalDay(row[day] as Date | null);
      const after = map(before);
      return after === undefined || (after === before && to === id) ? [] : [{ row, before, after }];
    });
    // One row per occurrence: those of the target item that stay hold their day.
    const movingIds = new Set(moving.map((item) => item.row.id as string));
    const held = new Set(unique && to === id ? rows.filter((row) => !movingIds.has(row.id as string)).map((row) => keyOf(row, formatOptionalDay(row[day] as Date | null))) : []);
    if (unique && to !== id) {
      const targets = await delegate.findMany({ where: { [owner]: to }, select: { id: true, [day]: true, ...Object.fromEntries(columns.map((column) => [column, true])) } });
      for (const row of targets) held.add(keyOf(row, formatOptionalDay(row[day] as Date | null)));
    }
    // Moved later first when they go forward (earlier first otherwise): a row leaves a day before another takes it.
    const forward = moving.some((item) => item.before !== null && item.after !== null && item.after > item.before);
    const ordered = unique ? [...moving].sort((a, b) => ((a.after ?? '') < (b.after ?? '') ? 1 : -1) * (forward ? 1 : -1)) : moving;
    const groups = new Map<string | null, string[]>();
    for (const { row, before, after } of ordered) {
      if (unique) {
        if (held.has(keyOf(row, after))) continue;
        held.delete(keyOf(row, before));
        held.add(keyOf(row, after));
        await delegate.updateMany({ where: { id: { in: [row.id as string] } }, data: { [owner]: to, [day]: parseOptionalDay(after) } });
        continue;
      }
      groups.set(after, [...(groups.get(after) ?? []), row.id as string]);
    }
    for (const [date, ids] of groups) {
      await delegate.updateMany({ where: { id: { in: ids } }, data: { [owner]: to, [day]: parseOptionalDay(date) } });
    }
  }
}

/**
 * Days of the occurrences of an item that have rows (comments, links of times), one-off occurrence (no day) aside.
 * @param {OccurrenceOwner} owner Column of the item (`eventId`, `routineId`).
 * @param {string} id Item.
 * @returns {Promise<string[]>} Days, in order.
 */
async function occurrenceRowDays(owner: OccurrenceOwner, id: string): Promise<string[]> {
  const days = new Set<string>();
  // What a lost occurrence loses: its comments and the links of its times.
  for (const { model } of OCCURRENCE_ROWS[owner].filter((item) => item.model === 'comment' || item.model === 'timeEntryEvent')) {
    const rows = await modelDelegate<OccurrenceRowDelegate>(model).findMany({ where: { [owner]: id, occurrenceDate: { not: null } }, select: { id: true, occurrenceDate: true } });
    for (const row of rows) days.add(formatOptionalDay(row.occurrenceDate as Date | null)!);
  }
  return [...days].sort();
}

/** What a change does once it is saved (the comments of the occurrences it made disappear deleted). */
export type AfterSave = () => Promise<void>;

/** Nothing to do once saved. */
export const NOTHING_AFTER: AfterSave = async () => {};

/** What a change of rule takes from the occurrences it makes disappear, and how to delete it. */
export interface LostOccurrences {
  /** Times deleted with them (without project, not billed, left with nothing attached). */
  times: number;
  /** Comments deleted with them. */
  comments: number;
  /** Deletes those comments and times (the other times leave the occurrences), in the transaction given if any. */
  settle: (client?: Prisma.TransactionClient) => Promise<void>;
}

/**
 * What a change of the rule of an event series or of a routine takes: the occurrences it makes disappear
 * without taking their rows along (no shift) lose their comments and, for an event, their times (those left with
 * nothing attached are deleted, billed ones kept, the others leave the occurrence: the rules of a deleted occurrence).
 * @param {OccurrenceOwner} owner Column of the item (`eventId`, `routineId`).
 * @param {string} id Item.
 * @param {(day: string) => boolean} gone Whether an occurrence (its day now) disappears with the change.
 * @returns {Promise<LostOccurrences>} Numbers, and their deletion.
 */
export async function lostOccurrences(owner: OccurrenceOwner, id: string, gone: (day: string) => boolean): Promise<LostOccurrences> {
  const days = (await occurrenceRowDays(owner, id)).filter(gone);
  if (!days.length) return { times: 0, comments: 0, settle: async () => {} };
  const occurrences = days.map((on) => ({ id, on }));
  const comments: GoneComments = owner === 'eventId' ? { events: occurrences } : { routines: occurrences };
  const events = owner === 'eventId' ? days.map((on) => ({ eventId: id, on })) : [];
  return {
    times: events.length ? (await timeLeftEmpty({ events })).length : 0,
    comments: await commentsLostOnDelete(comments),
    settle: async (client = prisma) => {
      if (events.length) await releaseSubjectTime({ events }, client);
      await deleteGoneComments(comments, client);
    },
  };
}

/**
 * Refuses a change that loses comments or times without confirmation: CONFIRMATION_REQUIRED, extension `lost`
 * (`{ times, comments }`, summed); times only kept elsewhere just leave, unasked.
 * @param {readonly Pick<LostOccurrences, 'times' | 'comments'>[]} losses What the change takes, item by item.
 * @param {boolean} [confirmLoss] Loss confirmed (true), to confirm (false). Optional. Default = no question (internal change).
 * @returns {void}
 */
export function assertLossConfirmed(losses: readonly Pick<LostOccurrences, 'times' | 'comments'>[], confirmLoss?: boolean): void {
  const lost = { times: sumOf(losses, (item) => item.times), comments: sumOf(losses, (item) => item.comments) };
  if (confirmLoss === false && (lost.times || lost.comments)) {
    throw clientError('CONFIRMATION_REQUIRED', 'Ce changement fait disparaître des occurrences qui ont des commentaires ou des temps : confirmez pour continuer.', { lost });
  }
}

/**
 * Before a change of the rule of an event series or of a routine: asks for the loss of what the occurrences it makes
 * disappear have (`lostOccurrences`, `assertLossConfirmed`: nothing changed while unconfirmed), and gives its deletion,
 * to run with the save (in its transaction, before the rows of the other occurrences move).
 * @param {OccurrenceOwner} owner Column of the item (`eventId`, `routineId`).
 * @param {string} id Item.
 * @param {(day: string) => boolean} gone Whether an occurrence (its day now) disappears with the change.
 * @param {boolean} [confirmLoss] Loss confirmed (true), to confirm (false). Optional. Default = deleted without question (internal change).
 * @returns {Promise<LostOccurrences['settle']>} Deletion of what is lost.
 */
export async function confirmLostOccurrences(owner: OccurrenceOwner, id: string, gone: (day: string) => boolean, confirmLoss?: boolean): Promise<LostOccurrences['settle']> {
  const lost = await lostOccurrences(owner, id, gone);
  assertLossConfirmed([lost], confirmLoss);
  return lost.settle;
}
