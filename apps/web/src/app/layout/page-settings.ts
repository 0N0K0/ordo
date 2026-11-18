import { useSearchParam } from '../../lib/search-params';
import { createContext, useContext } from 'react';
import { SETTINGS_TAB_PARAM } from '../../components/tabs/use-settings-tab';

/** Settings of the page shown, in the sidebar on the right: their title, and where they are drawn. */
interface PageSettingsState {
  /** Title of the settings of the page, or null on a page without any. */
  title: string | null;
  setTitle: (title: string | null) => void;
  /** Body of the sidebar, where the page draws its settings. */
  container: HTMLElement | null;
}

export const PageSettingsContext = createContext<PageSettingsState>({ title: null, setTitle: () => undefined, container: null });

/** Parameter of the address opening the settings of a page (closed without it). */
export const SETTINGS_PARAM = 'settings';

/**
 * Address of a page with its settings open, on a tab (optional): `/mail?settings=1`, `/accounting?settings=1&section=company`.
 * @param {string} path Page.
 * @param {string} [section] Tab of the settings. Optional. Default = the first one.
 * @returns {string} Path.
 */
export const settingsPath = (path: string, section?: string): string => `${path}?${SETTINGS_PARAM}=1${section ? `&${SETTINGS_TAB_PARAM}=${section}` : ''}`;

/**
 * Whether the settings of the page are open (kept in the address: closed by default, a link may open them), and
 * the way to open or close them.
 * @returns {{ opened: boolean, setOpened: (opened: boolean) => void }} State.
 */
export function useSettingsOpened(): { opened: boolean; setOpened: (opened: boolean) => void } {
  const [opened, setOpened] = useSearchParam(SETTINGS_PARAM);
  return { opened: opened === '1', setOpened: (open) => setOpened(open ? '1' : null) };
}

/**
 * Settings of the page shown.
 * @returns {PageSettingsState} State.
 */
export function usePageSettings(): PageSettingsState {
  return useContext(PageSettingsContext);
}
