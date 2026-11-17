import { openFormPanel } from '../../../components/panels/panels';
import type { RecurringInvoice } from '../api/documents';
import { RecurringForm } from '../components/RecurringForm';

/**
 * Opens the schedule form of a recurring invoice (from an invoice, or to edit a schedule).
 * @param {{ documentId?: string, recurring?: RecurringInvoice }} options Invoice made recurring, or schedule edited.
 * @returns {void}
 */
export function openRecurringForm(options: { documentId?: string; recurring?: RecurringInvoice }): void {
  openFormPanel(options.recurring ? 'Facture récurrente' : 'Rendre la facture récurrente', (close) => <RecurringForm {...options} onDone={close} />);
}
