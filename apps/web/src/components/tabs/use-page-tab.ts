import { useUrlTab, type MovedTab, type UrlTabChange } from './use-url-tab';

/** Parameter of the address keeping the tab of a page shown (?tab=…), so that a link or a reload opens it. */
const PAGE_TAB_PARAM = 'tab';

/** Change of the tab of a page: the tab (null: the fallback), with other parameters changed at once (null removes one), `only` dropping the others. */
type PageTabChange = UrlTabChange;

/**
 * Tab of a page (PageTabs), kept in the address (?tab=…): the one asked, else the fallback; the fallback is chosen by
 * leaving the parameter out.
 * @param {readonly T[]} tabs Tabs of the page.
 * @param {T} [fallback] Tab shown when none (or an unknown one) is asked. Optional. Default = the first one.
 * @param {Record<string, MovedTab>} [moved] Former tabs moved elsewhere, redirected. Optional.
 * @returns {[T, PageTabChange, string | null]} Tab shown, its change, and the tab asked as it is in the address (former tabs moved elsewhere).
 */
export function usePageTab<T extends string>(tabs: readonly T[], fallback: T = tabs[0], moved?: Record<string, MovedTab>): [T, PageTabChange, string | null] {
  return useUrlTab(PAGE_TAB_PARAM, tabs, fallback, moved);
}
