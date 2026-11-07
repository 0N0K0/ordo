import { prisma } from '../../db';
import type { ScheduledMail } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { findAccount } from './accounts';
import { buildMessage } from './compose';
import { deleteDraft } from './drafts';
import { withImap } from './imap';
import { deliverMessage, type SendMailInput } from './sender';

/**
 * Schedules a mail: the message is built now (files included, dated of its sending time) and kept until then;
 * its draft is removed.
 * @param {SendMailInput} input Mail.
 * @param {Date} sendAt Time to send it.
 * @returns {Promise<ScheduledMail>} Scheduled mail.
 */
export async function scheduleMail(input: SendMailInput, sendAt: Date): Promise<ScheduledMail> {
  if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() + 30_000) {
    throw clientError('BAD_USER_INPUT', 'Choisissez un moment à venir.', { fields: { sendAt: 'Choisissez un moment à venir.' } });
  }
  const account = await findAccount(input.accountId);
  const message = await buildMessage(account, input, { date: sendAt });
  const scheduled = await prisma.scheduledMail.create({
    data: {
      accountId: account.id,
      sendAt,
      subject: input.subject.trim() || '(sans objet)',
      to: [...input.to],
      raw: new Uint8Array(message.raw),
      copy: new Uint8Array(message.copy),
      recipients: message.recipients,
      references: message.references,
      projectId: input.projectId ?? null,
    },
  });
  if (input.draft) await deleteDraft(input.draft.accountId, input.draft.folder, input.draft.uid).catch(() => undefined);
  return scheduled;
}

/**
 * Sends a scheduled mail (claimed first, so that it is sent once).
 * @param {string} id Scheduled mail.
 * @returns {Promise<void>}
 */
export async function sendScheduled(id: string): Promise<void> {
  const { count } = await prisma.scheduledMail.updateMany({ where: { id, status: { in: ['PENDING', 'FAILED'] } }, data: { status: 'SENDING', error: null } });
  if (!count) throw notFound('Envoi programmé');
  const scheduled = await prisma.scheduledMail.findUniqueOrThrow({ where: { id } });
  try {
    const account = await findAccount(scheduled.accountId);
    await deliverMessage(account, { raw: Buffer.from(scheduled.raw), copy: Buffer.from(scheduled.copy), recipients: scheduled.recipients, references: scheduled.references }, scheduled.projectId);
    await prisma.scheduledMail.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.scheduledMail.update({ where: { id }, data: { status: 'FAILED', error: message } });
    throw error;
  }
}

/**
 * Cancels a scheduled mail: it goes back to the drafts folder of its account, to be changed or sent.
 * @param {string} id Scheduled mail.
 * @returns {Promise<void>}
 */
export async function cancelScheduled(id: string): Promise<void> {
  const scheduled = await prisma.scheduledMail.findUnique({ where: { id } });
  if (!scheduled || scheduled.status === 'SENT' || scheduled.status === 'SENDING') throw notFound('Envoi programmé');
  await withImap(scheduled.accountId, async (client) => {
    const folders = await client.list();
    const drafts = folders.find((item) => item.specialUse === '\\Drafts') ?? folders.find((item) => /^(drafts|brouillons)$/i.test(item.name));
    const path = drafts ? drafts.path : (await client.mailboxCreate(['Drafts'])).path;
    await client.append(path, Buffer.from(scheduled.copy), ['\\Draft', '\\Seen']);
  });
  await prisma.scheduledMail.delete({ where: { id } });
}

/**
 * Sends the scheduled mails whose time has come.
 * @returns {Promise<void>}
 */
export async function sendDueMails(): Promise<void> {
  const due = await prisma.scheduledMail.findMany({ where: { status: 'PENDING', sendAt: { lte: new Date() } }, select: { id: true }, orderBy: { sendAt: 'asc' } });
  for (const { id } of due) await sendScheduled(id).catch((error: unknown) => console.warn('Envoi programmé en échec.', error));
}

/**
 * Sends the scheduled mails every half minute (and the late ones at start).
 * @param {number} [intervalMs] Interval. Optional. Default = 30 s.
 * @returns {void}
 */
export function scheduleMailSending(intervalMs = 30_000): void {
  const run = () => void sendDueMails().catch((error: unknown) => console.warn('Envois programmés en échec.', error));
  // Interrupted while sending (restart): failed rather than sent twice; it can be sent again by hand.
  void prisma.scheduledMail
    .updateMany({ where: { status: 'SENDING' }, data: { status: 'FAILED', error: 'Envoi interrompu (redémarrage) : vérifiez s’il est parti avant de le renvoyer.' } })
    .catch(() => undefined);
  setTimeout(run, 10_000);
  setInterval(run, intervalMs);
}
