import { confirmedDestructive } from '../../../components/dialogs/confirm-destructive';
import { GraphQLRequestError } from '../../../lib/graphql-client';
import type { LostOnDelete } from '../api';
import { lostOnDeleteText } from './lost-on-delete';

/** Destructive confirmation of a change the API refused unconfirmed (`confirmedDestructive`'s dialog). */
export type LossDialog = Parameters<typeof confirmedDestructive>[0];

/**
 * Question of a change that makes occurrences disappear: the loss of their comments, times, checklists started and
 * links between routines and events, numbered as in a deletion.
 * @param {LostOnDelete} lost Numbers.
 * @returns {LossDialog} Dialog.
 */
const occurrencesLost = (lost: LostOnDelete): LossDialog => ({
  title: 'Occurrences supprimées',
  risks: `Ce changement fait disparaître des occurrences qui ne reviendront pas. ${lostOnDeleteText(lost)}`,
  confirmLabel: 'Supprimer et enregistrer',
});

/**
 * Runs a change that the API refuses with CONFIRMATION_REQUIRED while what it loses is not confirmed
 * (occurrences of an event series or of a routine made to disappear; a task turned into a routine and back):
 * first unconfirmed; when refused, asks with the destructive confirmation, made from the extension `lost` of the
 * answer, then runs it again confirmed. Declined: `ActionDeclined` (silent in the error toasts; the caller puts back
 * what it showed).
 * @param {(confirm: boolean) => Promise<T>} run The change, with or without the confirmation.
 * @param {(lost: L) => LossDialog} [dialog] Question, from what is lost. Optional. Default = occurrences lost (`{ times, comments, checklists, links }`).
 * @returns {Promise<T>} Its result.
 */
export async function withLossConfirmation<T, L = LostOnDelete>(run: (confirm: boolean) => Promise<T>, dialog?: (lost: L) => LossDialog): Promise<T> {
  try {
    return await run(false);
  } catch (error) {
    if (!(error instanceof GraphQLRequestError) || error.code !== 'CONFIRMATION_REQUIRED') throw error;
    const { lost } = error.extensions;
    // An occurrence moved onto a day that has its own: asked by `withSameDayChoice`.
    if ((lost as { merge?: string } | undefined)?.merge) throw error;
    await confirmedDestructive(dialog ? dialog((lost ?? {}) as L) : occurrencesLost((lost ?? { times: 0, comments: 0 }) as LostOnDelete));
    return run(true);
  }
}
