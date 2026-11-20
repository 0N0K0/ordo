import { useEffect, useState, useSyncExternalStore } from 'react';

/** A value a component holds, read and followed by what it opened elsewhere (a side panel rendered once). */
export interface LiveSource<T> {
  /** The value now. */
  get: () => T;
  /** Calls `onChange` each time the value changes; gives the unsubscription. */
  subscribe: (onChange: () => void) => () => void;
}

/**
 * Source of a value and its change, told to those following it.
 * @param {T} initial Value at first.
 * @returns {LiveSource<T> & { set: (value: T) => void }} Source, and its change.
 */
function liveStore<T>(initial: T): LiveSource<T> & { set: (value: T) => void } {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    set: (value) => {
      if (value === current) return;
      current = value;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * Source of a value of the component, the same object on every render, told each time the value changes: given to
 * the content of a side panel opened on a copy (a panel renders once), so it follows the value (the items of a
 * settings list, refreshed).
 * @param {T} value Value now.
 * @returns {LiveSource<T>} Source.
 */
export function useLiveSource<T>(value: T): LiveSource<T> {
  const [store] = useState(() => liveStore(value));
  useEffect(() => store.set(value), [store, value]);
  return store;
}

/**
 * Value of a source, followed as it changes; none without a source.
 * @param {LiveSource<T>} [source] Source. Optional.
 * @returns {T | undefined} Value now.
 */
export function useLiveValue<T>(source?: LiveSource<T>): T | undefined {
  return useSyncExternalStore(
    (onChange) => source?.subscribe(onChange) ?? (() => undefined),
    () => source?.get(),
  );
}
