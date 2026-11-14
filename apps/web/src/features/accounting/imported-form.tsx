import { closePanel, openPanel } from '../../components/panels/panels';
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
  openPanel({
    panelId: modalId,
    title: document ? `Document importé ${document.number}` : 'Importer un devis ou une facture',
    children: <ImportedDocumentForm document={document} onDone={() => closePanel(modalId)} />,
  });
}
