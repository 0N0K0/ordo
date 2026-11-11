import { createContext, useContext } from 'react';
import { useSearchParams } from 'react-router';

/** Settings of the page shown, in the sidebar on the right: their title, and where they are drawn. */
export interface PageSettingsState {
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
 * Whether the settings of the page are open (kept in the address: closed by default, a link may open them), and
 * the way to open or close them.
 * @returns {{ opened: boolean, setOpened: (opened: boolean) => void }} State.
 */
export function useSettingsOpened(): { opened: boolean; setOpened: (opened: boolean) => void } {
  const [params, setParams] = useSearchParams();
  return {
    opened: params.get(SETTINGS_PARAM) === '1',
    setOpened: (opened) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (opened) next.set(SETTINGS_PARAM, '1');
          else next.delete(SETTINGS_PARAM);
          return next;
        },
        { replace: true },
      ),
  };
}

/**
 * Settings of the page shown.
 * @returns {PageSettingsState} State.
 */
export function usePageSettings(): PageSettingsState {
  return useContext(PageSettingsContext);
}
