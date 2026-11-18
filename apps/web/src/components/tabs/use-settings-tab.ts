import { useSearchParam } from '../../lib/search-params';
import { knownTab } from './use-page-tab';

/** Parameter of the address keeping the tab of the settings shown (?section=…), so that a link or a reload opens it. */
export const SETTINGS_TAB_PARAM = 'section';

/**
 * Tab of the settings of a page (SettingsTabs), kept in the address: the one asked, else the fallback.
 * @param {readonly T[]} tabs Tabs of the settings.
 * @param {T} [fallback] Tab shown when none (or an unknown one) is asked. Optional. Default = the first one.
 * @returns {[T, (tab: T) => void]} Tab shown, and its change.
 */
export function useSettingsTab<T extends string>(tabs: readonly T[], fallback: T = tabs[0]): [T, (tab: T) => void] {
  const [asked, setAsked] = useSearchParam(SETTINGS_TAB_PARAM);
  return [knownTab(asked, tabs, fallback), setAsked];
}
