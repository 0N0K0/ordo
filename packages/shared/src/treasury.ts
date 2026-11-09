import { z } from 'zod';
import { recurrenceSchema } from './recurrence';
import { colorSchema } from './workspace';

export const DOCUMENT_STATUS_SCOPES = ['QUOTE', 'INVOICE'] as const;
export type DocumentStatusScope = (typeof DOCUMENT_STATUS_SCOPES)[number];
export const DOCUMENT_STATUS_CATEGORIES = ['TO_SEND', 'SENT', 'ACCEPTED', 'REFUSED', 'PAID', 'CREDIT_DUE'] as const;
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
    { value: 'CREDIT_DUE', label: 'Avoir à créer' },
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

export const TREASURY_LINE_MODES = ['AMOUNT', 'PERCENT'] as const;
export type TreasuryLineMode = (typeof TREASURY_LINE_MODES)[number];

/**
 * Part of an entry: a signed amount, or a signed percentage of the entry amount; for a member, in a category and a
 * context, for a project, with its supporting documents and its links (lines of other entries, or whole entries
 * without lines).
 */
export const treasuryEntryLineSchema = z
  .object({
    /** Line kept (its links from other entries stay); none for a new line. */
    id: z.string().nullish(),
    label: optionalText(200),
    mode: z.enum(TREASURY_LINE_MODES),
    value: z.number({ error: 'Valeur attendue.' }),
    memberId: z.string().nullable(),
    /** A relation (out of the team or household) instead of a member: loan, gift… */
    relationId: z.string().nullish(),
    /** Loan with the relation: money out lends (or repays), money in borrows (or is repaid). */
    loan: z.boolean().default(false),
    /** Own day of the line (a purchase paid by a deferred debit card); none: the day of the entry. */
    date: isoDate.nullish(),
    categoryId: z.string().nullable(),
    contextId: z.string().nullable(),
    projectId: z.string().nullish(),
    libraryDocumentIds: z.array(z.string()).max(50, '50 documents maximum.').default([]),
    projectResourceIds: z.array(z.string()).max(50, '50 documents maximum.').default([]),
    linkedLineIds: z.array(z.string()).max(50, '50 liens maximum.').default([]),
    linkedEntryIds: z.array(z.string()).max(50, '50 liens maximum.').default([]),
  })
  .superRefine((line, context) => {
    if (line.value === 0) context.addIssue({ code: 'custom', path: ['value'], message: 'La valeur ne peut pas être nulle.' });
    if (line.memberId && line.relationId) context.addIssue({ code: 'custom', path: ['memberId'], message: 'Un membre ou une relation, pas les deux.' });
    if (line.loan && !line.relationId) context.addIssue({ code: 'custom', path: ['loan'], message: 'Un prêt se fait avec une relation.' });
    const limit = line.mode === 'PERCENT' ? 1000 : 99_999_999;
    if (Math.abs(line.value) > limit) context.addIssue({ code: 'custom', path: ['value'], message: line.mode === 'PERCENT' ? '1 000 % au plus.' : 'Montant trop grand.' });
  });
export type TreasuryEntryLineInput = z.input<typeof treasuryEntryLineSchema>;

/**
 * Amounts of the lines of an entry, and what they leave ("not split"): a percentage is of the entry amount.
 * @param {number} entryAmount Signed amount of the entry.
 * @param {readonly { mode: TreasuryLineMode, value: number }[]} lines Lines.
 * @returns {{ amounts: number[], remainder: number }} Signed amounts of the lines and remainder, in cents.
 */
export function splitAmounts(entryAmount: number, lines: readonly { mode: TreasuryLineMode; value: number }[]): { amounts: number[]; remainder: number } {
  const total = Math.round(entryAmount * 100);
  const amounts = lines.map((line) => (line.mode === 'PERCENT' ? Math.round((total * line.value) / 100) : Math.round(line.value * 100)));
  return { amounts, remainder: total - amounts.reduce((sum, value) => sum + value, 0) };
}

/** Person out of the team or household (friend, family, partner…) a line or a budget can be for. */
export const treasuryRelationSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  note: optionalText(500),
  /** Contributor this person also is, if any (not a member). */
  contributorId: z.string().nullish(),
});
export type TreasuryRelationInput = z.input<typeof treasuryRelationSchema>;

/** Context of spending, not in a tree; a line without context is everyday spending. */
export const treasuryContextSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.'),
  color: colorSchema,
});

/** Name of the absence of context: everyday spending. */
export const EVERYDAY_CONTEXT = 'Quotidien';
export type TreasuryContextInput = z.input<typeof treasuryContextSchema>;

/** Period a context is planned for (days included). */
export const treasuryContextPeriodSchema = z
  .object({
    contextId: z.string().min(1, 'Le contexte est requis.'),
    startDate: isoDate,
    endDate: isoDate,
    note: optionalText(200),
  })
  .refine((period) => period.endDate >= period.startDate, { path: ['endDate'], message: 'La fin précède le début.' });
export type TreasuryContextPeriodInput = z.input<typeof treasuryContextPeriodSchema>;

/**
 * Context proposed on a day: the one planned then (the period started last wins when several overlap), or none
 * (everyday spending).
 * @param {readonly { contextId: string, startDate: string, endDate: string }[]} periods Planned periods.
 * @param {string} date Day.
 * @returns {string | null} Context id.
 */
export function plannedContext(periods: readonly { contextId: string; startDate: string; endDate: string }[], date: string): string | null {
  return periods.filter((period) => period.startDate <= date && date <= period.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.contextId ?? null;
}

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mois invalide.');

/** Budget of a month (possibly repeated) for a member, a context and a category. */
export const treasuryBudgetSchema = z
  .object({
    /** YYYY-MM. */
    month: monthSchema,
    /** None: the app user (unless for a relation). */
    memberId: z.string().nullable(),
    /** A relation (out of the team or household) instead of a member. */
    relationId: z.string().nullish(),
    /** None: everyday spending. */
    contextId: z.string().nullable(),
    categoryId: z.string({ error: 'La catégorie est requise.' }).min(1, 'La catégorie est requise.'),
    amount: z.number({ error: 'Montant attendu.' }).positive('Montant positif attendu.').max(99_999_999, 'Montant trop grand.'),
    /** Every n months; none: that month only. */
    repeatEvery: z.number().int().min(1).max(24).nullable(),
    /** Last month (YYYY-MM), included; none: no end. */
    repeatUntil: monthSchema.nullable(),
  })
  .refine((budget) => !budget.repeatUntil || !budget.repeatEvery || budget.repeatUntil >= budget.month, { path: ['repeatUntil'], message: 'La fin précède le début.' })
  .refine((budget) => !budget.memberId || !budget.relationId, { path: ['memberId'], message: 'Un membre ou une relation, pas les deux.' });
export type TreasuryBudgetInput = z.input<typeof treasuryBudgetSchema>;

/**
 * Months a budget applies to within a range.
 * @param {{ month: string, repeatEvery: number | null, repeatUntil: string | null }} budget First month (YYYY-MM), repetition.
 * @param {string} from First month of the range (YYYY-MM).
 * @param {string} to Last month of the range (YYYY-MM).
 * @returns {string[]} Months (YYYY-MM).
 */
export function budgetMonths(budget: { month: string; repeatEvery: number | null; repeatUntil: string | null }, from: string, to: string): string[] {
  const index = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  const label = (value: number) => `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, '0')}`;
  const start = index(budget.month);
  if (!budget.repeatEvery) return budget.month >= from && budget.month <= to ? [budget.month] : [];
  const last = Math.min(index(to), budget.repeatUntil ? index(budget.repeatUntil) : Infinity);
  const months: string[] = [];
  // First repetition in the range.
  let current = start + Math.max(0, Math.ceil((index(from) - start) / budget.repeatEvery)) * budget.repeatEvery;
  for (; current <= last; current += budget.repeatEvery) months.push(label(current));
  return months;
}

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
    /** Split of the amount; what the lines leave is "not split". */
    lines: z.array(treasuryEntryLineSchema).max(50, '50 lignes maximum.').default([]),
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
    // A split entry carries its category, project, links and documents on its lines.
    if (entry.lines.length) {
      const onLines = 'Décomposé : à préciser sur les lignes.';
      if (entry.categoryId) context.addIssue({ code: 'custom', path: ['categoryId'], message: onLines });
      if (entry.projectId) context.addIssue({ code: 'custom', path: ['projectId'], message: onLines });
      if (entry.linkedEntryIds.length) context.addIssue({ code: 'custom', path: ['linkedEntryIds'], message: onLines });
      if (entry.libraryDocumentIds.length || entry.projectResourceIds.length) context.addIssue({ code: 'custom', path: ['libraryDocumentIds'], message: onLines });
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

/** Columns of a bank statement in CSV (indexes from 0), as mapped at an import. */
export const statementMappingSchema = z.object({
  separator: z.enum([';', ',', '\t']),
  encoding: z.enum(['utf-8', 'windows-1252']),
  /** Lines before the operations (titles…). */
  skipRows: z.number().int().min(0).max(50),
  dateColumn: z.number().int().min(0),
  dateFormat: z.enum(['DD/MM/YYYY', 'DD/MM/YY', 'YYYY-MM-DD', 'DD-MM-YYYY']),
  /** Columns joined into the label. */
  labelColumns: z.array(z.number().int().min(0)).min(1, 'Choisissez la colonne du libellé.').max(4),
  /** One signed amount column, or a debit and a credit column. */
  amountColumn: z.number().int().min(0).nullable(),
  debitColumn: z.number().int().min(0).nullable(),
  creditColumn: z.number().int().min(0).nullable(),
});
export type StatementMapping = z.infer<typeof statementMappingSchema>;

/** Operation read from a statement. */
export interface StatementRow {
  date: string;
  label: string;
  /** Signed: positive for money in. */
  amount: number;
}

/**
 * Cells of a CSV text: quoted cells may hold separators, line breaks and doubled quotes.
 * @param {string} text CSV text.
 * @param {string} separator Cell separator.
 * @returns {string[][]} Rows of cells.
 */
export function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/**
 * Amount of a statement cell: "1 234,56", "-12.50", "12,50 €"… (empty: null).
 * @param {string | undefined} value Cell.
 * @returns {number | null} Amount.
 */
export function statementAmount(value: string | undefined): number | null {
  const cleaned = (value ?? '').replace(/[\s\u00a0\u202f€]/g, '').replace(/^\+/, '');
  if (!cleaned) return null;
  // The last "," or "." is the decimal mark; the others group thousands.
  const decimal = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const normalized = decimal >= 0 && cleaned.length - decimal - 1 <= 2 ? `${cleaned.slice(0, decimal).replace(/[.,]/g, '')}.${cleaned.slice(decimal + 1)}` : cleaned.replace(/[.,]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

/**
 * Date of a statement cell in its format (invalid: null).
 * @param {string | undefined} value Cell.
 * @param {StatementMapping['dateFormat']} format Format.
 * @returns {string | null} YYYY-MM-DD.
 */
export function statementDate(value: string | undefined, format: StatementMapping['dateFormat']): string | null {
  const parts = (value ?? '').trim().split(/[/.-]/);
  if (parts.length !== 3) return null;
  let [year, month, day] = format === 'YYYY-MM-DD' ? parts : [parts[2], parts[1], parts[0]];
  if (format === 'DD/MM/YY' || year.length === 2) year = `20${year.padStart(2, '0')}`;
  const date = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : null;
}

/**
 * Operations of a statement, read with its column mapping; lines without a valid date or amount are left out
 * (headers, totals…).
 * @param {string} text CSV text (decoded).
 * @param {StatementMapping} mapping Columns.
 * @returns {StatementRow[]} Operations.
 */
export function readStatement(text: string, mapping: StatementMapping): StatementRow[] {
  return parseCsv(text, mapping.separator)
    .slice(mapping.skipRows)
    .flatMap((cells) => {
      const date = statementDate(cells[mapping.dateColumn], mapping.dateFormat);
      const label = mapping.labelColumns
        .map((column) => (cells[column] ?? '').trim())
        .filter(Boolean)
        .join(' — ')
        .replace(/\s+/g, ' ')
        .slice(0, 300);
      let amount: number | null;
      if (mapping.amountColumn !== null) amount = statementAmount(cells[mapping.amountColumn]);
      else {
        const debit = mapping.debitColumn !== null ? statementAmount(cells[mapping.debitColumn]) : null;
        const credit = mapping.creditColumn !== null ? statementAmount(cells[mapping.creditColumn]) : null;
        amount = debit === null && credit === null ? null : (credit ?? 0) - Math.abs(debit ?? 0);
      }
      return date && label && amount ? [{ date, label, amount }] : [];
    });
}

/** Operations to create from a statement: each one new, or realizing a forecast. */
export const statementImportSchema = z.object({
  accountId: z.string().min(1),
  mapping: statementMappingSchema.nullable(),
  rows: z
    .array(
      z.object({
        date: isoDate,
        label: z.string().trim().min(1).max(300),
        amount: amount.refine((value) => value !== 0, 'Montant nul.'),
        /** Forecast it realizes (its occurrence of that date). */
        forecastId: z.string().nullish(),
        occurrence: isoDate.nullish(),
      }),
    )
    .min(1, 'Aucune opération à importer.')
    .max(2000, '2 000 opérations au plus.'),
});
export type StatementImportInput = z.input<typeof statementImportSchema>;
