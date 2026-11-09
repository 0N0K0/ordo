import { z } from 'zod';
import { addDays, formatDay, parseDay } from './recurrence';

export const ACCOUNTING_UNITS = ['UNIT', 'HOUR', 'DAY', 'MONTH', 'FLAT', 'DEPOSIT'] as const;
export type AccountingUnit = (typeof ACCOUNTING_UNITS)[number];
export const LINE_KINDS = ['ITEM', 'DISBURSEMENT', 'TEXT', 'DEDUCTION'] as const;
export type LineKind = (typeof LINE_KINDS)[number];
export const DISCOUNT_TYPES = ['PERCENT', 'AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Usual French VAT rates. */
export const VAT_RATES = [20, 10, 5.5, 2.1, 0];

const amount = z.number({ error: 'Montant attendu.' }).min(-99_999_999, 'Montant trop grand.').max(99_999_999, 'Montant trop grand.');

export const accountingLineSchema = z.object({
  kind: z.enum(LINE_KINDS),
  title: z.string().trim().max(300, '300 caractères maximum.'),
  description: z
    .string()
    .max(20_000, 'Texte trop long.')
    .transform((value) => (value.trim() ? value : null))
    .nullable(),
  quantity: z.number({ error: 'Quantité attendue.' }).min(-999_999).max(999_999),
  unit: z.enum(ACCOUNTING_UNITS),
  unitPrice: amount,
  vatRate: z.number().min(0, 'Taux invalide.').max(100, 'Taux invalide.'),
  discountType: z.enum(DISCOUNT_TYPES).nullable(),
  discountValue: z.number().min(0, 'La remise ne peut pas être négative.').max(99_999_999).nullable(),
});
export type AccountingLineInput = z.infer<typeof accountingLineSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .max(max, 'Texte trop long.')
    .transform((value) => (value.trim() ? value.trim() : null))
    .nullable();

/** Editable fields of a draft document. */
export const accountingDocumentInputSchema = z
  .object({
    clientId: z.string().min(1, 'Le client est requis.'),
    serviceId: z.string().nullable(),
    contactId: z.string().nullable(),
    projectId: z.string().nullable(),
    issueDate: z.iso.date({ error: 'La date est requise.' }),
    dueDate: z.iso.date().nullable(),
    serviceStart: z.iso.date().nullable(),
    serviceEnd: z.iso.date().nullable(),
    title: optionalText(300),
    introduction: optionalText(20_000),
    referenceLabel: optionalText(60),
    referenceValue: optionalText(200),
    conclusion: optionalText(20_000),
    paymentTerms: optionalText(1000),
    paymentMethods: optionalText(500),
    depositType: z.enum(DISCOUNT_TYPES).nullable(),
    depositValue: z.number().min(0, 'L’acompte ne peut pas être négatif.').max(99_999_999).nullable(),
    lateInterest: optionalText(1000),
    billingSchedule: optionalText(300),
    otherMentions: optionalText(2000),
    showBankDetails: z.boolean(),
    vatApplicable: z.boolean(),
    globalDiscountType: z.enum(DISCOUNT_TYPES).nullable(),
    globalDiscountValue: z.number().min(0).max(99_999_999).nullable(),
    lines: z.array(accountingLineSchema).max(500, '500 lignes maximum.'),
    /** Tracked time billed on the document (replaces the previous ones); left unchanged when omitted. */
    timeEntryIds: z.array(z.string()).max(5000).optional(),
  })
  .superRefine((document, context) => {
    if (document.dueDate && document.dueDate < document.issueDate) {
      context.addIssue({ code: 'custom', path: ['dueDate'], message: 'L’échéance doit suivre la date du document.' });
    }
    if (document.serviceStart && document.serviceEnd && document.serviceEnd < document.serviceStart) {
      context.addIssue({ code: 'custom', path: ['serviceEnd'], message: 'La fin de la prestation doit suivre son début.' });
    }
    if (document.depositType === 'PERCENT' && (document.depositValue ?? 0) > 100) {
      context.addIssue({ code: 'custom', path: ['depositValue'], message: '100 % maximum.' });
    }
    if (document.globalDiscountType === 'PERCENT' && (document.globalDiscountValue ?? 0) > 100) {
      context.addIssue({ code: 'custom', path: ['globalDiscountValue'], message: '100 % maximum.' });
    }
    document.lines.forEach((line, index) => {
      if (line.kind !== 'TEXT' && !line.title.trim()) {
        context.addIssue({ code: 'custom', path: ['lines', index, 'title'], message: 'Le libellé est requis.' });
      }
      if (line.discountType === 'PERCENT' && (line.discountValue ?? 0) > 100) {
        context.addIssue({ code: 'custom', path: ['lines', index, 'discountValue'], message: '100 % maximum.' });
      }
    });
  });
export type AccountingDocumentInput = z.input<typeof accountingDocumentInputSchema>;

/**
 * Cents of an amount in currency units.
 * @param {number} value Amount.
 * @returns {number} Cents (integer).
 */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Amount in currency units of cents.
 * @param {number} cents Cents.
 * @returns {number} Amount.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Discount in cents on a base.
 * @param {number} base Base, in cents.
 * @param {DiscountType | null} type Discount type.
 * @param {number | null} value Percent, or amount in currency units.
 * @returns {number} Discount, in cents (never more than the base).
 */
function discountOn(base: number, type: DiscountType | null, value: number | null): number {
  if (!type || !value || base <= 0) return 0;
  const discount = type === 'PERCENT' ? Math.round((base * value) / 100) : toCents(value);
  return Math.min(discount, base);
}

export interface LineTotal {
  /** Quantity × unit price, in cents. */
  gross: number;
  discount: number;
  /** After the line discount (deductions: negative). */
  net: number;
}

export interface VatBreakdown {
  rate: number;
  /** Taxable base after discounts and deductions, in cents. */
  base: number;
  vat: number;
}

export interface DocumentTotals {
  lines: LineTotal[];
  /** Items after their own discounts, before the overall discount. */
  itemsNet: number;
  globalDiscount: number;
  /** Already invoiced on the same quote (positive amount, deducted). */
  deductions: number;
  /** Total excluding VAT (items after discounts, minus deductions). */
  totalNet: number;
  vat: VatBreakdown[];
  totalVat: number;
  /** Disbursements, outside VAT. */
  disbursements: number;
  /** Total due: excluding VAT + VAT + disbursements. */
  totalGross: number;
}

/**
 * Totals of a document, in cents: line totals, overall discount spread over the VAT rates in proportion
 * of their bases, deductions per rate, VAT per rate (none when VAT does not apply), disbursements outside VAT.
 * @param {object} document Document fields.
 * @param {Pick<AccountingLineInput, 'kind' | 'quantity' | 'unitPrice' | 'vatRate' | 'discountType' | 'discountValue'>[]} document.lines Lines.
 * @param {DiscountType | null} document.globalDiscountType Overall discount type.
 * @param {number | null} document.globalDiscountValue Overall discount value.
 * @param {boolean} document.vatApplicable Whether VAT applies.
 * @returns {DocumentTotals} Totals.
 */
export function computeTotals(document: {
  lines: Pick<AccountingLineInput, 'kind' | 'quantity' | 'unitPrice' | 'vatRate' | 'discountType' | 'discountValue'>[];
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number | null;
  vatApplicable: boolean;
}): DocumentTotals {
  const items = new Map<number, number>();
  const deductionsByRate = new Map<number, number>();
  let disbursements = 0;
  const lines = document.lines.map((line) => {
    if (line.kind === 'TEXT') return { gross: 0, discount: 0, net: 0 };
    const gross = Math.round(line.quantity * toCents(line.unitPrice));
    const rate = document.vatApplicable ? line.vatRate : 0;
    if (line.kind === 'DEDUCTION') {
      deductionsByRate.set(rate, (deductionsByRate.get(rate) ?? 0) + gross);
      return { gross, discount: 0, net: -gross };
    }
    if (line.kind === 'DISBURSEMENT') {
      disbursements += gross;
      return { gross, discount: 0, net: gross };
    }
    const discount = discountOn(gross, line.discountType, line.discountValue);
    const net = gross - discount;
    items.set(rate, (items.get(rate) ?? 0) + net);
    return { gross, discount, net };
  });

  const itemsNet = [...items.values()].reduce((sum, value) => sum + value, 0);
  const globalDiscount = discountOn(itemsNet, document.globalDiscountType, document.globalDiscountValue);
  // The overall discount is spread over the rates in proportion of their bases; the last rate gets the rest.
  const rates = [...new Set([...items.keys(), ...deductionsByRate.keys()])].sort((a, b) => b - a);
  let spread = 0;
  const vat = rates.map((rate, index) => {
    const itemBase = items.get(rate) ?? 0;
    const share = index === rates.length - 1 ? globalDiscount - spread : itemsNet ? Math.round((globalDiscount * itemBase) / itemsNet) : 0;
    spread += share;
    const base = itemBase - share - (deductionsByRate.get(rate) ?? 0);
    return { rate, base, vat: Math.round((base * rate) / 100) };
  });
  const deductions = [...deductionsByRate.values()].reduce((sum, value) => sum + value, 0);
  const totalNet = itemsNet - globalDiscount - deductions;
  const totalVat = vat.reduce((sum, item) => sum + item.vat, 0);
  return {
    lines,
    itemsNet,
    globalDiscount,
    deductions,
    totalNet,
    vat: vat.filter((item) => item.base !== 0 || item.vat !== 0),
    totalVat,
    disbursements,
    totalGross: totalNet + totalVat + disbursements,
  };
}

/**
 * Formats cents as an amount: "1 234,50 €".
 * @param {number} cents Cents.
 * @param {string} [currency] ISO currency. Optional. Default = EUR.
 * @returns {string} Amount.
 */
export function formatMoney(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

export const UNIT_LABELS: Record<AccountingUnit, { label: string; short: string }> = {
  UNIT: { label: 'Unité', short: 'u.' },
  HOUR: { label: 'Heure', short: 'h' },
  DAY: { label: 'Jour', short: 'j' },
  MONTH: { label: 'Mois', short: 'mois' },
  FLAT: { label: 'Forfait', short: 'forfait' },
  DEPOSIT: { label: 'Acompte', short: 'acompte' },
};

/** Usual payment terms, offered in the forms (any other text can be typed). */
export const PAYMENT_TERMS_PRESETS = ['À réception', 'À 15 jours', 'À 30 jours', 'À 30 jours fin de mois', 'À 45 jours fin de mois', 'À 60 jours'];
/** Usual payment methods. */
export const PAYMENT_METHOD_PRESETS = ['Virement bancaire', 'Chèque', 'Carte bancaire', 'Prélèvement', 'Espèces', 'Virement bancaire ou chèque'];
/** Usual late payment interests. */
export const LATE_INTEREST_PRESETS = ['Taux d’intérêt légal en vigueur', 'Trois fois le taux d’intérêt légal', 'Taux de la BCE majoré de 10 points'];
/** Usual billing schedules of a quote. */
export const BILLING_SCHEDULE_PRESETS = [
  'En une fois, à la livraison',
  'À la commande',
  'Au mois, en fin de mois',
  'Tous les 1er du mois',
  'Tous les 15 du mois',
  'À l’avancement',
  'Par jalon',
];

/**
 * Whether payment terms ask to pay on receipt ("À réception", "Comptant"): the due date is then the issue date,
 * printed as "À réception".
 * @param {string | null} terms Payment terms.
 * @returns {boolean} Paid on receipt.
 */
export function paidOnReceipt(terms: string | null | undefined): boolean {
  const text = terms?.trim().toLowerCase() ?? '';
  return /^(à|a) réception$/.test(text) || text === 'comptant';
}

/**
 * Due date given by payment terms written like the presets ("À réception", "À 30 jours", "À 45 jours fin de mois").
 * @param {string | null} terms Payment terms.
 * @param {string} issueDate Date of the document (YYYY-MM-DD).
 * @returns {string | null} Due date, or null when the terms do not give one.
 */
export function dueDateForTerms(terms: string | null, issueDate: string): string | null {
  const text = terms?.trim().toLowerCase() ?? '';
  if (paidOnReceipt(terms)) return issueDate;
  const match = /^(?:à|a) (\d{1,3}) jours( fin de mois)?$/.exec(text);
  if (!match) return null;
  const due = addDays(issueDate, Number(match[1]));
  if (!match[2]) return due;
  const date = parseDay(due);
  return formatDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

/**
 * Deposit asked by a quote, in cents.
 * @param {DiscountType | null} type Percent of the total, or amount.
 * @param {number | null} value Percent, or amount in currency units.
 * @param {number} totalGross Total of the document, in cents.
 * @returns {number} Deposit, in cents (0 when none).
 */
export function depositAmount(type: DiscountType | null, value: number | null, totalGross: number): number {
  if (!type || !value) return 0;
  return type === 'PERCENT' ? Math.round((totalGross * value) / 100) : toCents(value);
}

/** Quote or invoice issued before Ordo: main information (its file is sent apart). */
export const importedDocumentSchema = z
  .object({
    type: z.enum(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE']),
    number: z.string().trim().min(1, 'Le numéro est requis.').max(60, '60 caractères maximum.'),
    issueDate: z.iso.date({ error: 'La date est requise.' }),
    dueDate: z.iso.date().nullable(),
    clientId: z.string().nullable(),
    clientName: z
      .string()
      .trim()
      .max(200)
      .transform((value) => value || null)
      .nullable(),
    projectId: z.string().nullable(),
    title: z
      .string()
      .trim()
      .max(300)
      .transform((value) => value || null)
      .nullable(),
    totalNet: z.number({ error: 'Montant attendu.' }).min(-99_999_999).max(99_999_999),
    totalVat: z.number({ error: 'Montant attendu.' }).min(-99_999_999).max(99_999_999),
    totalGross: z.number({ error: 'Montant attendu.' }).min(-99_999_999).max(99_999_999),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Devise invalide.'),
    note: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || null)
      .nullable(),
    /** Paid or refunded outside the treasury of Ordo: not expected any more. */
    settled: z.boolean(),
  })
  .superRefine((document, context) => {
    if (!document.clientId && !document.clientName) context.addIssue({ code: 'custom', path: ['clientId'], message: 'Choisissez un client ou saisissez son nom.' });
    if (document.dueDate && document.dueDate < document.issueDate) {
      context.addIssue({ code: 'custom', path: ['dueDate'], message: 'L’échéance doit suivre la date du document.' });
    }
  });
export type ImportedDocumentInput = z.input<typeof importedDocumentSchema>;

/** Product or service of the catalogue: default fields of a line. */
export const catalogItemSchema = z.object({
  kind: z.enum(['ITEM', 'DISBURSEMENT']),
  title: z.string().trim().min(1, 'Le libellé est requis.').max(300, '300 caractères maximum.'),
  description: z
    .string()
    .max(20_000, 'Texte trop long.')
    .transform((value) => (value.trim() ? value : null))
    .nullable(),
  unit: z.enum(ACCOUNTING_UNITS),
  unitPrice: amount,
  vatRate: z.number().min(0, 'Taux invalide.').max(100, 'Taux invalide.'),
  archived: z.boolean(),
});
export type CatalogItemInput = z.input<typeof catalogItemSchema>;
