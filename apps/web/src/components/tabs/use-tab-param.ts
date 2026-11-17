import { useSearchParams } from 'react-router';

/**
 * Tab chosen in the URL (?param=id), the first one when none or an unknown one is given.
 * @param {string} param URL parameter.
 * @param {T[]} items Tabs.
 * @returns {[T | undefined, (id: string | null) => void]} Selected tab, and its selection (null: back to the first one).
 */
export function useTabParam<T extends { id: string }>(param: string, items: T[] | undefined): [T | undefined, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const current = items?.find((item) => item.id === params.get(param)) ?? items?.[0];

  /**
   * Shows a tab.
   * @param {string | null} id Tab id, or null for the first one.
   * @returns {void}
   */
  const select = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set(param, id);
        else next.delete(param);
        return next;
      },
      { replace: true },
    );
  return [current, select];
}
