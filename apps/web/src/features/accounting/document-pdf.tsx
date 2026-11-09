import { Box } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney, paidOnReceipt, reminderMail, type AccountingDocumentType } from '@ordo/shared';
import type { ComposeOptions } from '../mail/compose-options';
import { escapeHtml } from '../mail/mail-format';

/**
 * URL of the PDF of a document.
 * @param {string} id Document id.
 * @param {boolean} [download] Downloaded rather than shown. Optional.
 * @param {boolean} [paid] Receipted invoice (fully paid invoices only). Optional.
 * @returns {string} URL.
 */
export function pdfUrl(id: string, download = false, paid = false): string {
  const params = new URLSearchParams();
  if (download) params.set('download', '1');
  if (paid) params.set('paid', '1');
  const query = params.toString();
  return `/api/accounting/documents/${id}/pdf${query ? `?${query}` : ''}`;
}

/**
 * Opens the PDF of a document in a modal (generated again on each opening).
 * @param {string} id Document id.
 * @param {string} title Modal title.
 * @returns {void}
 */
export function openPdfPreview(id: string, title: string): void {
  modals.open({
    title,
    size: '64rem',
    children: (
      <Box
        component="iframe"
        src={`${pdfUrl(id)}#view=FitH&t=${Date.now()}`}
        title={title}
        w="100%"
        h="80vh"
        style={{ border: 0, display: 'block' }}
      />
    ),
  });
}

/**
 * Downloads a file served by Ordo as a File.
 * @param {string} url URL.
 * @param {string} name File name.
 * @returns {Promise<File>} File.
 */
async function fetchFile(url: string, name: string): Promise<File> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Fichier « ${name} » indisponible.`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type });
}

/** What the mail of a document needs. */
export interface DocumentMail {
  id: string;
  type: AccountingDocumentType;
  number: string;
  /** Total due, in cents. */
  totalGross: number;
  currency: string;
  /** Due date or end of validity (YYYY-MM-DD). */
  dueDate: string | null;
  /** Payment terms ("À réception": no date to pay before). */
  paymentTerms: string | null;
  projectId: string | null;
  attachments: { name: string; url: string }[];
  companyName: string;
  recipient: { email: string | null; firstName: string | null };
  /** Reminder of an unpaid invoice: what is still due, in cents. */
  reminder?: { balance: number } | null;
  /** Called once the mail is sent. */
  onSent?: () => void;
}

const PHRASES: Record<AccountingDocumentType, { label: string; article: string }> = {
  QUOTE: { label: 'Devis', article: 'notre devis' },
  INVOICE: { label: 'Facture', article: 'notre facture' },
  DEPOSIT_INVOICE: { label: 'Facture d’acompte', article: 'notre facture d’acompte' },
  CREDIT_NOTE: { label: 'Avoir', article: 'notre avoir' },
};

/**
 * Mail sending a document: its PDF and attachments joined, a short message ready to be completed.
 * @param {DocumentMail} document Document.
 * @returns {Promise<ComposeOptions>} Compose options.
 */
export async function documentMailOptions(document: DocumentMail): Promise<ComposeOptions> {
  const phrase = PHRASES[document.type];
  const amount = formatMoney(document.totalGross, document.currency);
  const date = document.dueDate ? new Date(`${document.dueDate}T00:00:00`).toLocaleDateString('fr-FR') : null;
  const detail =
    document.type === 'QUOTE'
      ? `d’un montant de ${amount}${date ? `, valable jusqu’au ${date}` : ''}`
      : document.type === 'CREDIT_NOTE'
        ? `d’un montant de ${amount}`
        : `d’un montant de ${amount}${paidOnReceipt(document.paymentTerms) ? ', à régler à réception' : date ? `, à régler avant le ${date}` : ''}`;
  if (document.reminder) {
    const mail = reminderMail({
      deposit: document.type === 'DEPOSIT_INVOICE',
      number: document.number,
      totalGross: document.totalGross,
      balance: document.reminder.balance,
      currency: document.currency,
      dueDate: document.dueDate,
      companyName: document.companyName,
      firstName: document.recipient.firstName,
    });
    return {
      to: document.recipient.email ? [document.recipient.email] : [],
      subject: mail.subject,
      body: mail.html,
      files: [await fetchFile(pdfUrl(document.id, true), `${phrase.label} ${document.number}.pdf`)],
      projectId: document.projectId,
      onSent: document.onSent,
    };
  }
  const files = await Promise.all([
    fetchFile(pdfUrl(document.id, true), `${phrase.label} ${document.number}.pdf`),
    ...document.attachments.map((attachment) => fetchFile(attachment.url, attachment.name)),
  ]);
  return {
    to: document.recipient.email ? [document.recipient.email] : [],
    subject: `${phrase.label} ${document.number}${document.companyName ? ` — ${document.companyName}` : ''}`,
    body: [
      `<p>Bonjour${document.recipient.firstName ? ` ${escapeHtml(document.recipient.firstName)}` : ''},</p>`,
      `<p>Veuillez trouver ci-joint ${phrase.article} n° ${escapeHtml(document.number)} ${escapeHtml(detail)}.</p>`,
      document.type === 'QUOTE'
        ? '<p>Pour l’accepter, il vous suffit de nous le retourner signé avec la mention « Bon pour accord ».</p>'
        : '',
      '<p>Cordialement,</p>',
    ].join(''),
    files,
    projectId: document.projectId,
    onSent: document.onSent,
  };
}
