import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';

/**
 * Asks to remove an attachment of a document (it is deleted for good), then removes it with a toast: the same in the
 * table of the documents and in the document editor.
 * @param {{ filename: string }} attachment Attachment.
 * @param {string} documentName Document, as told in the risks (« F-2026-001 », « ce brouillon »).
 * @param {() => Promise<unknown>} remove Runs the removal (`mutateAsync`).
 * @returns {void}
 */
export function confirmRemoveAttachment(attachment: { filename: string }, documentName: string, remove: () => Promise<unknown>): void {
  confirmDestructive({
    title: 'Retirer la pièce jointe',
    risks: `« ${attachment.filename} » sera supprimée définitivement de ${documentName}.`,
    run: remove,
    done: 'Pièce jointe retirée.',
  });
}
