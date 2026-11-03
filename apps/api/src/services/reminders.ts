import { formatDay, reminderMail, sendRemindersSchema } from '@ordo/shared';
import { prisma } from '../db';
import { parseInput } from '../graphql/errors';
import { documentPdf } from './accounting-pdf';
import { getCompanyProfile } from './company';
import { documentBalances } from './document-tracking';
import { findAccount } from './mail/accounts';
import { sendMail } from './mail/sender';

/**
 * Who a document is mailed to: its contact, else its service, else its client.
 * @param {{ contactId: string | null, serviceId: string | null, clientId: string }} document Document.
 * @returns {Promise<{ email: string | null, firstName: string | null }>} Recipient.
 */
export async function billingRecipient(document: { contactId: string | null; serviceId: string | null; clientId: string }) {
  const contact = document.contactId ? await prisma.clientContact.findUnique({ where: { id: document.contactId } }) : null;
  const service = document.serviceId ? await prisma.clientService.findUnique({ where: { id: document.serviceId } }) : null;
  const client = await prisma.client.findUnique({ where: { id: document.clientId }, select: { email: true } });
  return { email: contact?.email || service?.email || client?.email || null, firstName: contact?.firstName ?? null };
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
    if (document.status !== 'FINAL' || (document.type !== 'INVOICE' && document.type !== 'DEPOSIT_INVOICE')) {
      result.error = 'Ce n’est pas une facture validée.';
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
      totalGross: Math.round(Number(document.totalGross) * 100),
      balance,
      currency: document.currency,
      dueDate: document.dueDate ? formatDay(document.dueDate) : null,
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
      result.error = error instanceof Error ? error.message : 'Envoi impossible.';
      continue;
    }
    await prisma.documentReminder.create({ data: { documentId: document.id, note: 'Relance par mail (groupée)' } });
  }
  return results;
}
