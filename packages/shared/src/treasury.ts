import { z } from 'zod';
import { recurrenceSchema } from './recurrence';

export const DOCUMENT_STATUS_SCOPES = ['QUOTE', 'INVOICE'] as const;
export type DocumentStatusScope = (typeof DOCUMENT_STATUS_SCOPES)[number];
export const DOCUMENT_STATUS_CATEGORIES = ['TO_SEND', 'SENT', 'ACCEPTED', 'REFUSED', 'PAID'] as const;
export type DocumentStatusCategory = (typeof DOCUMENT_STATUS_CATEGORIES)[number];

/** Categories a scope uses, with their meaning. */
export const STATUS_CATEGORIES_BY_SCOPE: Record<DocumentStatusScope, { value: DocumentStatusCategory; label: string }[]> = {
  QUOTE: [
    { value: 'TO_SEND', label: 'À envoyer' },
    { value: 'SENT', label: 'Envoyé' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'REFUSED', label: 'Refusé' },
  ],
  INVOICE: [
    { value: 'TO_SEND', label: 'À envoyer' },
    { value: 'SENT', label: 'Envoyée' },
    { value: 'PAID', label: 'Payée' },
  ],
};

const isoDate = z.iso.date({ error: 'Date invalide.' });
const amount = z.number({ error: 'Montant attendu.' }).min(-99_999_999, 'Montant trop grand.').max(99_999_999, 'Montant trop grand.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'Texte trop long.')
    .transform((value) => value || null)
    .nullable();

export const treasuryAccountSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  openingBalance: amount,
  openingDate: isoDate,
});
export type TreasuryAccountInput = z.input<typeof treasuryAccountSchema>;

export const treasuryAllocationSchema = z
  .object({
    documentId: z.string().nullable(),
    importedDocumentId: z.string().nullable(),
    amount: z.number({ error: 'Montant attendu.' }).positive('Montant positif attendu.').max(99_999_999, 'Montant trop grand.'),
  })
  .refine((allocation) => Boolean(allocation.documentId) !== Boolean(allocation.importedDocumentId), 'Choisissez un document.');
export type TreasuryAllocationInput = z.input<typeof treasuryAllocationSchema>;

export const treasuryEntrySchema = z
  .object({
    accountId: z.string().min(1, 'Le compte est requis.'),
    status: z.enum(['ACTUAL', 'FORECAST']),
    date: isoDate,
    label: z.string().trim().min(1, 'Le libellé est requis.').max(300, '300 caractères maximum.'),
    amount: amount.refine((value) => value !== 0, 'Le montant ne peut pas être nul.'),
    category: optionalText(100),
    method: optionalText(100),
    projectId: z.string().nullable(),
    note: optionalText(2000),
    /** Forecast only. */
    recurrence: recurrenceSchema.nullable(),
    /** Actual only: documents it settles. */
    allocations: z.array(treasuryAllocationSchema).max(50, '50 documents maximum.'),
  })
  .superRefine((entry, context) => {
    if (entry.status === 'ACTUAL' && entry.recurrence) {
      context.addIssue({ code: 'custom', path: ['recurrence'], message: 'Seul un mouvement prévu peut se répéter.' });
    }
    if (entry.status === 'FORECAST' && entry.allocations.length) {
      context.addIssue({ code: 'custom', path: ['allocations'], message: 'Seul un mouvement réel règle des documents.' });
    }
    const allocated = entry.allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount * 100), 0);
    if (allocated > Math.abs(Math.round(entry.amount * 100))) {
      context.addIssue({ code: 'custom', path: ['allocations'], message: 'Les documents réglés dépassent le montant du mouvement.' });
    }
  });
export type TreasuryEntryInput = z.input<typeof treasuryEntrySchema>;

/** Payment (or refund) of one document, recorded from the document. */
export const documentPaymentSchema = z.object({
  accountId: z.string().min(1, 'Le compte est requis.'),
  date: isoDate,
  amount: z.number({ error: 'Montant attendu.' }).positive('Montant positif attendu.').max(99_999_999, 'Montant trop grand.'),
  method: optionalText(100),
});
export type DocumentPaymentInput = z.input<typeof documentPaymentSchema>;

/**
 * Text escaped for HTML.
 * @param {string} text Text.
 * @returns {string} HTML.
 */
function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** What the reminder of an unpaid invoice says. */
export interface ReminderMailInput {
  /** Invoice or deposit invoice. */
  deposit: boolean;
  number: string;
  /** Total of the invoice and what is still due, in cents. */
  totalGross: number;
  balance: number;
  currency: string;
  /** YYYY-MM-DD. */
  dueDate: string | null;
  companyName: string;
  firstName: string | null;
}

/**
 * Reminder mail of an unpaid invoice: subject and HTML body (without signature), the invoice joined apart.
 * @param {ReminderMailInput} invoice Invoice.
 * @returns {{ subject: string, html: string }} Mail.
 */
export function reminderMail(invoice: ReminderMailInput): { subject: string; html: string } {
  const label = invoice.deposit ? 'Facture d’acompte' : 'Facture';
  const money = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(cents / 100);
  const date = invoice.dueDate ? new Date(`${invoice.dueDate}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : null;
  return {
    subject: `Relance — ${label} ${invoice.number}${invoice.companyName ? ` — ${invoice.companyName}` : ''}`,
    html: [
      `<p>Bonjour${invoice.firstName ? ` ${escapeText(invoice.firstName)}` : ''},</p>`,
      `<p>Sauf erreur de notre part, notre ${invoice.deposit ? 'facture d’acompte' : 'facture'} n° ${escapeText(invoice.number)} d’un montant de ${escapeText(money(invoice.totalGross))}${date ? `, échue le ${date},` : ''} n’a pas encore été réglée : il reste ${escapeText(money(invoice.balance))} à payer.</p>`,
      '<p>Merci de bien vouloir procéder à son règlement dans les meilleurs délais. Vous la trouverez de nouveau ci-jointe.</p>',
      '<p>Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.</p>',
      '<p>Cordialement,</p>',
    ].join(''),
  };
}

/** Reminders sent at once: the mail account they are sent from. */
export const sendRemindersSchema = z.object({
  accountId: z.string().min(1, 'Choisissez la boîte d’envoi.'),
  documentIds: z.array(z.string()).min(1, 'Aucune facture choisie.').max(100, '100 factures maximum à la fois.'),
});
