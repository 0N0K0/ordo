import type { AccountingDocumentType } from '@ordo/shared';

export const DOCUMENT_TYPE_LABELS: Record<AccountingDocumentType, string> = {
  QUOTE: 'Devis',
  INVOICE: 'Facture',
  DEPOSIT_INVOICE: 'Facture d’acompte',
  CREDIT_NOTE: 'Avoir',
};
