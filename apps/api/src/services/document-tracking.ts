import { documentPaymentSchema, parseDay, toCents, type DocumentPaymentInput } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type AccountingDocument } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { storeAttachment } from './attachments';
import { scopeOf, statusOf } from './document-statuses';

/** Settlement of a final invoice, deposit invoice or credit note, in cents. */
export interface DocumentBalance {
  /** Paid by the client (invoices) or refunded to them (credit notes). */
  paid: number;
  /** Invoices: deducted by final credit notes. */
  credited: number;
  /** Still due: by the client (invoices), or to the client (credit notes). Negative when overpaid. */
  balance: number;
}

/**
 * Settlement of every final invoice, deposit invoice and credit note. A credit note first lowers what is due
 * on its invoice; what it exceeds (an invoice already paid) is to be refunded.
 * @returns {Promise<Map<string, DocumentBalance>>} Balance per document.
 */
export async function documentBalances(): Promise<Map<string, DocumentBalance>> {
  const documents = await prisma.accountingDocument.findMany({
    where: { status: 'FINAL', type: { not: 'QUOTE' } },
    select: { id: true, type: true, sourceId: true, totalGross: true, allocations: { select: { amount: true } } },
  });
  const gross = (document: (typeof documents)[number]) => toCents(Number(document.totalGross));
  const paid = (document: (typeof documents)[number]) => document.allocations.reduce((sum, allocation) => sum + toCents(Number(allocation.amount)), 0);
  const creditNotes = new Map<string, typeof documents>();
  for (const document of documents) {
    if (document.type === 'CREDIT_NOTE' && document.sourceId) creditNotes.set(document.sourceId, [...(creditNotes.get(document.sourceId) ?? []), document]);
  }
  const ids = new Set(documents.map((document) => document.id));
  const result = new Map<string, DocumentBalance>();
  for (const document of documents) {
    if (document.type !== 'CREDIT_NOTE') {
      const credits = creditNotes.get(document.id) ?? [];
      const credited = credits.reduce((sum, credit) => sum + toCents(Number(credit.totalGross)), 0);
      const refunded = credits.reduce((sum, credit) => sum + paid(credit), 0);
      result.set(document.id, { paid: paid(document), credited, balance: gross(document) - credited - paid(document) + refunded });
    }
  }
  for (const document of documents) {
    if (document.type !== 'CREDIT_NOTE') continue;
    const refunded = paid(document);
    const source = document.sourceId && ids.has(document.sourceId) ? result.get(document.sourceId) : undefined;
    // On an invoice: only what makes it overpaid is owed to the client.
    const owed = source ? Math.min(gross(document) - refunded, Math.max(0, -source.balance)) : gross(document) - refunded;
    result.set(document.id, { paid: refunded, credited: 0, balance: owed });
  }
  return result;
}

/**
 * Settlement of imported invoices and credit notes (gross minus their allocations); settled ones are 0.
 * @returns {Promise<Map<string, DocumentBalance>>} Balance per imported document.
 */
export async function importedBalances(): Promise<Map<string, DocumentBalance>> {
  const documents = await prisma.importedDocument.findMany({
    where: { type: { not: 'QUOTE' } },
    select: { id: true, settled: true, totalGross: true, allocations: { select: { amount: true } } },
  });
  return new Map(
    documents.map((document) => {
      const paid = document.allocations.reduce((sum, allocation) => sum + toCents(Number(allocation.amount)), 0);
      return [document.id, { paid, credited: 0, balance: document.settled ? 0 : toCents(Number(document.totalGross)) - paid }];
    }),
  );
}

/**
 * Brings the status of final invoices and credit notes in line with their payments: "paid" once nothing is
 * due, back to "sent" (or "to send") when a payment is removed. Other statuses chosen by hand are kept.
 * @param {(string | null | undefined)[]} ids Documents whose payments or credit notes changed.
 * @returns {Promise<void>}
 */
export async function syncPaymentStatus(ids: (string | null | undefined)[]): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return;
  // A credit note changes what is due on its invoice, and the other way round.
  const related = await prisma.accountingDocument.findMany({
    where: { OR: [{ id: { in: wanted } }, { sourceId: { in: wanted } }] },
    select: { id: true, sourceId: true },
  });
  const all = new Set([...wanted, ...related.flatMap((item) => [item.id, item.sourceId ?? ''])].filter(Boolean));
  const documents = await prisma.accountingDocument.findMany({
    where: { id: { in: [...all] }, status: 'FINAL', type: { not: 'QUOTE' } },
    select: { id: true, sentAt: true, trackingStatus: { select: { category: true } } },
  });
  if (!documents.length) return;
  const balances = await documentBalances();
  const paidStatus = await statusOf('INVOICE', 'PAID');
  for (const document of documents) {
    const balance = balances.get(document.id)?.balance ?? 0;
    const category = document.trackingStatus?.category;
    if (balance <= 0 && category !== 'PAID') {
      await prisma.accountingDocument.update({ where: { id: document.id }, data: { trackingStatusId: paidStatus.id } });
    } else if (balance > 0 && (category === 'PAID' || !category)) {
      const status = await statusOf('INVOICE', document.sentAt ? 'SENT' : 'TO_SEND');
      await prisma.accountingDocument.update({ where: { id: document.id }, data: { trackingStatusId: status.id } });
    }
  }
}

/**
 * Loads a final document or throws.
 * @param {string} id Document id.
 * @returns {Promise<AccountingDocument>} Document.
 */
async function finalDocument(id: string): Promise<AccountingDocument> {
  const document = await prisma.accountingDocument.findUnique({ where: { id } });
  if (!document) throw notFound('Document');
  if (document.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Le suivi ne concerne que les documents validés.');
  return document;
}

/**
 * Sets the tracking status of a final document by hand.
 * @param {string} id Document id.
 * @param {string} statusId Status (of the scope of the document).
 * @returns {Promise<AccountingDocument>} Document.
 */
export async function setTrackingStatus(id: string, statusId: string): Promise<AccountingDocument> {
  const document = await finalDocument(id);
  const status = await prisma.documentStatus.findUnique({ where: { id: statusId } });
  if (!status || status.scope !== scopeOf(document.type)) throw notFound('Statut');
  return prisma.accountingDocument.update({
    where: { id },
    data: {
      trackingStatusId: status.id,
      // Leaving "accepted" forgets the acceptance date.
      acceptedAt: status.category === 'ACCEPTED' ? (document.acceptedAt ?? parseDay(new Date().toISOString().slice(0, 10))) : null,
    },
  });
}

/**
 * Notes that a document was sent: "to send" becomes "sent".
 * @param {string} id Document id.
 * @returns {Promise<AccountingDocument>} Document.
 */
export async function markSent(id: string): Promise<AccountingDocument> {
  const document = await prisma.accountingDocument.findUnique({ where: { id }, include: { trackingStatus: true } });
  if (!document) throw notFound('Document');
  if (document.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Seul un document validé peut être envoyé.');
  const sent = !document.trackingStatus || document.trackingStatus.category === 'TO_SEND' ? await statusOf(scopeOf(document.type), 'SENT') : null;
  return prisma.accountingDocument.update({ where: { id }, data: { sentAt: new Date(), ...(sent ? { trackingStatusId: sent.id } : {}) } });
}

/**
 * Marks a quote accepted on a date, with its signed copy if given (replacing the previous one).
 * @param {string} id Quote id.
 * @param {string} date Acceptance date.
 * @param {File | null} file Signed quote. Optional.
 * @returns {Promise<AccountingDocument>} Quote.
 */
export async function acceptQuote(id: string, date: string, file: File | null): Promise<AccountingDocument> {
  const document = await finalDocument(id);
  if (document.type !== 'QUOTE') throw clientError('BAD_USER_INPUT', 'Seul un devis peut être accepté.');
  const accepted = await statusOf('QUOTE', 'ACCEPTED');
  const signed = file ? await storeAttachment(file) : null;
  const updated = await prisma.accountingDocument.update({
    where: { id },
    data: { trackingStatusId: accepted.id, acceptedAt: parseDay(date), ...(signed ? { signedAttachmentId: signed.id } : {}) },
  });
  if (signed && document.signedAttachmentId) await prisma.attachment.delete({ where: { id: document.signedAttachmentId } }).catch(() => undefined);
  return updated;
}

/**
 * Removes the signed copy of a quote.
 * @param {string} id Quote id.
 * @returns {Promise<AccountingDocument>} Quote.
 */
export async function removeSignedQuote(id: string): Promise<AccountingDocument> {
  const document = await finalDocument(id);
  const updated = await prisma.accountingDocument.update({ where: { id }, data: { signedAttachmentId: null } });
  if (document.signedAttachmentId) await prisma.attachment.delete({ where: { id: document.signedAttachmentId } }).catch(() => undefined);
  return updated;
}

/**
 * Notes a reminder of an invoice (mail sent from Ordo, call…).
 * @param {string} id Document id.
 * @param {string | null} note Note.
 * @returns {Promise<void>}
 */
export async function addReminder(id: string, note: string | null): Promise<void> {
  const document = await finalDocument(id);
  if (document.type === 'QUOTE' || document.type === 'CREDIT_NOTE') throw clientError('BAD_USER_INPUT', 'Seule une facture peut être relancée.');
  await prisma.documentReminder.create({ data: { documentId: id, note: note?.trim().slice(0, 500) || null } });
}

/**
 * Deletes a reminder.
 * @param {string} id Reminder id.
 * @returns {Promise<void>}
 */
export async function deleteReminder(id: string): Promise<void> {
  const { count } = await prisma.documentReminder.deleteMany({ where: { id } });
  if (!count) throw notFound('Relance');
}

/**
 * Records the payment of an invoice (money in) or the refund of a credit note (money out): an actual
 * treasury entry settling the document.
 * @param {string} id Document id.
 * @param {DocumentPaymentInput} input Payment.
 * @returns {Promise<void>}
 */
export async function recordPayment(id: string, input: DocumentPaymentInput): Promise<void> {
  const payment = parseInput(documentPaymentSchema, input);
  const document = await prisma.accountingDocument.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
  if (!document || document.status !== 'FINAL' || document.type === 'QUOTE') throw clientError('BAD_USER_INPUT', 'Seul un document validé (facture ou avoir) peut être réglé.');
  if (!(await prisma.treasuryAccount.findUnique({ where: { id: payment.accountId }, select: { id: true } }))) throw notFound('Compte');
  const refund = document.type === 'CREDIT_NOTE';
  await prisma.treasuryEntry.create({
    data: {
      accountId: payment.accountId,
      status: 'ACTUAL',
      date: parseDay(payment.date),
      label: `${refund ? 'Remboursement' : 'Règlement'} ${document.number} — ${document.client.name}`,
      amount: new Prisma.Decimal(refund ? -payment.amount : payment.amount),
      category: refund ? 'Remboursements clients' : 'Ventes',
      method: payment.method,
      projectId: document.projectId,
      allocations: { create: { documentId: id, amount: new Prisma.Decimal(payment.amount) } },
    },
  });
  await syncPaymentStatus([id]);
}
