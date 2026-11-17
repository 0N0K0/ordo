import { openFormPanel } from '../../components/panels/panels';
import type { AccountingDocumentType } from '@ordo/shared';
import { DepositInvoiceForm } from './DepositInvoiceForm';
import { NEW_DOCUMENT_TITLES } from './labels';
import { NewDocumentForm } from './NewDocumentForm';

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
