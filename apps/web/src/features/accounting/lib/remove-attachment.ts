import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { notifySuccess, onMutationError } from '../../../lib/notify';

/** Callbacks of the removal of an attachment. */
interface RemoveCallbacks {
  onSuccess: () => void;
  onError: (error: Error) => void;
}

/**
 * Asks to remove an attachment of a document (it is deleted for good), then removes it with a toast: the same in the
 * table of the documents and in the document editor.
 * @param {{ name: string }} attachment Attachment.
 * @param {string} documentName Document, as told in the risks (« F-2026-001 », « ce brouillon »).
 * @param {(callbacks: RemoveCallbacks) => void} remove Runs the removal (the mutation, given its callbacks).
 * @returns {void}
 */
export function confirmRemoveAttachment(attachment: { name: string }, documentName: string, remove: (callbacks: RemoveCallbacks) => void): void {
  confirmDestructive({
    title: 'Retirer la pièce jointe',
    risks: `« ${attachment.name} » sera supprimée définitivement de ${documentName}.`,
    onConfirm: () => remove({ onSuccess: () => notifySuccess('Pièce jointe retirée.'), onError: onMutationError }),
  });
}
