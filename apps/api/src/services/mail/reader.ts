import type { FetchMessageObject, ListResponse, MessageAddressObject, MessageStructureObject } from 'imapflow';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import { prisma } from '../../db';
import { clientError, notFound } from '../../graphql/errors';
import { withImap } from './imap';
import { sanitizeMailHtml } from './sanitize';

export const PAGE_SIZE = 50;

export interface MailAddress {
  name: string | null;
  address: string;
}

export interface MailFolder {
  path: string;
  name: string;
  /** \Inbox, \Sent, \Drafts, \Trash, \Junk, \Archive… */
  specialUse: string | null;
  unseen: number;
  /** Depth in the folder tree (0 for top-level folders). */
  depth: number;
}

export interface MailSummary {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  date: Date;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
}

export interface MailAttachmentInfo {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
}

export interface MailView {
  accountId: string;
  folder: string;
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  replyTo: MailAddress[];
  date: Date;
  html: string | null;
  text: string | null;
  attachments: MailAttachmentInfo[];
}

// Usual order of the special folders, the others follow by name.
const SPECIAL_ORDER = ['\\Inbox', '\\Drafts', '\\Sent', '\\Archive', '\\Junk', '\\Trash'];

/**
 * Converts IMAP envelope addresses.
 * @param {MessageAddressObject[] | undefined} list Addresses.
 * @returns {MailAddress[]} Addresses.
 */
function envelopeAddresses(list: MessageAddressObject[] | undefined): MailAddress[] {
  return (list ?? []).filter((item) => item.address).map((item) => ({ name: item.name || null, address: item.address! }));
}

/**
 * Converts parsed addresses.
 * @param {AddressObject | AddressObject[] | undefined} value Parsed address header.
 * @returns {MailAddress[]} Addresses.
 */
export function parsedAddresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  const groups = value ? (Array.isArray(value) ? value : [value]) : [];
  return groups.flatMap((group) =>
    group.value.flatMap((item) => (item.group ?? [item])).filter((item) => item.address).map((item) => ({ name: item.name || null, address: item.address! })),
  );
}

/**
 * Whether a body structure contains attached files.
 * @param {MessageStructureObject | undefined} node Body structure.
 * @returns {boolean} True with attachments.
 */
function hasAttachment(node: MessageStructureObject | undefined): boolean {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes ?? []).some(hasAttachment);
}

/**
 * Removes the angle brackets of a Message-ID.
 * @param {string | undefined | null} id Message-ID.
 * @returns {string | null} Bare id.
 */
export function bareMessageId(id: string | undefined | null): string | null {
  const value = id?.trim().replace(/^<|>$/g, '');
  return value || null;
}

/**
 * Folders of an account, special ones first, with their unread count.
 * @param {string} accountId Account.
 * @returns {Promise<MailFolder[]>} Folders.
 */
export async function listFolders(accountId: string): Promise<MailFolder[]> {
  return withImap(accountId, async (client) => {
    const folders: ListResponse[] = await client.list({ statusQuery: { unseen: true } });
    const rank = (folder: ListResponse) => {
      if (folder.path.toUpperCase() === 'INBOX') return 0;
      const index = SPECIAL_ORDER.indexOf(folder.specialUse ?? '');
      return index < 0 ? SPECIAL_ORDER.length : index;
    };
    return folders
      .filter((folder) => !folder.flags.has('\\Noselect') && !folder.flags.has('\\NonExistent'))
      .sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path, 'fr'))
      .map((folder) => ({
        path: folder.path,
        name: folder.path.toUpperCase() === 'INBOX' ? 'Réception' : folder.name,
        specialUse: folder.path.toUpperCase() === 'INBOX' ? '\\Inbox' : (folder.specialUse ?? null),
        unseen: folder.status?.unseen ?? 0,
        depth: folder.parent.length,
      }));
  });
}

/**
 * Unread messages in the inbox of every account, for the sidebar.
 * @returns {Promise<number>} Count; accounts that cannot be reached are skipped.
 */
export async function unreadInboxes(): Promise<number> {
  const accounts = await prisma.mailAccount.findMany({ select: { id: true } });
  const counts = await Promise.all(
    accounts.map((account) =>
      withImap(account.id, async (client) => (await client.status('INBOX', { unseen: true })) || null)
        .then((status) => status?.unseen ?? 0)
        .catch(() => 0),
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * A page of a folder, latest first, optionally filtered by a text search (subject, sender, body).
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number} page Page, from 0.
 * @param {string} search Text search.
 * @returns {Promise<{ messages: MailSummary[], total: number }>} Messages and total count.
 */
export async function listMessages(
  accountId: string,
  folder: string,
  page: number,
  search: string,
): Promise<{ messages: MailSummary[]; total: number }> {
  return withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      let uids: number[];
      const query = search.trim();
      if (query) {
        uids = ((await client.search({ or: [{ subject: query }, { from: query }, { to: query }, { body: query }] }, { uid: true })) ||
          []) as number[];
      } else {
        uids = ((await client.search({ all: true }, { uid: true })) || []) as number[];
      }
      uids.sort((a, b) => b - a);
      const pageUids = uids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (pageUids.length === 0) return { messages: [], total: uids.length };
      const messages: MailSummary[] = [];
      const fetched: AsyncGenerator<FetchMessageObject, false | void> = client.fetch(
        pageUids,
        { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true },
        { uid: true },
      );
      for await (const message of fetched) {
        messages.push({
          uid: message.uid,
          subject: message.envelope?.subject || '(sans objet)',
          from: envelopeAddresses(message.envelope?.from),
          to: envelopeAddresses(message.envelope?.to),
          date: new Date(message.envelope?.date ?? message.internalDate ?? Date.now()),
          seen: message.flags?.has('\\Seen') ?? false,
          flagged: message.flags?.has('\\Flagged') ?? false,
          hasAttachments: hasAttachment(message.bodyStructure),
        });
      }
      messages.sort((a, b) => b.uid - a.uid);
      return { messages, total: uids.length };
    } finally {
      lock.release();
    }
  });
}

/**
 * Downloads and parses a message.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number} uid Message UID.
 * @returns {Promise<ParsedMail>} Parsed message.
 */
export async function fetchParsed(accountId: string, folder: string, uid: number): Promise<ParsedMail> {
  const source = await withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
      return message ? message.source : undefined;
    } finally {
      lock.release();
    }
  });
  if (!source) throw notFound('Mail');
  return simpleParser(source);
}

/**
 * Attachments of a parsed message, numbered in order.
 * @param {ParsedMail} parsed Parsed message.
 * @returns {MailAttachmentInfo[]} Attachments.
 */
export function attachmentInfos(parsed: ParsedMail): MailAttachmentInfo[] {
  return parsed.attachments.map((attachment, index) => ({
    index,
    filename: attachment.filename || `piece-jointe-${index + 1}`,
    contentType: attachment.contentType,
    size: attachment.size,
    inline: Boolean(attachment.related && attachment.contentId),
  }));
}

/**
 * Sanitized HTML of a message, with its inline images ("cid:") pointing to the given URLs.
 * @param {ParsedMail} parsed Parsed message.
 * @param {(index: number) => string} urlOf URL of an attachment.
 * @returns {string | null} HTML, or null for a text-only message.
 */
export function messageHtml(parsed: ParsedMail, urlOf: (index: number) => string): string | null {
  if (!parsed.html) return null;
  let html = parsed.html;
  parsed.attachments.forEach((attachment, index) => {
    const cid = attachment.contentId?.replace(/^<|>$/g, '');
    if (cid) html = html.split(`cid:${cid}`).join(urlOf(index));
  });
  return sanitizeMailHtml(html);
}

/**
 * Opens a message and marks it as read.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number} uid Message UID.
 * @returns {Promise<MailView>} Message.
 */
export async function readMessage(accountId: string, folder: string, uid: number): Promise<MailView> {
  const parsed = await fetchParsed(accountId, folder, uid);
  await setSeen(accountId, folder, [uid], true).catch(() => undefined);
  const base = `/api/mail/${accountId}/attachment?folder=${encodeURIComponent(folder)}&uid=${uid}`;
  return {
    accountId,
    folder,
    uid,
    messageId: bareMessageId(parsed.messageId),
    inReplyTo: bareMessageId(parsed.inReplyTo),
    references: (Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])
      .map(bareMessageId)
      .filter((id): id is string => id !== null),
    subject: parsed.subject || '(sans objet)',
    from: parsedAddresses(parsed.from),
    to: parsedAddresses(parsed.to),
    cc: parsedAddresses(parsed.cc),
    replyTo: parsedAddresses(parsed.replyTo),
    date: parsed.date ?? new Date(),
    html: messageHtml(parsed, (index) => `${base}&index=${index}`),
    text: parsed.text ?? null,
    attachments: attachmentInfos(parsed),
  };
}

/**
 * Marks messages as read or unread.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number[]} uids Message UIDs.
 * @param {boolean} seen Target state.
 * @returns {Promise<void>}
 */
export async function setSeen(accountId: string, folder: string, uids: number[], seen: boolean): Promise<void> {
  await withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (seen) await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
      else await client.messageFlagsRemove(uids, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  });
}

/**
 * Deletes messages: moved to the trash, or removed for good when already in it (or without a trash).
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number[]} uids Message UIDs.
 * @returns {Promise<void>}
 */
export async function deleteMessages(accountId: string, folder: string, uids: number[]): Promise<void> {
  await withImap(accountId, async (client) => {
    const trash = (await client.list()).find((item) => item.specialUse === '\\Trash');
    const lock = await client.getMailboxLock(folder);
    try {
      if (trash && trash.path !== folder) await client.messageMove(uids, trash.path, { uid: true });
      else await client.messageDelete(uids, { uid: true });
    } finally {
      lock.release();
    }
  });
}

/**
 * An attachment of a message on the server.
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number} uid Message UID.
 * @param {number} index Attachment number.
 * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>} File.
 */
export async function messageAttachment(accountId: string, folder: string, uid: number, index: number) {
  const parsed = await fetchParsed(accountId, folder, uid);
  const attachment = parsed.attachments[index];
  if (!attachment) throw clientError('NOT_FOUND', 'Pièce jointe introuvable.');
  return { filename: attachment.filename || `piece-jointe-${index + 1}`, contentType: attachment.contentType, content: attachment.content };
}
