import { useLayoutEffect, useRef, useState } from 'react';

/** Rows measured at most: enough to see the content of a column, quick on long lists. */
const MEASURED_ROWS = 400;

/**
 * Natural width of a column of a table: its widest cell (header included), its content laid out on one line, with
 * the padding and border of the cell. Rows spanning several columns (groups) are left out.
 * @param {HTMLTableElement} table Table.
 * @param {number} index Index of the column among the cells of a row.
 * @returns {number} Width, in pixels.
 */
export function contentWidth(table: HTMLTableElement, index: number): number {
  // Off screen, nothing wraps: what each cell would take on one line.
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;white-space:nowrap;';
  document.body.appendChild(host);
  let widest = 0;
  for (const row of [...table.rows].slice(0, MEASURED_ROWS)) {
    const cells = [...row.cells];
    if (cells.length <= index || cells.some((cell) => cell.colSpan > 1)) continue;
    const cell = cells[index];
    const style = getComputedStyle(cell);
    const clone = document.createElement('div');
    clone.className = cell.className;
    clone.style.cssText = `display:inline-block;width:max-content;font:${style.font};padding:0;border:0;`;
    // The title is indented with its depth (padding of the cell, measured below).
    for (const child of cell.childNodes) clone.appendChild(child.cloneNode(true));
    host.appendChild(clone);
    const frame = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    widest = Math.max(widest, clone.getBoundingClientRect().width + frame);
    clone.remove();
  }
  host.remove();
  return Math.ceil(widest);
}

/**
 * Height an element can take so that the page fits the window: down to its bottom, less what the page has below the
 * element (paddings, borders, other content) and its bottom padding; at least a minimum. Follows the size of the
 * window and of the page.
 * @param {number} [minimum] Smallest height, in pixels. Optional. Default = 320.
 * @returns {readonly [React.RefObject<HTMLDivElement | null>, number | undefined]} Element to measure, and its height.
 */
export function useFillHeight(minimum = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    /**
     * Measures the room left below the top of the element.
     * @returns {void}
     */
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const main = element.closest('main');
      const padding = main ? parseFloat(getComputedStyle(main).paddingBottom) : 16;
      // What the page has below the element: measured on its content, not on the main area (as tall as the window
      // at least).
      const content = main?.firstElementChild?.getBoundingClientRect();
      const below = content ? Math.max(0, content.bottom - box.bottom) : 0;
      const top = box.top + window.scrollY;
      setHeight(Math.max(minimum, Math.floor(window.innerHeight - top - below - padding)));
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
  }, [minimum]);
  return [ref, height] as const;
}
