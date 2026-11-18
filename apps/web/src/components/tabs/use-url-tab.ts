import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useSetParams } from '../../lib/search-params';

/** Change of a tab kept in the address: the tab (null: the fallback), with other parameters changed at once (null removes one), `only` dropping the others. */
export type UrlTabChange = (tab: string | null, changes?: Record<string, string | null | undefined>, options?: { only?: boolean }) => void;

/** Former tab moved elsewhere: the parameters set instead of it (the tab removed), `only` dropping the others. */
export interface MovedTab {
  changes: Record<string, string | null>;
  only?: boolean;
}

/**
 * Tab shown for the one asked: it when known, else the fallback (an unknown one never shows an empty page).
 * @param {string | null} asked Tab asked (in the address). Optional.
 * @param {readonly T[]} tabs Tabs.
 * @param {T} fallback Tab shown when none (or an unknown one) is asked.
 * @returns {T} Tab shown.
 */
function knownTab<T extends string>(asked: string | null, tabs: readonly T[], fallback: T): T {
  return asked !== null && (tabs as readonly string[]).includes(asked) ? (asked as T) : fallback;
}

/**
 * Tab kept in the address (?param=…), so that a link or a reload opens it: the one asked when known, else the
 * fallback; the fallback is chosen by leaving the parameter out. Former tabs moved elsewhere are redirected.
 * @param {string} param Parameter of the address.
 * @param {readonly T[]} tabs Tabs.
 * @param {T} [fallback] Tab shown when none (or an unknown one) is asked. Optional. Default = the first one.
 * @param {Record<string, MovedTab>} [moved] Former tabs, by name, and where they went. Optional.
 * @returns {[T, UrlTabChange, string | null]} Tab shown, its change, and the tab asked as it is in the address.
 */
export function useUrlTab<T extends string>(param: string, tabs: readonly T[], fallback: T = tabs[0], moved?: Record<string, MovedTab>): [T, UrlTabChange, string | null] {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const asked = params.get(param);
  const redirect = asked !== null ? moved?.[asked] : undefined;
  useEffect(() => {
    if (redirect) setParams({ ...redirect.changes, [param]: null }, { only: redirect.only });
  }, [redirect, param, setParams]);
  return [knownTab(asked, tabs, fallback), (tab, changes, options) => setParams({ ...changes, [param]: tab && tab !== fallback ? tab : null }, options), asked];
}
