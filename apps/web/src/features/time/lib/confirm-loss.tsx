import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { GraphQLRequestError } from '../../../lib/graphql-client';
import { ActionDeclined } from '../../../lib/notify';
import type { LostOnDelete } from '../api';
import { lostOnDeleteText } from './lost-on-delete';

/**
 * Runs a change that may make occurrences of an event series or of a routine disappear (decision EW): first
 * unconfirmed; when the API answers CONFIRMATION_REQUIRED, asks for the loss of their comments and times (the
 * destructive confirmation, its numbers as in a deletion), then runs it again confirmed. Declined: `ActionDeclined`
 * (silent in the error toasts; the caller puts back what it showed).
 * @param {(confirmLoss: boolean) => Promise<T>} run The change, with or without the confirmation.
 * @returns {Promise<T>} Its result.
 */
export async function withLossConfirmation<T>(run: (confirmLoss: boolean) => Promise<T>): Promise<T> {
  try {
    return await run(false);
  } catch (error) {
    if (!(error instanceof GraphQLRequestError) || error.code !== 'CONFIRMATION_REQUIRED') throw error;
    const lost = (error.extensions.lost ?? { times: 0, comments: 0 }) as LostOnDelete;
    const confirmed = await new Promise<boolean>((resolve) =>
      confirmDestructive({
        title: 'Occurrences supprimées',
        risks: `Ce changement fait disparaître des occurrences qui ne reviendront pas. ${lostOnDeleteText(lost)}`,
        confirmLabel: 'Supprimer et enregistrer',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      }),
    );
    if (!confirmed) throw new ActionDeclined();
    return run(true);
  }
}
