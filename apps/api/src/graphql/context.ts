import type { Request, Response } from 'express';
import { requestSession, type SessionInfo } from '../auth/session';
import { unauthenticated } from './errors';

export interface ServerContext {
  req: Request;
  res: Response;
}

export interface Context extends ServerContext {
  /** Current session, or null when not logged in. */
  session: SessionInfo | null;
}

/**
 * Builds the GraphQL context for each request.
 * @param {ServerContext} serverContext Express request and response provided by Yoga.
 * @returns {Promise<Context>} Context holding the current session.
 */
export async function createContext({ req, res }: ServerContext): Promise<Context> {
  return { req, res, session: await requestSession(req, res) };
}

/**
 * Returns the current session or throws UNAUTHENTICATED.
 * @param {Context} ctx GraphQL context.
 * @returns {SessionInfo} Current session.
 */
export function requireSession(ctx: Context): SessionInfo {
  if (!ctx.session) throw unauthenticated();
  return ctx.session;
}
