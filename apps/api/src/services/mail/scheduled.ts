import { prisma } from '../../db';
import type { ScheduledMail } from '../../generated/prisma/client';
import { errorMessage, fieldError, notFound } from '../../graphql/errors';
import { findActiveAccount } from './accounts';
import { assertActive } from '../core/archive';
import { buildMessage } from './compose';
import { deleteDraft } from './drafts';
import { withImap } from './imap';
import { specialFolder } from './organize';
import { deliverMessage, type SendMailInput } from './sender';
import { forEachWorkspace, schedulePerWorkspace } from '../workspaces/workspaces';
import { NO_SUBJECT } from '@ordo/shared';

/**
 * Schedules a mail: the message is built now (files included, dated of its sending time) and kept until then;
 * its draft is removed.
 * @param {SendMailInput} input Mail.
 * @param {Date} sendAt Time to send it.
 * @returns {Promise<ScheduledMail>} Scheduled mail.
 */
export async function scheduleMail(input: SendMailInput, sendAt: Date): Promise<ScheduledMail> {
  if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() + 30_000) {
    throw fieldError('sendAt', 'Choisissez un moment à venir.');
  }
  const account = await findActiveAccount(input.accountId);
  await assertActive(prisma.project, input.projectId, 'Projet', { field: 'projectId' });
  const message = await buildMessage(account, input, { date: sendAt });
  const scheduled = await prisma.scheduledMail.create({
    data: {
      accountId: account.id,
      sendAt,
      subject: input.subject.trim() || NO_SUBJECT,
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
    const account = await findActiveAccount(scheduled.accountId);
    await deliverMessage(account, { raw: Buffer.from(scheduled.raw), copy: Buffer.from(scheduled.copy), recipients: scheduled.recipients, references: scheduled.references }, scheduled.projectId);
    await prisma.scheduledMail.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
  } catch (error) {
    const message = errorMessage(error);
    await prisma.scheduledMail.update({ where: { id }, data: { status: 'FAILED', error: message } });
    throw error;
  }
}

/**
 * Cancels a scheduled mail (not one of an archived account): it goes back to the drafts folder of its account, to be changed or sent.
 * @param {string} id Scheduled mail.
 * @returns {Promise<void>}
 */
export async function cancelScheduled(id: string): Promise<void> {
  const scheduled = await prisma.scheduledMail.findUnique({ where: { id } });
  if (!scheduled || scheduled.status === 'SENT' || scheduled.status === 'SENDING') throw notFound('Envoi programmé');
  await findActiveAccount(scheduled.accountId);
  await withImap(scheduled.accountId, async (client) => {
    const path = await specialFolder(client, '\\Drafts', 'Drafts');
    await client.append(path, Buffer.from(scheduled.copy), ['\\Draft', '\\Seen']);
  });
  await prisma.scheduledMail.delete({ where: { id } });
}

/**
 * Sends the scheduled mails whose time has come (those of an archived account wait until it is restored).
 * @returns {Promise<void>}
 */
async function sendDueMails(): Promise<void> {
  const due = await prisma.scheduledMail.findMany({ where: { status: 'PENDING', sendAt: { lte: new Date() }, account: { archivedAt: null } }, select: { id: true }, orderBy: { sendAt: 'asc' } });
  for (const { id } of due) await sendScheduled(id).catch((error: unknown) => console.warn('Envoi programmé en échec.', error));
}

/**
 * Sends the scheduled mails every half minute (and the late ones at start).
 * @param {number} [intervalMs] Interval. Optional. Default = 30 s.
 * @returns {void}
 */
export function scheduleMailSending(intervalMs = 30_000): void {
  // Interrupted while sending (restart): failed rather than sent twice; it can be sent again by hand.
  void forEachWorkspace(() =>
    prisma.scheduledMail.updateMany({
      where: { status: 'SENDING' },
      data: { status: 'FAILED', error: 'Envoi interrompu (redémarrage) : vérifiez s’il est parti avant de le renvoyer.' },
    }),
  );
  schedulePerWorkspace('Envois programmés', () => sendDueMails(), { delay: 10_000, interval: intervalMs });
}
