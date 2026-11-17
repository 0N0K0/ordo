import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Tables shown in the content of the page. */
let tableCount = 0;
const listeners = new Set<() => void>();

/**
 * Subscribes to the number of tables shown.
 * @param {() => void} listener Listener.
 * @returns {() => void} Unsubscribes.
 */
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Changes the number of tables shown.
 * @param {number} delta Tables added (removed: negative).
 * @returns {void}
 */
const count = (delta: number) => {
  tableCount += delta;
  for (const listener of listeners) listener();
};

/** Height a table takes at most next to other content: the content area of the page (the window without its top bar) without the tabs of the views, the bar of search and filters, and a margin. */
export const SHARED_TABLE_HEIGHT = 'calc(100dvh - var(--app-shell-header-height, 0px) - var(--onoko-view-tabs-height, 0px) - var(--onoko-table-toolbar-height, 0px) - 2rem)';

/** Content below a table from which it shares the page (a few pixels: paddings, borders). */
const BELOW_TOLERANCE = 48;

/** Smallest height of a table alone. */
const MINIMUM = 240;

/**
 * Height of the scrolling area of a table (its header sticking to its top): alone on the page, every height left down
 * to the bottom of the window; next to other tables or content, the content area of the page without the tabs, the bar
 * of search and filters and a margin, at most.
 * @returns {readonly [React.RefObject<HTMLDivElement | null>, string | number]} Scrolling area, and its maximum height.
 */
export function useTableHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const tables = useSyncExternalStore(subscribe, () => tableCount);
  const [fill, setFill] = useState<{ height: number; crowded: boolean } | null>(null);
  useLayoutEffect(() => {
    // Only those of the page itself: one in a side panel or a modal does not share its room.
    if (!ref.current?.closest('main')) return;
    count(1);
    return () => count(-1);
  }, []);
  useLayoutEffect(() => {
    /**
     * Measures the room left below the top of the area, and what the page has below it.
     * @returns {void}
     */
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const main = element.closest('main');
      const padding = main ? parseFloat(getComputedStyle(main).paddingBottom) : 16;
      const content = main?.firstElementChild?.getBoundingClientRect();
      const below = content ? Math.max(0, content.bottom - box.bottom) : 0;
      const height = Math.floor(window.innerHeight - (box.top + window.scrollY) - below - padding);
      setFill((current) => {
        const next = { height: Math.max(MINIMUM, height), crowded: below > BELOW_TOLERANCE || height < MINIMUM };
        return current && current.height === next.height && current.crowded === next.crowded ? current : next;
      });
    };
    update();
    window.addEventListener('resize', update);
    // What is above or below may change height (filters, a bar of selection…): the content of the page tells it.
    const observer = new ResizeObserver(update);
    observer.observe(ref.current?.closest('main')?.firstElementChild ?? document.body);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);
  const alone = tables <= 1 && fill !== null && !fill.crowded;
  return [ref, alone ? fill.height : SHARED_TABLE_HEIGHT] as const;
}
