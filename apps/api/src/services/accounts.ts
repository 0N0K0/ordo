import { emailSchema, usernameSchema } from '@ordo/shared';
import { z } from 'zod';
import { generateToken, hashPassword } from '../auth/crypto';
import { destroyUserSessions } from '../auth/session';
import { unscopedPrisma } from '../db';
import { env } from '../env';
import { Prisma, type User } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { sendMail } from '../mail/mailer';
import { accountSetupMail } from '../mail/templates';
import { createWorkspace, deleteWorkspace, firstWorkspaceOf } from './workspaces';

const SETUP_TTL_DAYS = 7;

/**
 * Throws unless the account is the admin: she alone manages the accounts.
 * @param {string} userId Logged-in account.
 * @returns {Promise<void>}
 */
export async function requireAdmin(userId: string): Promise<void> {
  const user = await unscopedPrisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw clientError('FORBIDDEN', 'Seule l’administratrice gère les comptes.');
}

/**
 * Account managed by the admin: any other than hers (hers can be neither disabled nor deleted from the app).
 * @param {string} id Account.
 * @returns {Promise<User>} Account.
 */
async function managedAccount(id: string): Promise<User> {
  const user = await unscopedPrisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('Compte');
  if (user.role === 'ADMIN') throw clientError('FORBIDDEN', 'Le compte administrateur ne peut être ni désactivé ni supprimé.');
  return user;
}

/**
 * Sends a new account the link to choose its password (a previous link stops working).
 * @param {User} user Account.
 * @returns {Promise<void>}
 */
async function sendSetupLink(user: User): Promise<void> {
  const { token, tokenHash } = generateToken();
  await unscopedPrisma.$transaction([
    unscopedPrisma.authToken.deleteMany({ where: { userId: user.id, type: 'ACCOUNT_SETUP' } }),
    unscopedPrisma.authToken.create({ data: { tokenHash, type: 'ACCOUNT_SETUP', userId: user.id, expiresAt: new Date(Date.now() + SETUP_TTL_DAYS * 86_400_000) } }),
  ]);
  const url = new URL('/setup-account', env.APP_URL);
  url.searchParams.set('token', token);
  await sendMail(accountSetupMail(user.email, user.username, url.toString(), SETUP_TTL_DAYS));
}

/**
 * Creates an account: its owner receives by email a link to choose the password (until then, nobody can log in
 * with it). It starts with a personal workspace of its own, which only it sees.
 * @param {{ username: string, email: string }} input Login name and email.
 * @returns {Promise<User>} Account.
 */
export async function createAccount(input: { username: string; email: string }): Promise<User> {
  const { username, email } = parseInput(z.object({ username: usernameSchema, email: emailSchema }), input);
  let user: User;
  try {
    // No password until its owner chooses one: a random one nobody knows.
    user = await unscopedPrisma.user.create({ data: { username, email, role: 'MEMBER', passwordPending: true, passwordHash: await hashPassword(generateToken().token) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      throw target.includes('email')
        ? clientError('CONFLICT', 'Cette adresse email est déjà utilisée.', { fields: { email: 'Adresse déjà utilisée.' } })
        : clientError('CONFLICT', 'Cet identifiant est déjà utilisé.', { fields: { username: 'Identifiant déjà utilisé.' } });
    }
    throw error;
  }
  // A personal workspace: only the admin has professional ones.
  await createWorkspace(await firstWorkspaceOf(user.id), user.id);
  await sendSetupLink(user).catch((error: unknown) => {
    // The account exists: its link can be sent again from the list.
    throw clientError('SERVICE_UNAVAILABLE', `Compte créé, mais le lien n’a pas pu être envoyé (${error instanceof Error ? error.message : String(error)}) : renvoyez-le depuis la liste.`);
  });
  return user;
}

/**
 * Sends again the link of an account whose owner has not chosen a password yet.
 * @param {string} id Account.
 * @returns {Promise<void>}
 */
export async function resendSetupLink(id: string): Promise<void> {
  const user = await managedAccount(id);
  if (!user.passwordPending) throw clientError('BAD_USER_INPUT', 'Ce compte a déjà choisi son mot de passe.');
  await sendSetupLink(user);
}

/**
 * Disables an account (it is logged out and can no longer log in) or enables it again.
 * @param {string} id Account.
 * @param {boolean} disabled Disabled.
 * @returns {Promise<User>} Account.
 */
export async function setAccountDisabled(id: string, disabled: boolean): Promise<User> {
  await managedAccount(id);
  const user = await unscopedPrisma.user.update({ where: { id }, data: { disabledAt: disabled ? new Date() : null } });
  if (disabled) await destroyUserSessions(id);
  return user;
}

/**
 * Deletes an account with its workspaces and everything in them.
 * @param {string} id Account.
 * @returns {Promise<void>}
 */
export async function deleteAccount(id: string): Promise<void> {
  await managedAccount(id);
  for (const workspace of await unscopedPrisma.workspace.findMany({ where: { ownerId: id }, select: { id: true } })) {
    await deleteWorkspace(workspace.id, id, { withAccount: true });
  }
  await unscopedPrisma.user.delete({ where: { id } });
}
