import { modals } from '@mantine/modals';
import type { ImportedDocument } from './documents-api';
import { ImportedDocumentForm } from './ImportedDocumentForm';

let modalCount = 0;

/**
 * Opens the import form (new import, or edition).
 * @param {ImportedDocument} [document] Imported document edited. Optional.
 * @returns {void}
 */
export function openImportForm(document?: ImportedDocument): void {
  const modalId = `imported-document-${++modalCount}`;
  modals.open({
    modalId,
    title: document ? `Document importé ${document.number}` : 'Importer un devis ou une facture',
    size: 'lg',
    children: <ImportedDocumentForm document={document} onDone={() => modals.close(modalId)} />,
  });
}
