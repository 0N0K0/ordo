import { openFormPanel } from '../../components/panels/panels';
import type { ImportedDocument } from './documents-api';
import { ImportedDocumentForm } from './ImportedDocumentForm';

/**
 * Opens the import form (new import, or edition).
 * @param {ImportedDocument} [document] Imported document edited. Optional.
 * @returns {void}
 */
export function openImportForm(document?: ImportedDocument): void {
  openFormPanel(document ? `Document importé ${document.number}` : 'Importer un devis ou une facture', (close) => <ImportedDocumentForm document={document} onDone={close} />);
}
