import { formatOptionalDay, parseOptionalDay, sumOf } from '@ordo/shared';
import { prisma } from '../../db';
import { clientError } from '../../graphql/errors';
import { releaseSubjectTime, timeLeftEmpty } from '../tasks/time-entries';
import { commentsLostOnDelete, deleteGoneComments, type GoneComments } from './comments';
import { modelDelegate } from './delegate';

/** Rows kept per occurrence of an item: its comments (decision D19) and, for an event, the links of its times (D18). */
const OCCURRENCE_ROWS = { eventId: ['comment', 'timeEntryEvent'], routineId: ['comment'] } as const;

/** Column naming the item of rows kept per occurrence. */
export type OccurrenceOwner = keyof typeof OCCURRENCE_ROWS;

/** Delegate of a model of rows kept per occurrence (`prisma.comment`, `prisma.timeEntryEvent`). */
interface OccurrenceRowDelegate {
  findMany(args: { where: Record<string, unknown>; select: { id: true; occurrenceDate: true } }): PromiseLike<{ id: string; occurrenceDate: Date | null }[]>;
  updateMany(args: { where: { id: { in: string[] } }; data: Record<string, unknown> }): PromiseLike<unknown>;
}

/**
 * Moves the rows of the occurrences of an item (its comments, the links of the times of an event) when its occurrences
 * change: to other days (a series moved), and / or to another item (a series split: the following occurrences go to the
 * new one). The same for every model of rows, so that comments and times follow their occurrence together.
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
  for (const model of OCCURRENCE_ROWS[owner]) {
    const delegate = modelDelegate<OccurrenceRowDelegate>(model, client);
    const rows = await delegate.findMany({ where: { [owner]: id }, select: { id: true, occurrenceDate: true } });
    const groups = new Map<string | null, string[]>();
    for (const row of rows) {
      const before = formatOptionalDay(row.occurrenceDate);
      const after = map(before);
      if (after === undefined || (after === before && to === id)) continue;
      groups.set(after, [...(groups.get(after) ?? []), row.id]);
    }
    for (const [date, ids] of groups) {
      await delegate.updateMany({ where: { id: { in: ids } }, data: { [owner]: to, occurrenceDate: parseOptionalDay(date) } });
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
  for (const model of OCCURRENCE_ROWS[owner]) {
    const rows = await modelDelegate<OccurrenceRowDelegate>(model).findMany({ where: { [owner]: id, occurrenceDate: { not: null } }, select: { id: true, occurrenceDate: true } });
    for (const row of rows) days.add(formatOptionalDay(row.occurrenceDate)!);
  }
  return [...days].sort();
}

/** What a change of rule takes from the occurrences it makes disappear, and how to delete it. */
export interface LostOccurrences {
  /** Times deleted with them (without project, not billed, left with nothing attached). */
  times: number;
  /** Comments deleted with them. */
  comments: number;
  /** Deletes those comments and times (the other times leave the occurrences). */
  settle: () => Promise<void>;
}

/**
 * What a change of the rule of an event series or of a routine takes (decision EW): the occurrences it makes disappear
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
    settle: async () => {
      if (events.length) await releaseSubjectTime({ events });
      await deleteGoneComments(comments);
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
 * disappear have (`lostOccurrences`, `assertLossConfirmed`: nothing changed while unconfirmed), then deletes it.
 * @param {OccurrenceOwner} owner Column of the item (`eventId`, `routineId`).
 * @param {string} id Item.
 * @param {(day: string) => boolean} gone Whether an occurrence (its day now) disappears with the change.
 * @param {boolean} [confirmLoss] Loss confirmed (true), to confirm (false). Optional. Default = deleted without question (internal change).
 * @returns {Promise<void>}
 */
export async function settleLostOccurrences(owner: OccurrenceOwner, id: string, gone: (day: string) => boolean, confirmLoss?: boolean): Promise<void> {
  const lost = await lostOccurrences(owner, id, gone);
  assertLossConfirmed([lost], confirmLoss);
  await lost.settle();
}
