import { type AccountingDocumentType, isInvoice, VAT_RATES } from '@ordo/shared';
import * as fmt from '../../../lib/format';

export { DOCUMENT_TYPE_LABELS, documentName, documentTitle, DRAFT_NAME } from '@ordo/shared';

/**
 * Whether a document type is named in the feminine (« Facture « F-12 » archivée. »).
 * @param {AccountingDocumentType} type Type.
 * @returns {boolean} Feminine.
 */
export function isFeminineDocumentType(type: AccountingDocumentType): boolean {
  return isInvoice(type);
}

/** Badge of a document issued before Ordo and imported, the same in the documents and in the treasury forecast: cyan. */
export const IMPORTED_LOOK = { label: 'Importé', color: 'cyan' } as const;

/** Kind of a client: a company (« Professionnel ») or a person (« Particulier »). */
/* eslint-disable no-restricted-syntax -- the labels themselves. */
export const CLIENT_KIND_LABELS: Record<'COMPANY' | 'INDIVIDUAL', string> = {
  COMPANY: 'Professionnel',
  INDIVIDUAL: 'Particulier',
};
/* eslint-enable no-restricted-syntax */

export const NEW_DOCUMENT_TITLES: Record<AccountingDocumentType, string> = {
  QUOTE: 'Nouveau devis',
  INVOICE: 'Nouvelle facture',
  DEPOSIT_INVOICE: 'Nouvelle facture d’acompte',
  CREDIT_NOTE: 'Nouvel avoir',
};

/** A document type with its definite article (« La facture est créée… »). */
export const THE_DOCUMENT_TYPE: Record<AccountingDocumentType, string> = {
  QUOTE: 'Le devis',
  INVOICE: 'La facture',
  DEPOSIT_INVOICE: 'La facture d’acompte',
  CREDIT_NOTE: 'L’avoir',
};

export const EMPTY_DOCUMENTS: Record<AccountingDocumentType, string> = {
  QUOTE: 'Aucun devis.',
  INVOICE: 'Aucune facture.',
  DEPOSIT_INVOICE: 'Aucune facture d’acompte.',
  CREDIT_NOTE: 'Aucun avoir.',
};

/**
 * Options of a VAT rate select: the usual rates, plus the current one when it is not among them.
 * @param {number} current Rate chosen.
 * @returns {{ value: string, label: string }[]} Options (« 20 % »).
 */
export const vatRateOptions = (current: number): { value: string; label: string }[] =>
  // eslint-disable-next-line no-restricted-syntax -- vatRateOptions itself.
  [...new Set([...VAT_RATES, current])].map((rate) => ({ value: String(rate), label: fmt.percent(rate) }));

/** Tabs of the documents of the accounting page, by type. */
export const DOCUMENT_TABS = [
  { value: 'QUOTE', label: 'Devis' },
  { value: 'INVOICE', label: 'Factures' },
  { value: 'DEPOSIT_INVOICE', label: 'Acomptes' },
  { value: 'CREDIT_NOTE', label: 'Avoirs' },
] as const satisfies readonly { value: AccountingDocumentType; label: string }[];

/**
 * Table of the documents of a type on the accounting page (its views and default columns).
 * @param {AccountingDocumentType} type Type.
 * @returns {string} Table key (« documents-credit-note »).
 */
export const documentsTableKey = (type: AccountingDocumentType): string => `documents-${type.toLowerCase().replace(/_/g, '-')}`;
