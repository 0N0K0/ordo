import { useLayoutEffect, useRef } from 'react';

/** Elements publishing their height under each name (the last one mounted wins). */
const publishers = new Map<string, HTMLElement[]>();

/**
 * Writes the height of the last element published under a name in its CSS variable (removed without any).
 * @param {string} name CSS variable (« --onoko-view-tabs-height »).
 * @returns {void}
 */
function write(name: string): void {
  const element = publishers.get(name)?.at(-1);
  if (element) document.documentElement.style.setProperty(name, `${Math.ceil(element.getBoundingClientRect().height)}px`);
  else document.documentElement.style.removeProperty(name);
}

/**
 * Publishes the height of an element in a CSS variable of the page, kept up to date (what other elements size
 * themselves from: the tabs of the views, the bar of search and filters above a table).
 * @template T
 * @param {string} name CSS variable (« --onoko-view-tabs-height »).
 * @returns {React.RefObject<T | null>} Element to measure.
 */
export function usePublishedHeight<T extends HTMLElement>(name: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    publishers.set(name, [...(publishers.get(name) ?? []), element]);
    write(name);
    const observer = new ResizeObserver(() => write(name));
    observer.observe(element);
    return () => {
      observer.disconnect();
      publishers.set(
        name,
        (publishers.get(name) ?? []).filter((other) => other !== element),
      );
      write(name);
    };
  }, [name]);
  return ref;
}
