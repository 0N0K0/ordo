import { randomUUID } from 'node:crypto';
import type { ParsedMail } from 'mailparser';
import { simpleParser } from 'mailparser';
import { prisma } from '../../db';
import type { MailMessage } from '../../generated/prisma/client';
import { notFound } from '../../graphql/errors';
import { attachmentData } from '../attachments';
import { withImap } from './imap';
import { bareMessageId, fetchParsed, messageHtml, parsedAddresses } from './reader';

/**
 * Message-IDs a message refers to (In-Reply-To and References).
 * @param {ParsedMail} parsed Parsed message.
 * @returns {string[]} Bare ids.
 */
function referencedIds(parsed: ParsedMail): string[] {
  const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
  return [...new Set([parsed.inReplyTo, ...references].map(bareMessageId).filter((id): id is string => id !== null))];
}

/**
 * Copies a parsed message into a project (its files included). Already copied: the existing copy is returned.
 * @param {ParsedMail} parsed Parsed message.
 * @param {object} options Options.
 * @param {string} options.projectId Project.
 * @param {string | null} options.accountId Account it comes from.
 * @param {boolean} options.sent Whether it was sent from Ordo.
 * @returns {Promise<MailMessage>} Copy.
 */
export async function copyToProject(
  parsed: ParsedMail,
  { projectId, accountId, sent }: { projectId: string; accountId: string | null; sent: boolean },
): Promise<MailMessage> {
  const messageId = bareMessageId(parsed.messageId) ?? `ordo-${randomUUID()}`;
  const existing = await prisma.mailMessage.findUnique({ where: { projectId_messageId: { projectId, messageId } } });
  if (existing) return existing;
  const from = parsedAddresses(parsed.from)[0];
  const references = referencedIds(parsed);

  return prisma.$transaction(async (tx) => {
    const message = await tx.mailMessage.create({
      data: {
        projectId,
        accountId,
        messageId,
        inReplyTo: bareMessageId(parsed.inReplyTo),
        references,
        subject: parsed.subject || '(sans objet)',
        fromName: from?.name ?? null,
        fromAddress: from?.address ?? '',
        to: parsedAddresses(parsed.to) as object[],
        cc: parsedAddresses(parsed.cc) as object[],
        date: parsed.date ?? new Date(),
        text: parsed.text ?? null,
        sent,
      },
    });
    const urls: string[] = [];
    for (const attachment of parsed.attachments) {
      const stored = await tx.attachment.create({
        data: {
          ...attachmentData(attachment.filename || 'piece-jointe', attachment.content),
          mailMessageId: message.id,
          contentId: attachment.contentId?.replace(/^<|>$/g, '') ?? null,
        },
        select: { id: true, name: true },
      });
      urls.push(`/api/attachments/${stored.id}/${encodeURIComponent(stored.name)}`);
    }
    // Inline images point to the stored copies.
    const html = messageHtml(parsed, (index) => urls[index]);
    return tx.mailMessage.update({ where: { id: message.id }, data: { html } });
  });
}

/**
 * Links a message of a mailbox to a project (a copy is stored in Ordo).
 * @param {string} accountId Account.
 * @param {string} folder Folder path.
 * @param {number} uid Message UID.
 * @param {string} projectId Project.
 * @returns {Promise<MailMessage>} Copy.
 */
export async function linkMessage(accountId: string, folder: string, uid: number, projectId: string): Promise<MailMessage> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw notFound('Projet');
  const parsed = await fetchParsed(accountId, folder, uid);
  return copyToProject(parsed, { projectId, accountId, sent: false });
}

/**
 * Unlinks a mail from its project (the copy is deleted; the mail stays in its mailbox).
 * @param {string} id Copy id.
 * @returns {Promise<void>}
 */
export async function unlinkMail(id: string): Promise<void> {
  if (!(await prisma.mailMessage.findUnique({ where: { id } }))) throw notFound('Mail');
  await prisma.mailMessage.delete({ where: { id } });
}

/**
 * Projects a sent mail belongs to: the given one, and those of the conversation it replies to.
 * @param {string[]} references Message-IDs it refers to.
 * @param {string | null} projectId Project it was written from.
 * @returns {Promise<string[]>} Projects.
 */
export async function conversationProjects(references: string[], projectId: string | null): Promise<string[]> {
  const linked = references.length
    ? await prisma.mailMessage.findMany({ where: { messageId: { in: references } }, select: { projectId: true } })
    : [];
  return [...new Set([...(projectId ? [projectId] : []), ...linked.map((item) => item.projectId)])];
}

/**
 * Stores a mail sent from Ordo in the projects of its conversation.
 * @param {Buffer} raw Raw sent message.
 * @param {string} accountId Sending account.
 * @param {string[]} projectIds Projects.
 * @returns {Promise<void>}
 */
export async function copySentToProjects(raw: Buffer, accountId: string, projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) return;
  const parsed = await simpleParser(raw);
  for (const projectId of projectIds) await copyToProject(parsed, { projectId, accountId, sent: true });
}

let following = false;

/** Messages checked in a folder the first time. */
const FIRST_RUN_MESSAGES = 200;

/**
 * Links the new messages of conversations already linked to projects: new mails of the inbox and of the
 * sent folder replying to (or referring to) a linked mail join its projects. Each folder is read from
 * where the previous run stopped.
 * @returns {Promise<void>}
 */
export async function followConversations(): Promise<void> {
  if (following) return;
  following = true;
  try {
    const linked = await prisma.mailMessage.findMany({ select: { messageId: true, projectId: true } });
    if (linked.length === 0) return;
    const projectsOf = new Map<string, Set<string>>();
    for (const item of linked) projectsOf.set(item.messageId, (projectsOf.get(item.messageId) ?? new Set()).add(item.projectId));

    const accounts = await prisma.mailAccount.findMany({ select: { id: true } });
    for (const account of accounts) {
      const found: { folder: string; uid: number; projects: Set<string> }[] = [];
      try {
        await withImap(account.id, async (client) => {
          const folders = (await client.list()).filter((item) => item.path.toUpperCase() === 'INBOX' || item.specialUse === '\\Sent');
          for (const folder of folders) {
            const lock = await client.getMailboxLock(folder.path);
            try {
              const mailbox = client.mailbox;
              if (!mailbox) continue;
              const cursor = await prisma.mailFolderCursor.findUnique({
                where: { accountId_folder: { accountId: account.id, folder: folder.path } },
              });
              const last = mailbox.uidNext - 1;
              // First run, or folder rebuilt: the latest messages are checked (copies are never duplicated).
              const fresh = !cursor || cursor.uidValidity !== mailbox.uidValidity;
              const from = fresh ? Math.max(0, last - FIRST_RUN_MESSAGES) : cursor.lastUid;
              await prisma.mailFolderCursor.upsert({
                where: { accountId_folder: { accountId: account.id, folder: folder.path } },
                create: { accountId: account.id, folder: folder.path, uidValidity: mailbox.uidValidity, lastUid: from },
                update: { uidValidity: mailbox.uidValidity, lastUid: from },
              });
              if (last <= from) continue;
              let maxUid = from;
              for await (const message of client.fetch(
                `${from + 1}:*`,
                { uid: true, envelope: true, headers: ['references'] },
                { uid: true },
              )) {
                // "n:*" also returns the last message when there is none after n.
                if (message.uid <= from) continue;
                maxUid = Math.max(maxUid, message.uid);
                const header = message.headers?.toString('utf8') ?? '';
                const ids = [message.envelope?.inReplyTo, ...(header.match(/<[^>]+>/g) ?? [])]
                  .map(bareMessageId)
                  .filter((id): id is string => id !== null);
                const own = bareMessageId(message.envelope?.messageId);
                const projects = new Set(ids.flatMap((id) => [...(projectsOf.get(id) ?? [])]));
                for (const project of own ? (projectsOf.get(own) ?? []) : []) projects.delete(project);
                if (projects.size > 0) found.push({ folder: folder.path, uid: message.uid, projects });
              }
              await prisma.mailFolderCursor.update({
                where: { accountId_folder: { accountId: account.id, folder: folder.path } },
                data: { lastUid: maxUid },
              });
            } finally {
              lock.release();
            }
          }
        });
        for (const item of found) {
          const parsed = await fetchParsed(account.id, item.folder, item.uid);
          for (const projectId of item.projects) {
            const copy = await copyToProject(parsed, { projectId, accountId: account.id, sent: item.folder.toUpperCase() !== 'INBOX' });
            projectsOf.set(copy.messageId, (projectsOf.get(copy.messageId) ?? new Set()).add(projectId));
          }
        }
      } catch (error) {
        // An unreachable mailbox does not stop the others.
        console.warn(`Suivi des conversations : boîte ${account.id} ignorée.`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    following = false;
  }
}

/**
 * Starts the periodic follow-up of linked conversations.
 * @param {number} [intervalMs] Interval. Optional. Default = 5 minutes.
 * @returns {void}
 */
export function scheduleConversationFollowUp(intervalMs = 5 * 60_000): void {
  const run = () => void followConversations().catch((error: unknown) => console.warn('Suivi des conversations en échec.', error));
  setTimeout(run, 30_000);
  setInterval(run, intervalMs);
}

