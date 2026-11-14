import { closePanel, openPanel } from '../../components/panels/panels';
import type { RecurringInvoice } from './documents-api';
import { RecurringForm } from './RecurringForm';

let modalCount = 0;

/**
 * Opens the schedule form of a recurring invoice (from an invoice, or to edit a schedule).
 * @param {{ documentId?: string, recurring?: RecurringInvoice }} options Invoice made recurring, or schedule edited.
 * @returns {void}
 */
export function openRecurringForm(options: { documentId?: string; recurring?: RecurringInvoice }): void {
  const modalId = `recurring-invoice-${++modalCount}`;
  openPanel({
    panelId: modalId,
    title: options.recurring ? 'Facture récurrente' : 'Rendre la facture récurrente',
    children: <RecurringForm {...options} onDone={() => closePanel(modalId)} />,
  });
}
