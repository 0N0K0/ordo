import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** Changes of URL parameters: a value sets one, null (or undefined) removes it. */
type ParamChanges = Record<string, string | null | undefined>;

/**
 * Changes some URL parameters, keeping the others (or none), replacing the history entry (or adding one).
 * @returns {(changes: ParamChanges, options?: { only?: boolean, push?: boolean }) => void} Setter: `only` drops the other parameters, `push` adds a history entry.
 */
export function useSetParams() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (changes: ParamChanges, { only = false, push = false }: { only?: boolean; push?: boolean } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(only ? undefined : current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: !push },
      ),
    [setParams],
  );
}

/**
 * A URL parameter and its setter (null removes it), the others kept.
 * @param {string} key Parameter.
 * @returns {[string | null, (value: string | null) => void]} Value and setter.
 */
export function useSearchParam(key: string): [string | null, (value: string | null) => void] {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  return [params.get(key), (value) => setParams({ [key]: value })];
}
