import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';

/**
 * Checks the request has a session, answering 401 when it has none.
 * @param {Request} req Request.
 * @param {Response} res Response, answered when there is no session.
 * @returns {Promise<boolean>} Whether the route can go on.
 */
export async function requireSession(req: Request, res: Response): Promise<boolean> {
  if (await getSession(req, res)) return true;
  res.sendStatus(401);
  return false;
}

/**
 * Text of a query parameter: empty when it is missing or repeated.
 * @param {unknown} value Value of `req.query.<name>`.
 * @returns {string} The text.
 */
export function queryText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * File name without the characters file systems refuse (each replaced by a dash).
 * @param {string} name Name to clean.
 * @returns {string} The cleaned name.
 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

/** How a file is sent by `sendDownload`. */
type DownloadOptions = {
  /** Content-Type. */
  type: string;
  /** Name of the file, in Content-Disposition; no Content-Disposition without it. */
  filename?: string;
  /** Shown in place rather than downloaded. */
  inline?: boolean;
  /** Cache-Control; `private, no-store` by default. */
  cache?: string;
  /** Content-Security-Policy, if any. */
  securityPolicy?: string;
};

/**
 * Sends a file, never sniffed by the browser: its type, its disposition and name, its cache policy and security policy.
 * @param {Response} res Response.
 * @param {Buffer | string} content Content of the file.
 * @param {DownloadOptions} options Type, name, disposition, cache and security policy.
 * @returns {void}
 */
export function sendDownload(res: Response, content: Buffer | string, options: DownloadOptions): void {
  const { type, filename, inline = false, cache = 'private, no-store', securityPolicy } = options;
  res.set({
    'Content-Type': type,
    ...(filename === undefined ? {} : { 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}` }),
    'Cache-Control': cache,
    ...(securityPolicy === undefined ? {} : { 'Content-Security-Policy': securityPolicy }),
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(content);
}

/** HTTP status of each error code of the services. */
const STATUS_OF: Record<string, number> = {
  BAD_USER_INPUT: 400,
  INVALID_CREDENTIALS: 400,
  INVALID_TOKEN: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Answers a failed route: an error of a service with its message as JSON (`{ error }`), or as plain text when a page is
 * asked (a link, a preview frame), and the status of its code; any other error logged and answered 500 without detail
 * (the client shows its own message).
 * @param {Response} res Response.
 * @param {unknown} error Error caught.
 * @param {string} context What failed, for the log.
 * @returns {void}
 */
export function sendServiceError(res: Response, error: unknown, context: string): void {
  const status = error instanceof GraphQLError ? STATUS_OF[String(error.extensions.code)] : undefined;
  if (error instanceof GraphQLError && status) {
    res.status(status);
    if (res.req.accepts(['json', 'html']) === 'html') res.type('text/plain').send(error.message);
    else res.json({ error: error.message });
    return;
  }
  console.error(context, error);
  res.sendStatus(500);
}
