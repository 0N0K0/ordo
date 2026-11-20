import { formatOptionalDay, parseOptionalDay } from '@ordo/shared';
import { prisma } from '../../db';
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
