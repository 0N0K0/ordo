import type { Request, Response } from 'express';
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
