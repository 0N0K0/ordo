import { openFormPanel } from '../../components/panels/panels';
import { PaymentForm, type PayableDocument } from './PaymentForm';

/**
 * Records a payment of an invoice (or a refund of a credit note) in the side panel.
 * @param {PayableDocument & { number?: string | null }} document Document.
 * @returns {void}
 */
export function openPaymentDialog(document: PayableDocument & { number?: string | null }): void {
  const refund = document.type === 'CREDIT_NOTE';
  openFormPanel(`${refund ? 'Remboursement' : 'Paiement'} de ${document.number ?? 'ce document'}`, (close) => <PaymentForm document={document} onDone={close} />);
}
