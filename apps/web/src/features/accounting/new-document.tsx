import { modals } from '@mantine/modals';
import type { AccountingDocumentType } from '@ordo/shared';
import { DepositInvoiceForm } from './DepositInvoiceForm';
import { DocumentsZipForm } from './DocumentsZipForm';
import { NEW_DOCUMENT_TITLES } from './labels';
import { NewDocumentForm } from './NewDocumentForm';

let modalCount = 0;

/**
 * Opens the deposit invoice form, from a quote (of Ordo or imported) or choosing one.
 * @param {{ quoteId?: string, importedQuoteId?: string, clientId?: string | null }} [preset] Quote or client. Optional.
 * @returns {void}
 */
export function openDepositForm(preset: { quoteId?: string; importedQuoteId?: string; clientId?: string | null } = {}): void {
  const modalId = `new-deposit-${++modalCount}`;
  modals.open({ modalId, title: NEW_DOCUMENT_TITLES.DEPOSIT_INVOICE, children: <DepositInvoiceForm {...preset} onDone={() => modals.close(modalId)} /> });
}

/**
 * Opens the new document form (a deposit invoice is made from a quote).
 * @param {AccountingDocumentType} type Type.
 * @param {{ clientId?: string | null, projectId?: string | null }} [preset] Client and project. Optional.
 * @returns {void}
 */
export function openNewDocument(type: AccountingDocumentType, preset: { clientId?: string | null; projectId?: string | null } = {}): void {
  if (type === 'DEPOSIT_INVOICE') {
    openDepositForm({ clientId: preset.clientId });
    return;
  }
  const modalId = `new-document-${++modalCount}`;
  modals.open({
    modalId,
    title: NEW_DOCUMENT_TITLES[type],
    children: <NewDocumentForm type={type} {...preset} onDone={() => modals.close(modalId)} />,
  });
}

/**
 * Opens the download of the documents of a period as a ZIP.
 * @returns {void}
 */
export function openDocumentsZip(): void {
  const modalId = `documents-zip-${++modalCount}`;
  modals.open({ modalId, title: 'Télécharger les documents d’une période', children: <DocumentsZipForm onDone={() => modals.close(modalId)} /> });
}
