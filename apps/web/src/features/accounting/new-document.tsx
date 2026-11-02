import { modals } from '@mantine/modals';
import type { AccountingDocumentType } from '@ordo/shared';
import { NEW_DOCUMENT_TITLES } from './labels';
import { NewDocumentForm } from './NewDocumentForm';

let modalCount = 0;

/**
 * Opens the new document form.
 * @param {AccountingDocumentType} type Type.
 * @param {{ clientId?: string | null, projectId?: string | null }} [preset] Client and project. Optional.
 * @returns {void}
 */
export function openNewDocument(type: AccountingDocumentType, preset: { clientId?: string | null; projectId?: string | null } = {}): void {
  const modalId = `new-document-${++modalCount}`;
  modals.open({
    modalId,
    title: NEW_DOCUMENT_TITLES[type],
    children: <NewDocumentForm type={type} {...preset} onDone={() => modals.close(modalId)} />,
  });
}
