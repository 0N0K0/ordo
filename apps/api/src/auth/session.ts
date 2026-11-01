import { parseCookie } from 'cookie';
import type { Request, Response } from 'express';
import { prisma } from '../db';
import { isProd } from '../env';
import { generateToken, hashToken } from './crypto';

export const SESSION_COOKIE = 'ordo_session';

const DAY = 24 * 60 * 60 * 1000;
/** Idle timeout: the session expires after this long without activity. */
const SESSION_TTL = 14 * DAY;
/** Sliding expiry is persisted at most once per interval to limit writes. */
const TOUCH_INTERVAL = DAY;

export interface SessionInfo {
  id: string;
  userId: string;
}

/**
 * Writes the session cookie.
 * @param {Response} res Express response.
 * @param {string} token Session token.
 * @param {Date} expires Cookie expiry date.
 * @returns {void}
 */
function setSessionCookie(res: Response, token: string, expires: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: '/',
    expires,
  });
}

/**
 * Opens a new session and sets its cookie.
 * @param {Request} req Express request (for the user agent).
 * @param {Response} res Express response.
 * @param {string} userId Authenticated user id.
 * @returns {Promise<SessionInfo>} Created session.
 */
export async function createSession(req: Request, res: Response, userId: string): Promise<SessionInfo> {
  const { token, tokenHash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL);
  const session = await prisma.session.create({
    data: { tokenHash, userId, expiresAt, userAgent: req.get('user-agent')?.slice(0, 512) },
    select: { id: true, userId: true },
  });
  setSessionCookie(res, token, expiresAt);
  return session;
}

/**
 * Resolves the session from the request cookie and extends it when active.
 * @param {Request} req Express request.
 * @param {Response} res Express response (to refresh the cookie).
 * @returns {Promise<SessionInfo | null>} Valid session, or null.
 */
export async function getSession(req: Request, res: Response): Promise<SessionInfo | null> {
  const token = parseCookie(req.headers.cookie ?? '')[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL) {
    const expiresAt = new Date(now + SESSION_TTL);
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now), expiresAt },
    });
    setSessionCookie(res, token, expiresAt);
  }

  return { id: session.id, userId: session.userId };
}

/**
 * Closes the given session and clears its cookie.
 * @param {Response} res Express response.
 * @param {string} sessionId Session to close.
 * @returns {Promise<void>}
 */
export async function destroySession(res: Response, sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/**
 * Closes every session of a user, optionally keeping one.
 * @param {string} userId User whose sessions are closed.
 * @param {string} [exceptSessionId] Session to keep open. Optional.
 * @returns {Promise<void>}
 */
export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
  });
}

/**
 * Removes expired sessions.
 * @returns {Promise<void>}
 */
export async function purgeExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
