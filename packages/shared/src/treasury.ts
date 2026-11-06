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

export const TREASURY_DIRECTIONS = ['IN', 'OUT'] as const;
export type TreasuryDirection = (typeof TREASURY_DIRECTIONS)[number];

const name = z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.');

/** Category of entries, for money in or out, possibly under a parent of the same direction. */
export const treasuryCategorySchema = z.object({
  name,
  direction: z.enum(TREASURY_DIRECTIONS),
  parentId: z.string().nullable(),
});
export type TreasuryCategoryInput = z.input<typeof treasuryCategorySchema>;

/** Payment method, usable for money in, out or both. */
export const treasuryPaymentMethodSchema = z
  .object({ name, incoming: z.boolean(), outgoing: z.boolean() })
  .refine((method) => method.incoming || method.outgoing, { path: ['incoming'], message: 'Choisissez au moins un sens.' });
export type TreasuryPaymentMethodInput = z.input<typeof treasuryPaymentMethodSchema>;

/** Payer or payee that is not a client. */
export const treasuryCounterpartySchema = z.object({ name, note: optionalText(2000), archived: z.boolean() });
export type TreasuryCounterpartyInput = z.input<typeof treasuryCounterpartySchema>;

export const treasuryEntrySchema = z
  .object({
    accountId: z.string().min(1, 'Le compte est requis.'),
    status: z.enum(['ACTUAL', 'FORECAST']),
    /** Execution date. */
    date: isoDate,
    valueDate: isoDate.nullable(),
    label: z.string().trim().min(1, 'Le libellé est requis.').max(300, '300 caractères maximum.'),
    amount: amount.refine((value) => value !== 0, 'Le montant ne peut pas être nul.'),
    categoryId: z.string().nullable(),
    methodId: z.string().nullable(),
    /** Payer or payee: a client or another counterparty, not both. */
    clientId: z.string().nullable(),
    counterpartyId: z.string().nullable(),
    projectId: z.string().nullable(),
    note: optionalText(2000),
    /** Forecast only. */
    recurrence: recurrenceSchema.nullable(),
    /** Actual only: documents it settles. */
    allocations: z.array(treasuryAllocationSchema).max(50, '50 documents maximum.'),
    /** Linked entries (both ways). */
    linkedEntryIds: z.array(z.string()).max(50, '50 mouvements liés maximum.'),
    /** Supporting documents: of the library, or of a project. */
    libraryDocumentIds: z.array(z.string()).max(50, '50 documents maximum.'),
    projectResourceIds: z.array(z.string()).max(50, '50 documents maximum.'),
  })
  .superRefine((entry, context) => {
    if (entry.status === 'ACTUAL' && entry.recurrence) {
      context.addIssue({ code: 'custom', path: ['recurrence'], message: 'Seul un mouvement prévu peut se répéter.' });
    }
    if (entry.status === 'FORECAST' && entry.allocations.length) {
      context.addIssue({ code: 'custom', path: ['allocations'], message: 'Seul un mouvement réel règle des documents.' });
    }
    if (entry.clientId && entry.counterpartyId) {
      context.addIssue({ code: 'custom', path: ['counterpartyId'], message: 'Choisissez un client ou un tiers, pas les deux.' });
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
  methodId: z.string().nullable(),
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

/** Movement of a chart of money in and out, with the movements it is linked to. */
export interface LinkedMovement {
  id: string;
  /** Signed amount. */
  amount: number;
  linkedIds: readonly string[];
  /** Period of the chart it falls in (bucket); linked movements only offset each other within a period. */
  period: string;
}

/**
 * Amounts of movements once linked money in and out offset each other: in each group of linked movements
 * (directly or through others) of a same period, the smallest of the money in and the money out is removed from
 * both, in proportion to each movement. A money in linked to a money out of the same amount and period both
 * count as zero; unlinked movements keep their amount.
 * @param {LinkedMovement[]} movements Movements.
 * @returns {Map<string, number>} Remaining signed amount of each movement, by id.
 */
export function offsetLinkedMovements(movements: readonly LinkedMovement[]): Map<string, number> {
  const byId = new Map(movements.map((movement) => [movement.id, movement]));
  const parent = new Map(movements.map((movement) => [movement.id, movement.id]));
  /**
   * Representative of the group of a movement.
   * @param {string} id Movement id.
   * @returns {string} Root id.
   */
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    for (let current = id; current !== root;) {
      const next = parent.get(current) as string;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  for (const movement of movements) {
    for (const linkedId of movement.linkedIds) {
      const linked = byId.get(linkedId);
      if (!linked || linked.period !== movement.period) continue;
      const [a, b] = [find(movement.id), find(linkedId)];
      if (a !== b) parent.set(a, b);
    }
  }
  const groups = new Map<string, { incoming: number; outgoing: number }>();
  for (const movement of movements) {
    const group = groups.get(find(movement.id)) ?? { incoming: 0, outgoing: 0 };
    if (movement.amount > 0) group.incoming += movement.amount;
    else group.outgoing -= movement.amount;
    groups.set(find(movement.id), group);
  }
  const result = new Map<string, number>();
  for (const movement of movements) {
    const group = groups.get(find(movement.id)) as { incoming: number; outgoing: number };
    const offset = Math.min(group.incoming, group.outgoing);
    const side = movement.amount > 0 ? group.incoming : group.outgoing;
    result.set(movement.id, offset > 0 && side > 0 ? movement.amount * (1 - offset / side) : movement.amount);
  }
  return result;
}
