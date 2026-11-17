import { useState } from 'react';

/**
 * Cases unfolded, by index: those added unfolded, the others folded (when there are several).
 * @returns {{ isOpen: (index: number) => boolean, toggle: (index: number) => void, open: (index: number) => void, removed: (index: number) => void, moved: (from: number, to: number) => void }} State.
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
    // A case moved keeps its fold, those between shift by one.
    moved: (from: number, to: number) =>
      setUnfolded(
        (current) =>
          new Set(
            [...current].map((item) => {
              if (item === from) return to;
              if (from < to && item > from && item <= to) return item - 1;
              if (to < from && item >= to && item < from) return item + 1;
              return item;
            }),
          ),
      ),
  };
}

/**
 * Keys of cases with as many as there are cases: the extra ones dropped, new ones (from a number never used) for those
 * added.
 * @param {{ keys: string[], next: number }} state Keys, and the next number.
 * @param {number} count Number of cases.
 * @returns {{ keys: string[], next: number }} Keys.
 */
function sized(state: { keys: string[]; next: number }, count: number): { keys: string[]; next: number } {
  if (state.keys.length >= count) return { keys: state.keys.slice(0, count), next: state.next };
  const added = Array.from({ length: count - state.keys.length }, (_, index) => `case-${state.next + index}`);
  return { keys: [...state.keys, ...added], next: state.next + added.length };
}

/**
 * Keys of the cases, kept with them when they are moved or removed (to drag them): as many as the cases, new ones for
 * those added.
 * @param {number} count Number of cases.
 * @returns {{ list: string[], moved: (from: number, to: number) => void, removed: (index: number) => void }} Keys.
 */
export function useCaseKeys(count: number) {
  const [state, setState] = useState(() => sized({ keys: [], next: 0 }, count));
  let current = state;
  // Cases added or dropped from outside (a mode changed): the keys follow, at once.
  if (state.keys.length !== count) {
    current = sized(state, count);
    setState(current);
  }
  return {
    list: current.keys,
    moved: (from: number, to: number) =>
      setState((value) => {
        const keys = [...value.keys];
        keys.splice(to, 0, ...keys.splice(from, 1));
        return { ...value, keys };
      }),
    removed: (index: number) => setState((value) => ({ ...value, keys: value.keys.filter((_, other) => other !== index) })),
  };
}
