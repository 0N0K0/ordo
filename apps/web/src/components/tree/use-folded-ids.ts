import { useMemo, useState } from 'react';
import { toggledIn } from '../../lib/sets';

/** Ids folded (or, for what starts folded, unfolded) and how to change them. */
export interface FoldedIds {
  /** Ids in the state. */
  ids: ReadonlySet<string>;
  /** Switches an id. */
  toggle: (id: string) => void;
  /** Puts ids in the state (`true`) or takes them out (`false`). */
  set: (ids: readonly string[], on: boolean) => void;
}

/**
 * Stored ids of a key: a list of texts (any other shape, an older version or a value edited by hand, is dropped).
 * @param {string | null} key Key in this browser; none: nothing stored.
 * @returns {ReadonlySet<string>} Ids.
 */
function storedIds(key: string | null): ReadonlySet<string> {
  if (!key) return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * Folded rows of a tree, a list or a menu, remembered in this browser (each window keeps its own; the last change is what
 * a new window starts with).
 * @param {string | null} key Key in this browser (« ordo.mail.collapsed.<account> »); none: not remembered.
 * @returns {FoldedIds} Ids and their changes.
 */
export function useFoldedIds(key: string | null): FoldedIds {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => storedIds(key));
  const changes = useMemo(() => {
    /**
     * Changes the ids and remembers them (nothing when they stay the same).
     * @param {(current: ReadonlySet<string>) => ReadonlySet<string>} update New ids from the current ones.
     * @returns {void}
     */
    const change = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
      setIds((current) => {
        const next = update(current);
        if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify([...next]));
          } catch {
            // Not remembered: it stays as it is until the page is left.
          }
        }
        return next;
      });
    return {
      toggle: (id: string) => change((current) => toggledIn(current, id)),
      set: (list: readonly string[], on: boolean) =>
        change((current) => {
          const next = new Set(current);
          for (const id of list) {
            if (on) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
    };
  }, [key]);
  return { ids, ...changes };
}
