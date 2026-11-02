import type { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../../db';
import { clientError } from '../../graphql/errors';
import { findAccount } from './accounts';
import { buildMessage, type MailFields } from './compose';
import { withImap } from './imap';
import { attachmentInfos, bareMessageId, fetchParsed, messageHtml, parsedAddresses, type MailAddress, type MailAttachmentInfo } from './reader';

/** Header keeping the context of a draft written in Ordo (project). */
const CONTEXT_HEADER = 'x-ordo-draft';

export interface SaveDraftInput extends MailFields {
  accountId: string;
  projectId?: string | null;
  /** Previous version of the draft, replaced (possibly in another account). */
  replace?: { accountId: string; folder: string; uid: number } | null;
}

export interface SavedDraft {
  accountId: string;
  folder: string;
  uid: number;
  attachments: MailAttachmentInfo[];
}

export interface DraftView {
  accountId: string;
  folder: string;
  uid: number;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  /** Full HTML; drafts written in Ordo mark their body, signature and quote. */
  html: string | null;
  text: string | null;
  inReplyTo: string | null;
  references: string[];
  projectId: string | null;
  attachments: MailAttachmentInfo[];
}

/**
 * Drafts folder of an account, created when the server has none.
 * @param {ImapFlow} client Connected client.
 * @returns {Promise<string>} Folder path.
 */
async function draftsFolder(client: ImapFlow): Promise<string> {
  const folders = await client.list();
  const drafts = folders.find((item) => item.specialUse === '\\Drafts') ?? folders.find((item) => /^(drafts|brouillons)$/i.test(item.name));
  if (drafts) return drafts.path;
  return (await client.mailboxCreate('Drafts')).path;
}

/**
 * Deletes a draft for good (drafts do not go to the trash).
 * @param {string} accountId Account.
 * @param {string} folder Folder.
 * @param {number} uid Draft UID.
 * @returns {Promise<void>}
 */
export async function deleteDraft(accountId: string, folder: string, uid: number): Promise<void> {
  await withImap(accountId, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageDelete([uid], { uid: true });
    } finally {
      lock.release();
    }
  });
}

/**
 * Saves a draft in the drafts folder of its account (replacing its previous version), readable from any
 * mail software.
 * @param {SaveDraftInput} input Draft.
 * @returns {Promise<SavedDraft>} Location of the saved draft and its files.
 */
export async function saveDraft(input: SaveDraftInput): Promise<SavedDraft> {
  const account = await findAccount(input.accountId);
  if (input.projectId && !(await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } }))) {
    throw clientError('BAD_USER_INPUT', 'Projet introuvable.');
  }
  const context = Buffer.from(JSON.stringify({ projectId: input.projectId ?? null })).toString('base64');
  const message = await buildMessage(account, input, { draft: true, headers: { 'X-Ordo-Draft': context } });
  const messageId = /^Message-ID:\s*<([^>]+)>/im.exec(message.copy.toString('utf8', 0, 8192))?.[1];

  const saved = await withImap(account.id, async (client) => {
    const folder = await draftsFolder(client);
    const appended = await client.append(folder, message.copy, ['\\Draft', '\\Seen']);
    let uid = appended ? appended.uid : undefined;
    // Servers without UIDPLUS: the draft is found by its Message-ID.
    if (!uid && messageId) {
      const lock = await client.getMailboxLock(folder);
      try {
        const found = await client.search({ header: { 'message-id': messageId } }, { uid: true });
        uid = Array.isArray(found) ? found.at(-1) : undefined;
      } finally {
        lock.release();
      }
    }
    if (!uid) throw clientError('BAD_USER_INPUT', 'Brouillon enregistré, mais introuvable dans le dossier Brouillons.');
    return { accountId: account.id, folder, uid };
  });
  if (input.replace) await deleteDraft(input.replace.accountId, input.replace.folder, input.replace.uid).catch(() => undefined);
  // Files of the new version, numbered as on the server, so the next save can keep them.
  return { ...saved, attachments: attachmentInfos(await simpleParser(message.copy)) };
}

/**
 * Opens a draft to go on writing it.
 * @param {string} accountId Account.
 * @param {string} folder Folder.
 * @param {number} uid Draft UID.
 * @returns {Promise<DraftView>} Draft.
 */
export async function readDraft(accountId: string, folder: string, uid: number): Promise<DraftView> {
  const parsed = await fetchParsed(accountId, folder, uid);
  let projectId: string | null = null;
  const context = parsed.headers.get(CONTEXT_HEADER);
  if (typeof context === 'string') {
    try {
      projectId = (JSON.parse(Buffer.from(context, 'base64').toString('utf8')) as { projectId?: string | null }).projectId ?? null;
    } catch {
      // Unreadable context: a plain draft.
    }
  }
  const base = `/api/mail/${accountId}/attachment?folder=${encodeURIComponent(folder)}&uid=${uid}`;
  const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
  return {
    accountId,
    folder,
    uid,
    to: parsedAddresses(parsed.to),
    cc: parsedAddresses(parsed.cc),
    bcc: parsedAddresses(parsed.bcc),
    subject: parsed.subject ?? '',
    html: messageHtml(parsed, (index) => `${base}&index=${index}`),
    text: parsed.text ?? null,
    inReplyTo: bareMessageId(parsed.inReplyTo),
    references: references.map(bareMessageId).filter((id): id is string => id !== null),
    projectId,
    attachments: attachmentInfos(parsed),
  };
}
