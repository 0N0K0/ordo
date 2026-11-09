import { modals } from '@mantine/modals';
import { PaymentForm, type PayableDocument } from './PaymentForm';

let modalCount = 0;

/**
 * Records a payment of an invoice (or a refund of a credit note) in a dialog.
 * @param {PayableDocument & { number?: string | null }} document Document.
 * @returns {void}
 */
export function openPaymentDialog(document: PayableDocument & { number?: string | null }): void {
  const modalId = `document-payment-${++modalCount}`;
  const refund = document.type === 'CREDIT_NOTE';
  modals.open({
    modalId,
    title: `${refund ? 'Remboursement' : 'Paiement'} de ${document.number ?? 'ce document'}`,
    children: <PaymentForm document={document} onDone={() => modals.close(modalId)} />,
  });
}
