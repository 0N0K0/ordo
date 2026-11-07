import { pinWorkspace } from '../../lib/graphql-client';

/** Cookie naming the workspace shown (read by the API, links and downloads included). */
const COOKIE = 'ordo_workspace';
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ordo-workspace');

/**
 * Remembers the workspace shown (cookie, for a year) and pins the requests of this tab to it.
 * @param {string} id Workspace.
 * @returns {void}
 */
export function rememberWorkspace(id: string): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
  pinWorkspace(id);
}

/**
 * Opens another workspace: the app reloads on its home page, or on a page of that workspace (the pages of a
 * workspace mean nothing in another one); the other tabs reload on their home page.
 * @param {string} id Workspace.
 * @param {string} [path] Page opened. Optional. Default = home page.
 * @returns {void}
 */
export function switchWorkspace(id: string, path = '/'): void {
  rememberWorkspace(id);
  channel?.postMessage(id);
  window.location.assign(path);
}

// Another tab switched: this one follows.
channel?.addEventListener('message', () => window.location.assign('/'));
