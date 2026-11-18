import { openFormPanel } from '../../../components/panels/panels';
import type { RowMenuEntry } from '../../../components/data-table/cells/RowActions';
import type { AccountingDocumentType } from '@ordo/shared';
import { FileArrowUpIcon, FileTextIcon } from '@phosphor-icons/react';
import { DepositInvoiceForm } from '../components/DepositInvoiceForm';
import { DOCUMENT_TYPE_LABELS, NEW_DOCUMENT_TITLES } from './labels';
import { openImportForm } from './imported-form';
import { NewDocumentForm } from '../components/NewDocumentForm';

/**
 * Opens the deposit invoice form, from a quote (of Ordo or imported) or choosing one.
 * @param {{ quoteId?: string, importedQuoteId?: string, clientId?: string | null }} [preset] Quote or client. Optional.
 * @returns {void}
 */
export function openDepositForm(preset: { quoteId?: string; importedQuoteId?: string; clientId?: string | null } = {}): void {
  openFormPanel(NEW_DOCUMENT_TITLES.DEPOSIT_INVOICE, (close) => <DepositInvoiceForm {...preset} onDone={close} />);
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
  openFormPanel(NEW_DOCUMENT_TITLES[type], (close) => <NewDocumentForm type={type} {...preset} onDone={close} />);
}

/**
 * Menu of the « Nouveau document » button: a document of each type, or the import of an existing one.
 * @param {{ clientId?: string | null, projectId?: string | null }} [preset] Client and project of the new documents. Optional.
 * @returns {RowMenuEntry[]} Entries.
 */
export function newDocumentMenu(preset: { clientId?: string | null; projectId?: string | null } = {}): RowMenuEntry[] {
  return [
    ...(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] as const).map((type) => ({
      label: DOCUMENT_TYPE_LABELS[type],
      icon: <FileTextIcon aria-hidden />,
      onClick: () => openNewDocument(type, preset),
    })),
    'divider' as const,
    { label: 'Importer un document existant', icon: <FileArrowUpIcon aria-hidden />, onClick: () => openImportForm() },
  ];
}
