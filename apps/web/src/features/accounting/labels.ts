import type { AccountingDocumentType } from '@ordo/shared';

export const DOCUMENT_TYPE_LABELS: Record<AccountingDocumentType, string> = {
  QUOTE: 'Devis',
  INVOICE: 'Facture',
  DEPOSIT_INVOICE: 'Facture d’acompte',
  CREDIT_NOTE: 'Avoir',
};

export const NEW_DOCUMENT_TITLES: Record<AccountingDocumentType, string> = {
  QUOTE: 'Nouveau devis',
  INVOICE: 'Nouvelle facture',
  DEPOSIT_INVOICE: 'Nouvelle facture d’acompte',
  CREDIT_NOTE: 'Nouvel avoir',
};

export const EMPTY_DOCUMENTS: Record<AccountingDocumentType, string> = {
  QUOTE: 'Aucun devis.',
  INVOICE: 'Aucune facture.',
  DEPOSIT_INVOICE: 'Aucune facture d’acompte.',
  CREDIT_NOTE: 'Aucun avoir.',
};
