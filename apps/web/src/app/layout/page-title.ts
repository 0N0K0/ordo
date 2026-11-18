import { pageOfPath } from '../pages';

/**
 * Name of the page of a path, for the header.
 * @param {string} pathname Path.
 * @returns {string | null} Name, or null for a path without one (a client, a project, an unknown page).
 */
export function pageTitle(pathname: string): string | null {
  return pageOfPath(pathname)?.title ?? null;
}
