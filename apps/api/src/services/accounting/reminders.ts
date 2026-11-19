import { formatOptionalDay, isInvoice, mapById, reminderMail, sendRemindersSchema } from '@ordo/shared';
import { prisma } from '../../db';
import { parseInput, userErrorMessage } from '../../graphql/errors';
import { ARCHIVED_MESSAGE } from '../core/archive';
import { documentPdf } from './accounting-pdf';
import { getCompanyProfile } from './company';
import { documentBalances } from './document-tracking';
import { findAccount } from '../mail/accounts';
import { sendMail } from '../mail/sender';
import { decimalCents } from '../core/decimal';

/** What tells who a document is mailed to. */
export interface BilledDocument {
  contactId: string | null;
  serviceId: string | null;
  clientId: string;
}

/** Who a document is mailed to. */
export interface BillingRecipient {
  email: string | null;
  firstName: string | null;
}

/**
 * Who a document is mailed to: its contact, else its service, else its client.
 * @param {BilledDocument} document Document.
 * @returns {Promise<BillingRecipient>} Recipient.
 */
export async function billingRecipient(document: BilledDocument): Promise<BillingRecipient> {
  return (await billingRecipients([document]))[0];
}

/**
 * Who several documents are mailed to (see `billingRecipient`), in three queries whatever their number.
 * @param {BilledDocument[]} documents Documents.
 * @returns {Promise<BillingRecipient[]>} Recipients, in the order of the documents.
 */
export async function billingRecipients(documents: BilledDocument[]): Promise<BillingRecipient[]> {
  const idsOf = (pick: (document: BilledDocument) => string | null) => [...new Set(documents.map(pick).filter((id) => id !== null))];
  const [contacts, services, clients] = await Promise.all([
    prisma.clientContact.findMany({ where: { id: { in: idsOf((document) => document.contactId) } }, select: { id: true, email: true, firstName: true } }),
    prisma.clientService.findMany({ where: { id: { in: idsOf((document) => document.serviceId) } }, select: { id: true, email: true } }),
    prisma.client.findMany({ where: { id: { in: idsOf((document) => document.clientId) } }, select: { id: true, email: true } }),
  ]);
  const [contactOf, serviceOf, clientOf] = [mapById(contacts), mapById(services), mapById(clients)];
  return documents.map((document) => {
    const contact = document.contactId ? contactOf.get(document.contactId) : undefined;
    const service = document.serviceId ? serviceOf.get(document.serviceId) : undefined;
    return { email: contact?.email || service?.email || clientOf.get(document.clientId)?.email || null, firstName: contact?.firstName ?? null };
  });
}

export interface ReminderResult {
  documentId: string;
  number: string;
  /** Null when sent, else why it was not. */
  error: string | null;
}

/**
 * Sends the reminder of several unpaid invoices from a mail account, one mail per invoice with its PDF
 * (and the signature of the account), each noted as a reminder. An invoice that cannot be reminded (paid
 * meanwhile, no address, sending error) is skipped and reported.
 * @param {{ accountId: string, documentIds: string[] }} input Mail account and invoices.
 * @returns {Promise<ReminderResult[]>} Outcome per invoice.
 */
export async function sendReminders(input: { accountId: string; documentIds: string[] }): Promise<ReminderResult[]> {
  const { accountId, documentIds } = parseInput(sendRemindersSchema, input);
  const account = await findAccount(accountId);
  const company = await getCompanyProfile();
  const balances = await documentBalances();
  const documents = await prisma.accountingDocument.findMany({ where: { id: { in: [...new Set(documentIds)] } } });
  const results: ReminderResult[] = [];
  for (const document of documents) {
    const result: ReminderResult = { documentId: document.id, number: document.number ?? '', error: null };
    results.push(result);
    const balance = balances.get(document.id)?.balance ?? 0;
    if (document.status !== 'FINAL' || !isInvoice(document.type)) {
      result.error = 'Ce n’est pas une facture validée.';
      continue;
    }
    if (document.archivedAt) {
      result.error = ARCHIVED_MESSAGE;
      continue;
    }
    if (balance <= 0) {
      result.error = 'Déjà réglée.';
      continue;
    }
    const recipient = await billingRecipient(document);
    if (!recipient.email) {
      result.error = 'Aucune adresse mail pour ce client.';
      continue;
    }
    const mail = reminderMail({
      deposit: document.type === 'DEPOSIT_INVOICE',
      number: document.number ?? '',
      totalGross: decimalCents(document.totalGross),
      balance,
      currency: document.currency,
      dueDate: formatOptionalDay(document.dueDate),
      companyName: company.name,
      firstName: recipient.firstName,
    });
    try {
      const pdf = await documentPdf(document.id);
      await sendMail({
        accountId,
        to: [recipient.email],
        subject: mail.subject,
        html: account.signature ? `${mail.html}<div>${account.signature}</div>` : mail.html,
        attachments: [new File([new Uint8Array(pdf.content)], pdf.filename, { type: 'application/pdf' })],
        projectId: document.projectId,
      });
    } catch (error) {
      result.error = userErrorMessage(error, 'Envoi impossible.', 'Relance groupée');
      continue;
    }
    await prisma.documentReminder.create({ data: { documentId: document.id, note: 'Relance par mail (groupée)' } });
  }
  return results;
}
