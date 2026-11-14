import { useState } from 'react';

/**
 * Cases unfolded, by index: those added unfolded, the others folded (when there are several).
 * @returns {{ isOpen: (index: number) => boolean, toggle: (index: number) => void, open: (index: number) => void, removed: (index: number) => void }} State.
 */
export function useCaseFolds() {
  const [unfolded, setUnfolded] = useState<ReadonlySet<number>>(new Set());
  return {
    isOpen: (index: number) => unfolded.has(index),
    toggle: (index: number) =>
      setUnfolded((current) => {
        const next = new Set(current);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      }),
    open: (index: number) => setUnfolded((current) => new Set(current).add(index)),
    // The cases after a removed one move up.
    removed: (index: number) => setUnfolded((current) => new Set([...current].filter((item) => item !== index).map((item) => (item > index ? item - 1 : item)))),
  };
}
