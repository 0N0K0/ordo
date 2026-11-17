import { useSearchParam } from '../../lib/search-params';

/**
 * Tab chosen in the URL (?param=id), the first one when none or an unknown one is given.
 * @param {string} param URL parameter.
 * @param {T[]} items Tabs.
 * @returns {[T | undefined, (id: string | null) => void]} Selected tab, and its selection (null: back to the first one).
 */
export function useTabParam<T extends { id: string }>(param: string, items: T[] | undefined): [T | undefined, (id: string | null) => void] {
  const [id, select] = useSearchParam(param);
  return [items?.find((item) => item.id === id) ?? items?.[0], select];
}
