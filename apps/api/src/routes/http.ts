import type { Request, RequestHandler, Response } from 'express';
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
 * Flag of a query parameter: on for « 1 » or « true » only (« ?paid=0 », a missing or repeated one: off).
 * @param {unknown} value Value of `req.query.<name>`.
 * @returns {boolean} The flag.
 */
export function queryFlag(value: unknown): boolean {
  return value === '1' || value === 'true';
}

/** Cache-Control of a file that never changes at its URL (attachments, icons: a new file gets a new id). */
// eslint-disable-next-line no-restricted-syntax -- the constant itself.
export const IMMUTABLE_CACHE = 'private, max-age=31536000, immutable';

/**
 * Whether a file is shown in place rather than downloaded: a file the browser can show, unless ?download=1 asks for it.
 * @param {Request} req Request.
 * @param {boolean} viewable The browser can show the file (an image, a PDF).
 * @returns {boolean} Shown in place.
 */
export function shownInPlace(req: Request, viewable: boolean): boolean {
  // eslint-disable-next-line no-restricted-syntax -- shownInPlace itself.
  return viewable && !queryFlag(req.query.download);
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

/** File a download route produces: its content, with how it is sent. */
type Download = DownloadOptions & {
  /** Content of the file. */
  content: Buffer | string;
};

/**
 * Route sending a file to a signed-in user: 401 without a session, the file produced from the request, or the error of
 * its service (see `sendServiceError`).
 * @param {(req: Request) => Promise<Download>} produce Produces the file and how it is sent.
 * @param {string} context What failed, for the log, as a sentence (« PDF impossible. »).
 * @returns {RequestHandler} Route handler.
 */
export function downloadRoute(produce: (req: Request) => Promise<Download>, context: string): RequestHandler {
  return async (req, res) => {
    if (!(await requireSession(req, res))) return;
    try {
      const { content, ...options } = await produce(req);
      sendDownload(res, content, options);
    } catch (error) {
      sendServiceError(res, error, context);
    }
  };
}
