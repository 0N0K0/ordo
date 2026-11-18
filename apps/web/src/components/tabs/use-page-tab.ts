import { useSearchParams } from 'react-router';
import { useSetParams } from '../../lib/search-params';

/** Parameter of the address keeping the tab of a page shown (?tab=…), so that a link or a reload opens it. */
export const PAGE_TAB_PARAM = 'tab';

/**
 * Tab shown for the one asked: it when known, else the fallback (an unknown one never shows an empty page).
 * @param {string | null} asked Tab asked (in the address). Optional.
 * @param {readonly T[]} tabs Tabs.
 * @param {T} fallback Tab shown when none (or an unknown one) is asked.
 * @returns {T} Tab shown.
 */
export function knownTab<T extends string>(asked: string | null, tabs: readonly T[], fallback: T): T {
  return asked !== null && (tabs as readonly string[]).includes(asked) ? (asked as T) : fallback;
}

/** Change of the tab of a page: the tab (null: the fallback), with other parameters changed at once (null removes one), `only` dropping the others. */
export type PageTabChange = (tab: string | null, changes?: Record<string, string | null | undefined>, options?: { only?: boolean }) => void;

/**
 * Tab of a page (PageTabs), kept in the address (?tab=…): the one asked, else the fallback; the fallback is chosen by
 * leaving the parameter out.
 * @param {readonly T[]} tabs Tabs of the page.
 * @param {T} [fallback] Tab shown when none (or an unknown one) is asked. Optional. Default = the first one.
 * @returns {[T, PageTabChange, string | null]} Tab shown, its change, and the tab asked as it is in the address (former tabs moved elsewhere).
 */
export function usePageTab<T extends string>(tabs: readonly T[], fallback: T = tabs[0]): [T, PageTabChange, string | null] {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const asked = params.get(PAGE_TAB_PARAM);
  return [knownTab(asked, tabs, fallback), (tab, changes, options) => setParams({ ...changes, [PAGE_TAB_PARAM]: tab && tab !== fallback ? tab : null }, options), asked];
}
