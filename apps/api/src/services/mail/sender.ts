import { clientError } from '../../graphql/errors';
import type { MailAccount } from '../../generated/prisma/client';
import { createSmtpTransport, findAccount } from './accounts';
import { buildMessage, type BuiltMessage, type MailFields } from './compose';
import { deleteDraft } from './drafts';
import { withImap } from './imap';
import { conversationProjects, copySentToProjects } from './linked';
import { decryptSecret } from './secret';

export interface SendMailInput extends MailFields {
  accountId: string;
  /** Project the mail is written from: the sent mail is linked to it. */
  projectId?: string | null;
  /** Draft the mail comes from, deleted once sent. */
  draft?: { accountId: string; folder: string; uid: number } | null;
}

/**
 * Delivers a built message: SMTP, copy in the sent folder (if enabled), copy in the projects of its
 * conversation and in the project it was written from.
 * @param {MailAccount} account Sending account.
 * @param {Pick<BuiltMessage, 'raw' | 'copy' | 'recipients' | 'references'>} message Message.
 * @param {string | null} projectId Project it was written from.
 * @returns {Promise<string[]>} Projects the sent mail was linked to.
 */
export async function deliverMessage(
  account: MailAccount,
  message: Pick<BuiltMessage, 'raw' | 'copy' | 'recipients' | 'references'>,
  projectId: string | null,
): Promise<string[]> {
  try {
    await createSmtpTransport(account, decryptSecret(account.smtpPassword)).sendMail({
      envelope: { from: account.email, to: message.recipients },
      raw: message.raw,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw clientError('BAD_USER_INPUT', `Envoi impossible (${detail}).`);
  }

  // The mail is sent: what follows is not an error for the user.
  if (account.saveSent) {
    await withImap(account.id, async (client) => {
      const sent = (await client.list()).find((item) => item.specialUse === '\\Sent');
      if (sent) await client.append(sent.path, message.copy, ['\\Seen']);
    }).catch((error: unknown) => console.warn('Copie dans « Envoyés » impossible.', error));
  }
  const projectIds = await conversationProjects(message.references, projectId);
  await copySentToProjects(message.copy, account.id, projectIds);
  return projectIds;
}

/**
 * Sends a mail from an account (see deliverMessage), then removes its draft.
 * @param {SendMailInput} input Mail.
 * @returns {Promise<{ projectIds: string[] }>} Projects the sent mail was linked to.
 */
export async function sendMail(input: SendMailInput): Promise<{ projectIds: string[] }> {
  const account = await findAccount(input.accountId);
  const message = await buildMessage(account, input);
  const projectIds = await deliverMessage(account, message, input.projectId ?? null);
  if (input.draft) await deleteDraft(input.draft.accountId, input.draft.folder, input.draft.uid).catch(() => undefined);
  return { projectIds };
}
