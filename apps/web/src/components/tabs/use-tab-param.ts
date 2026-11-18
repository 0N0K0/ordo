import { useUrlTab } from './use-url-tab';

/**
 * Tab chosen in the URL (?param=id), the first one when none or an unknown one is given (left out of the address).
 * @param {string} param URL parameter.
 * @param {T[]} items Tabs.
 * @returns {[T | undefined, (id: string | null) => void]} Selected tab, and its selection (null: back to the first one).
 */
export function useTabParam<T extends { id: string }>(param: string, items: T[] | undefined): [T | undefined, (id: string | null) => void] {
  const ids = (items ?? []).map((item) => item.id);
  const [id, select] = useUrlTab(param, ids, ids[0] ?? '');
  return [items?.find((item) => item.id === id), (next) => select(next)];
}
