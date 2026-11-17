import { pinWorkspace } from '../../lib/graphql-client';

/** Cookie naming the workspace shown (read by the API, links and downloads included). */
const COOKIE = 'ordo_workspace';
/** Workspace of this window (kept through reloads; a duplicated tab starts with it). */
const WINDOW_KEY = 'ordo.workspace';

/**
 * Workspace this window shows, if it already chose one.
 * @returns {string | null} Workspace.
 */
function windowWorkspace(): string | null {
  try {
    return sessionStorage.getItem(WINDOW_KEY);
  } catch {
    return null;
  }
}

/**
 * Points the cookie at a workspace (a new window opens it; links and downloads read it).
 * @param {string} id Workspace.
 * @returns {void}
 */
function setCookie(id: string): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Remembers the workspace this window shows and pins its requests to it; the cookie follows (for links,
 * downloads and new windows).
 * @param {string} id Workspace.
 * @returns {void}
 */
export function rememberWorkspace(id: string): void {
  try {
    sessionStorage.setItem(WINDOW_KEY, id);
  } catch {
    // Storage unavailable: the cookie still remembers it.
  }
  setCookie(id);
  pinWorkspace(id);
}

/** Pages of one item: in another workspace, the page of their list (a project: the home page). */
const ITEM_PAGES: [RegExp, string][] = [
  [/^\/projects\/[^/]+/, '/'],
  [/^\/clients\/[^/]+/, '/'],
  [/^\/accounting\/(imported\/)?[^/]+/, '/accounting'],
  [/^\/shopping\/[^/]+/, '/shopping'],
];

/** Parameters of a page that still mean something in another workspace (others name its items or views). */
const KEPT_PARAMS = ['tab'];

/**
 * The page of this window, as it reads in another workspace: the same page, but the page of a list for the page of
 * one of its items (home for a project), without what names items or views of this workspace.
 * @returns {string} Path.
 */
function samePageElsewhere(): string {
  const { pathname, search } = window.location;
  const list = ITEM_PAGES.find(([pattern]) => pattern.test(pathname));
  if (list) return list[1];
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams(KEPT_PARAMS.flatMap((key) => (params.has(key) ? [[key, params.get(key)!]] : [])));
  return `${pathname}${kept.size ? `?${kept}` : ''}`;
}

/**
 * Opens another workspace in this window only: it reloads on the same page (the page of a list for one of its items,
 * home for a project), or on a page given. The other windows stay where they are.
 * @param {string} id Workspace.
 * @param {string} [path] Page opened. Optional. Default = the same page.
 * @returns {void}
 */
export function switchWorkspace(id: string, path = samePageElsewhere()): void {
  rememberWorkspace(id);
  window.location.assign(path);
}

// This window asks for its own workspace from its first request (the cookie may name another window's one).
const initial = windowWorkspace();
if (initial) pinWorkspace(initial);

/**
 * Points the cookie back at the workspace of this window when it gets the focus: the links and downloads
 * opened from it read the cookie.
 * @returns {void}
 */
function reclaimCookie(): void {
  const id = windowWorkspace();
  if (id && document.visibilityState === 'visible') setCookie(id);
}

window.addEventListener('focus', reclaimCookie);
document.addEventListener('visibilitychange', reclaimCookie);
