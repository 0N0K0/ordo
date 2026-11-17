import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Room an element has down to the bottom of the window. */
export interface RoomBelow {
  /** Height it can take so that the page fits the window (what the page has below it and its bottom padding left out). */
  height: number;
  /** Height of what the page has below it. */
  below: number;
}

/**
 * Room left below the top of an element so that the page fits the window: down to its bottom, less what the page has
 * below the element (paddings, borders, other content) and its bottom padding.
 * @param {HTMLElement} element Element.
 * @returns {RoomBelow} Room.
 */
export function roomBelow(element: HTMLElement): RoomBelow {
  const box = element.getBoundingClientRect();
  const main = element.closest('main');
  const padding = main ? parseFloat(getComputedStyle(main).paddingBottom) : 16;
  // What the page has below the element: measured on its content, not on the main area (as tall as the window at least).
  const content = main?.firstElementChild?.getBoundingClientRect();
  const below = content ? Math.max(0, content.bottom - box.bottom) : 0;
  return { height: Math.floor(window.innerHeight - (box.top + window.scrollY) - below - padding), below };
}

/**
 * Measures the room below an element, again when the window or the content of the page change size (filters, a bar of
 * selection…).
 * @param {RefObject<HTMLElement | null>} ref Element measured.
 * @param {(room: RoomBelow) => void} onMeasure Receives each measure.
 * @returns {void}
 */
export function useRoomBelow(ref: RefObject<HTMLElement | null>, onMeasure: (room: RoomBelow) => void): void {
  const measure = useRef(onMeasure);
  useLayoutEffect(() => {
    measure.current = onMeasure;
  });
  useLayoutEffect(() => {
    /**
     * Measures the element, when shown.
     * @returns {void}
     */
    const update = () => {
      if (ref.current) measure.current(roomBelow(ref.current));
    };
    update();
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(ref.current?.closest('main')?.firstElementChild ?? document.body);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [ref]);
}

/**
 * Height an element can take so that the page fits the window, at least a minimum; follows the size of the window and
 * of the page.
 * @param {number} [minimum] Smallest height, in pixels. Optional. Default = 320.
 * @returns {readonly [React.RefObject<HTMLDivElement | null>, number | undefined]} Element to measure, and its height.
 */
export function useFillHeight(minimum = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useRoomBelow(ref, (room) => setHeight(Math.max(minimum, room.height)));
  return [ref, height] as const;
}
