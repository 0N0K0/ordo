import { mailAccountFormSchema, signatureSchema, type MailAccountFormValues } from '@ordo/shared';
import nodemailer from 'nodemailer';
import { prisma } from '../../db';
import { assertNotArchived } from '../core/archive';
import type { MailAccount } from '../../generated/prisma/client';
import { clientError, errorMessage, fieldError, orNotFound, parseInput } from '../../graphql/errors';
import { moveInList, nextPositionIn } from '../core/ordering';
import { closeImap, createImapClient, rethrowImapError } from './imap';
import { sanitizeMailHtml } from './sanitize';
import { decryptSecret, encryptSecret } from './secret';

/**
 * SMTP transport of an account.
 * @param {Pick<MailAccount, 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser'>} account Account settings.
 * @param {string} password Plain password.
 * @returns {nodemailer.Transporter} Transport.
 */
export function createSmtpTransport(
  account: Pick<MailAccount, 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser'>,
  password: string,
) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.smtpUser, pass: password },
    connectionTimeout: 15_000,
  });
}

/**
 * Loads an account or throws NOT_FOUND.
 * @param {string} id Account id.
 * @returns {Promise<MailAccount>} Account.
 */
export async function findAccount(id: string): Promise<MailAccount> {
  const account = await orNotFound(prisma.mailAccount.findUnique({ where: { id } }), 'Boîte mail');
  return account;
}

/**
 * Loads an account that can be used (to send, to change its mails): NOT_FOUND, or BAD_USER_INPUT when it is archived.
 * @param {string} id Account id.
 * @returns {Promise<MailAccount>} Account.
 */
export async function findActiveAccount(id: string): Promise<MailAccount> {
  const account = await findAccount(id);
  await assertNotArchived('MAIL_ACCOUNT', id);
  return account;
}

/**
 * A saved password is only reused with the server it was saved for: changing the server, port, login or
 * encryption requires typing it again (otherwise it could be sent to another server).
 * @param {MailAccountFormValues} values New settings.
 * @param {MailAccount | null} saved Saved account.
 * @returns {void}
 */
function assertPasswordsForServers(values: MailAccountFormValues, saved: MailAccount | null): void {
  if (!saved) return;
  const message = 'Saisissez à nouveau le mot de passe : le serveur, le port, l’identifiant ou le chiffrement a changé.';
  const imapChanged =
    values.imapHost !== saved.imapHost || values.imapPort !== saved.imapPort || values.imapUser !== saved.imapUser || values.imapSecure !== saved.imapSecure;
  const smtpChanged =
    values.smtpHost !== saved.smtpHost || values.smtpPort !== saved.smtpPort || values.smtpUser !== saved.smtpUser || values.smtpSecure !== saved.smtpSecure;
  if (imapChanged && !values.imapPassword) throw fieldError('imapPassword', message);
  if (smtpChanged && !values.smtpPassword) throw fieldError('smtpPassword', message);
}

/**
 * Checks the IMAP and SMTP settings by connecting to both servers.
 * @param {MailAccountFormValues & { id?: string }} input Settings; empty passwords use the saved ones of `id`.
 * @returns {Promise<void>}
 */
export async function testMailAccount(input: MailAccountFormValues & { id?: string }): Promise<void> {
  const values = parseInput(mailAccountFormSchema, input);
  const saved = input.id ? await findAccount(input.id) : null;
  assertPasswordsForServers(values, saved);
  const imapPassword = values.imapPassword || (saved ? decryptSecret(saved.imapPassword) : '');
  const smtpPassword = values.smtpPassword || (saved ? decryptSecret(saved.smtpPassword) : '');

  const imap = createImapClient(values, imapPassword);
  try {
    await imap.connect();
  } catch (error) {
    rethrowImapError(error);
  } finally {
    await imap.logout().catch(() => undefined);
  }
  try {
    await createSmtpTransport(values, smtpPassword).verify();
  } catch (error) {
    const detail = errorMessage(error);
    throw clientError('BAD_USER_INPUT', `Connexion SMTP impossible (${detail}).`);
  }
}

/**
 * Validated account data; passwords are encrypted, and kept when left empty on edition.
 * @param {MailAccountFormValues} input Settings.
 * @param {boolean} creating Whether the account is new (passwords required).
 * @returns {object} Prisma data.
 */
function accountData(input: MailAccountFormValues, creating: boolean) {
  const values = parseInput(mailAccountFormSchema, input);
  if (creating && !values.imapPassword) {
    throw fieldError('imapPassword', 'Le mot de passe est requis.');
  }
  if (creating && !values.smtpPassword) {
    throw fieldError('smtpPassword', 'Le mot de passe est requis.');
  }
  const { imapPassword, smtpPassword, displayName, ...rest } = values;
  return {
    ...rest,
    displayName: displayName || null,
    ...(imapPassword && { imapPassword: encryptSecret(imapPassword) }),
    ...(smtpPassword && { smtpPassword: encryptSecret(smtpPassword) }),
  };
}

/**
 * Adds a mail account at the end of the list.
 * @param {MailAccountFormValues} input Settings.
 * @returns {Promise<MailAccount>} Account.
 */
export async function createMailAccount(input: MailAccountFormValues): Promise<MailAccount> {
  const data = accountData(input, true);
  const position = await nextPositionIn('mailAccount');
  return prisma.mailAccount.create({
    data: { ...data, imapPassword: data.imapPassword!, smtpPassword: data.smtpPassword!, position },
  });
}

/**
 * Updates the settings of a mail account.
 * @param {string} id Account id.
 * @param {MailAccountFormValues} input Settings.
 * @returns {Promise<MailAccount>} Account.
 */
export async function updateMailAccount(id: string, input: MailAccountFormValues): Promise<MailAccount> {
  assertPasswordsForServers(parseInput(mailAccountFormSchema, input), await findActiveAccount(id));
  const account = await prisma.mailAccount.update({ where: { id }, data: accountData(input, false) });
  closeImap(id);
  return account;
}

/**
 * Sets the HTML signature of an account (sanitized).
 * @param {string} id Account id.
 * @param {string} signature HTML; empty removes it.
 * @returns {Promise<MailAccount>} Account.
 */
export async function setMailSignature(id: string, signature: string): Promise<MailAccount> {
  await findActiveAccount(id);
  const html = parseInput(signatureSchema, signature).trim();
  return prisma.mailAccount.update({ where: { id }, data: { signature: html ? sanitizeMailHtml(html) : null } });
}

/**
 * Removes a mail account from Ordo (the mailbox itself is untouched; mails linked to projects are kept).
 * @param {string} id Account id.
 * @returns {Promise<void>}
 */
export async function deleteMailAccount(id: string): Promise<void> {
  await findAccount(id);
  closeImap(id);
  await prisma.mailAccount.delete({ where: { id } });
}

/**
 * Moves an account in the list.
 * @param {string} id Account id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveMailAccount(id: string, index: number): Promise<void> {
  await findActiveAccount(id);
  await moveInList('mailAccount', id, index);
}
