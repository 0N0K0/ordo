import { emailSchema, identifierSchema, usernameSchema } from '@ordo/shared';
import { strongPasswordSchema } from '@ordo/shared/password-strength';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { hashPassword, generateToken, hashToken, verifyPassword } from '../auth/crypto';
import {
  consume,
  loginLimiter,
  passwordCheckLimiter,
  reset,
  resetRequestLimiter,
} from '../auth/rate-limit';
import {
  createSession,
  destroySession,
  destroyUserSessions,
  purgeExpiredSessions,
  type SessionInfo,
} from '../auth/session';
import { prisma } from '../db';
import { env } from '../env';
import { Prisma, type User } from '../generated/prisma/client';
import { clientError, parseInput } from '../graphql/errors';
import type { Mail } from '../mail/mailer';
import { sendMail } from '../mail/mailer';
import {
  emailChangedNoticeMail,
  emailChangeMail,
  passwordChangedNoticeMail,
  passwordResetMail,
} from '../mail/templates';

const RESET_TTL_MINUTES = 30;
const EMAIL_CHANGE_TTL_HOURS = 24;

const INVALID_TOKEN_MESSAGE = 'Ce lien est invalide ou a expiré.';

/**
 * Sends an email without blocking the response; failures are logged.
 * @param {Mail} mail Email to send.
 * @returns {void}
 */
function sendInBackground(mail: Mail): void {
  sendMail(mail).catch((error: unknown) => console.error('Mail delivery failed:', error));
}

/**
 * Whether a Prisma error is a unique constraint violation.
 * @param {unknown} error Caught error.
 * @returns {boolean} True for a P2002 error.
 */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Loads the session user and checks their current password (rate-limited).
 * @param {SessionInfo} session Current session.
 * @param {string} currentPassword Password typed by the user.
 * @returns {Promise<User>} Verified user.
 */
async function verifyCurrentPassword(session: SessionInfo, currentPassword: string): Promise<User> {
  await consume(passwordCheckLimiter, session.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    const message = 'Mot de passe actuel incorrect.';
    throw clientError('INVALID_CREDENTIALS', message, { fields: { currentPassword: message } });
  }
  await reset(passwordCheckLimiter, session.userId);
  return user;
}

/**
 * Finds a valid (unexpired) email token.
 * @param {string} token Token from the link.
 * @param {'PASSWORD_RESET' | 'EMAIL_CHANGE' | 'ACCOUNT_SETUP'} type Expected token type.
 * @returns {Promise<object>} Token with its user.
 */
async function findValidToken(token: string, type: 'PASSWORD_RESET' | 'EMAIL_CHANGE' | 'ACCOUNT_SETUP') {
  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!authToken || authToken.type !== type || authToken.expiresAt <= new Date()) {
    throw clientError('INVALID_TOKEN', INVALID_TOKEN_MESSAGE);
  }
  return authToken;
}

/**
 * Logs in with a username or email and a password, then opens a session.
 * @param {Request} req Express request.
 * @param {Response} res Express response.
 * @param {object} input Login input.
 * @param {string} input.identifier Username or email.
 * @param {string} input.password Password.
 * @returns {Promise<User>} Logged-in user.
 */
export async function login(
  req: Request,
  res: Response,
  input: { identifier: string; password: string },
): Promise<User> {
  const { identifier, password } = parseInput(
    z.object({ identifier: identifierSchema, password: z.string().min(1) }),
    input,
  );
  const ip = req.ip ?? 'unknown';
  await consume(loginLimiter, `ip:${ip}`, `id:${identifier}`);

  const user = await prisma.user.findUnique({
    where: identifier.includes('@') ? { email: identifier } : { username: identifier },
  });
  if (!(await verifyPassword(user?.passwordHash ?? null, password)) || !user) {
    throw clientError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
  }
  // Told only once the password is right: the account cannot be probed.
  if (user.disabledAt) throw clientError('FORBIDDEN', 'Ce compte est désactivé.');

  await reset(loginLimiter, `ip:${ip}`, `id:${identifier}`);
  await purgeExpiredSessions();
  await createSession(req, res, user.id);
  return user;
}

/**
 * Closes the current session.
 * @param {Response} res Express response.
 * @param {SessionInfo | null} session Current session, if any.
 * @returns {Promise<void>}
 */
export async function logout(res: Response, session: SessionInfo | null): Promise<void> {
  if (session) await destroySession(res, session.id);
}

/**
 * Sends a password reset link. Always succeeds, so accounts cannot be probed.
 * @param {Request} req Express request.
 * @param {string} rawIdentifier Username or email.
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(req: Request, rawIdentifier: string): Promise<void> {
  const { identifier } = parseInput(z.object({ identifier: identifierSchema }), { identifier: rawIdentifier });
  await consume(resetRequestLimiter, req.ip ?? 'unknown');

  const user = await prisma.user.findUnique({
    where: identifier.includes('@') ? { email: identifier } : { username: identifier },
  });
  // A disabled account gets no link.
  if (!user || user.disabledAt) return;

  const { token, tokenHash } = generateToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET' } }),
    prisma.authToken.create({
      data: {
        tokenHash,
        type: 'PASSWORD_RESET',
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  const url = new URL('/reset-password', env.APP_URL);
  url.searchParams.set('token', token);
  sendInBackground(passwordResetMail(user.email, url.toString(), RESET_TTL_MINUTES));
}

/**
 * Sets a new password from a reset link and closes every session.
 * @param {string} token Token from the link.
 * @param {string} password New password.
 * @returns {Promise<void>}
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const authToken = await findValidToken(token, 'PASSWORD_RESET');
  const { user } = authToken;
  parseInput(z.object({ password: strongPasswordSchema([user.username, user.email]) }), { password });

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordPending: false } }),
    prisma.authToken.deleteMany({ where: { userId: user.id, type: { in: ['PASSWORD_RESET', 'ACCOUNT_SETUP'] } } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  sendInBackground(passwordChangedNoticeMail(user.email));
}

/**
 * Chooses the password of a new account from the link sent at its creation: the account can then log in.
 * @param {string} token Token from the link.
 * @param {string} password Password.
 * @returns {Promise<void>}
 */
export async function setUpAccount(token: string, password: string): Promise<void> {
  const authToken = await findValidToken(token, 'ACCOUNT_SETUP');
  const { user } = authToken;
  if (user.disabledAt) throw clientError('INVALID_TOKEN', INVALID_TOKEN_MESSAGE);
  parseInput(z.object({ password: strongPasswordSchema([user.username, user.email]) }), { password });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordPending: false } }),
    prisma.authToken.deleteMany({ where: { userId: user.id, type: { in: ['ACCOUNT_SETUP', 'PASSWORD_RESET'] } } }),
  ]);
}

/**
 * Changes the password of the logged-in user and closes their other sessions.
 * @param {SessionInfo} session Current session.
 * @param {string} currentPassword Current password.
 * @param {string} password New password.
 * @returns {Promise<void>}
 */
export async function changePassword(session: SessionInfo, currentPassword: string, password: string): Promise<void> {
  const user = await verifyCurrentPassword(session, currentPassword);
  parseInput(z.object({ password: strongPasswordSchema([user.username, user.email]) }), { password });

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.authToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET' } }),
  ]);
  await destroyUserSessions(user.id, session.id);
  sendInBackground(passwordChangedNoticeMail(user.email));
}

/**
 * Changes the username of the logged-in user.
 * @param {SessionInfo} session Current session.
 * @param {string} currentPassword Current password.
 * @param {string} rawUsername New username.
 * @returns {Promise<User>} Updated user.
 */
export async function changeUsername(session: SessionInfo, currentPassword: string, rawUsername: string): Promise<User> {
  const user = await verifyCurrentPassword(session, currentPassword);
  const { username } = parseInput(z.object({ username: usernameSchema }), { username: rawUsername });
  if (username === user.username) return user;

  try {
    return await prisma.user.update({ where: { id: user.id }, data: { username } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const message = 'Cet identifiant est déjà utilisé.';
    throw clientError('CONFLICT', message, { fields: { username: message } });
  }
}

/**
 * Starts an email change: stores the pending address and sends a confirmation link to it.
 * @param {SessionInfo} session Current session.
 * @param {string} currentPassword Current password.
 * @param {string} rawEmail New email address.
 * @returns {Promise<User>} User with the pending address.
 */
export async function requestEmailChange(session: SessionInfo, currentPassword: string, rawEmail: string): Promise<User> {
  const user = await verifyCurrentPassword(session, currentPassword);
  const { email } = parseInput(z.object({ email: emailSchema }), { email: rawEmail });

  if (email === user.email) {
    const message = "C'est déjà votre adresse actuelle.";
    throw clientError('BAD_USER_INPUT', message, { fields: { email: message } });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    const message = 'Cette adresse est déjà utilisée.';
    throw clientError('CONFLICT', message, { fields: { email: message } });
  }

  const { token, tokenHash } = generateToken();
  const [, , updated] = await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId: user.id, type: 'EMAIL_CHANGE' } }),
    prisma.authToken.create({
      data: {
        tokenHash,
        type: 'EMAIL_CHANGE',
        userId: user.id,
        email,
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_HOURS * 60 * 60 * 1000),
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { pendingEmail: email } }),
  ]);

  const url = new URL('/confirm-email', env.APP_URL);
  url.searchParams.set('token', token);
  await sendMail(emailChangeMail(email, url.toString(), EMAIL_CHANGE_TTL_HOURS));
  return updated;
}

/**
 * Cancels a pending email change.
 * @param {SessionInfo} session Current session.
 * @returns {Promise<User>} Updated user.
 */
export async function cancelEmailChange(session: SessionInfo): Promise<User> {
  const [, updated] = await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId: session.userId, type: 'EMAIL_CHANGE' } }),
    prisma.user.update({ where: { id: session.userId }, data: { pendingEmail: null } }),
  ]);
  return updated;
}

/**
 * Confirms an email change from the link sent to the new address.
 * @param {string} token Token from the link.
 * @returns {Promise<void>}
 */
export async function confirmEmailChange(token: string): Promise<void> {
  const authToken = await findValidToken(token, 'EMAIL_CHANGE');
  const { user, email } = authToken;
  if (!email || user.pendingEmail !== email) throw clientError('INVALID_TOKEN', INVALID_TOKEN_MESSAGE);

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email, pendingEmail: null } }),
      // Links sent to the previous address are no longer valid.
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw clientError('CONFLICT', 'Cette adresse est déjà utilisée.');
  }
  sendInBackground(emailChangedNoticeMail(user.email, email));
}
