import { escapeHtml, fullDate, prefixedSubject, type Address } from './mail-format';

/** A mail answered or forwarded: read on the server or linked to a project. */
export interface SourceMail {
  accountId: string | null;
  messageId: string | null;
  references: string[];
  subject: string;
  from: Address[];
  to: Address[];
  cc: Address[];
  replyTo?: Address[];
  date: string;
  html: string | null;
  text: string | null;
  /** Location on the server, to forward its files. */
  location?: { accountId: string; folder: string; uid: number } | null;
}

export interface MailLocation {
  accountId: string;
  folder: string;
  uid: number;
}

/** Files of a message on the server, attached again (forward, or files of a resumed draft). */
export interface SourceFiles {
  from: MailLocation;
  files: { index: number; filename: string; size: number }[];
}

export interface ComposeOptions {
  accountId?: string | null;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  /** Body (resumed draft). */
  body?: string;
  /** Whether the signature is added (default: yes). */
  withSignature?: boolean;
  /** Quoted or forwarded mail, added under the signature. */
  quote?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  /** Project the mail is written from: the sent mail is linked to it. */
  projectId?: string | null;
  /** Forward: its files are attached again. */
  forwarding?: boolean;
  sourceFiles?: SourceFiles | null;
  /** Resumed draft, replaced by the next save and deleted once sent. */
  draft?: MailLocation | null;
}

/** Parts of the HTML of a mail written in Ordo, marked so a draft can be resumed. */
export const PART = { body: 'body', signature: 'signature', quote: 'quote' } as const;

/**
 * HTML of a mail written in Ordo: body, signature and quote, each marked.
 * @param {string} body Body.
 * @param {string | null | undefined} signature Signature, if added.
 * @param {string | null | undefined} quote Quoted or forwarded mail.
 * @returns {string} HTML.
 */
export function mailHtml(body: string, signature: string | null | undefined, quote: string | null | undefined): string {
  return [
    `<div data-ordo-part="${PART.body}">${body}</div>`,
    signature ? `<div data-ordo-part="${PART.signature}"><br>${signature}</div>` : '',
    quote ? `<div data-ordo-part="${PART.quote}"><br>${quote}</div>` : '',
  ].join('');
}

/**
 * Splits the HTML of a draft into its parts; a draft written elsewhere is all body.
 * @param {string} html Draft HTML.
 * @returns {{ body: string, withSignature: boolean, quote: string | null }} Parts.
 */
export function splitDraftHtml(html: string): { body: string; withSignature: boolean; quote: string | null } {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const part = (name: string) => document.querySelector(`[data-ordo-part="${name}"]`);
  const body = part(PART.body);
  if (!body) return { body: document.body.innerHTML, withSignature: false, quote: null };
  const quote = part(PART.quote);
  return {
    body: body.innerHTML,
    withSignature: part(PART.signature) !== null,
    quote: quote ? quote.innerHTML.replace(/^<br>/, '') : null,
  };
}

/**
 * HTML of a mail to quote.
 * @param {SourceMail} mail Mail.
 * @returns {string} HTML.
 */
function bodyOf(mail: SourceMail): string {
  return mail.html ?? `<p>${escapeHtml(mail.text ?? '').replace(/\n/g, '<br>')}</p>`;
}

/**
 * Addresses as plain emails.
 * @param {Address[]} addresses Addresses.
 * @returns {string[]} Emails.
 */
const emails = (addresses: Address[]) => addresses.map((item) => item.address);

/**
 * Options of a reply (to the sender, or to everyone).
 * @param {SourceMail} mail Answered mail.
 * @param {boolean} all Reply to all recipients.
 * @param {string[]} ownAddresses Addresses of the user's accounts, left out of the recipients.
 * @param {string | null} [projectId] Project it is answered from. Optional.
 * @returns {ComposeOptions} Compose options.
 */
export function replyOptions(mail: SourceMail, all: boolean, ownAddresses: string[], projectId?: string | null): ComposeOptions {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()));
  const to = emails(mail.replyTo?.length ? mail.replyTo : mail.from);
  const cc = all ? emails([...mail.to, ...mail.cc]).filter((address) => !own.has(address.toLowerCase()) && !to.includes(address)) : [];
  return {
    accountId: mail.accountId,
    to,
    cc: [...new Set(cc)],
    subject: prefixedSubject(mail.subject, 'Re'),
    quote: `<p>Le ${escapeHtml(fullDate(mail.date))}, ${escapeHtml(mail.from[0]?.name || mail.from[0]?.address || '')} a écrit :</p><blockquote>${bodyOf(mail)}</blockquote>`,
    inReplyTo: mail.messageId,
    references: [...mail.references, ...(mail.messageId ? [mail.messageId] : [])],
    projectId,
  };
}

/**
 * Options of a forward (the files of a mail read on the server are attached again).
 * @param {SourceMail} mail Forwarded mail.
 * @param {SourceFiles['files']} files Its files (not inline images).
 * @param {string | null} [projectId] Project it is forwarded from. Optional.
 * @returns {ComposeOptions} Compose options.
 */
export function forwardOptions(mail: SourceMail, files: SourceFiles['files'], projectId?: string | null): ComposeOptions {
  const header = [
    `De : ${escapeHtml(mail.from.map((item) => item.name ? `${item.name} <${item.address}>` : item.address).join(', '))}`,
    `Date : ${escapeHtml(fullDate(mail.date))}`,
    `Objet : ${escapeHtml(mail.subject)}`,
    `À : ${escapeHtml(emails(mail.to).join(', '))}`,
  ].join('<br>');
  return {
    accountId: mail.accountId,
    subject: prefixedSubject(mail.subject, 'Tr'),
    quote: `<p>---------- Message transféré ----------<br>${header}</p>${bodyOf(mail)}`,
    projectId,
    forwarding: true,
    sourceFiles: mail.location ? { from: mail.location, files } : null,
  };
}
