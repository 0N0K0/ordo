import { useLocalStorage } from '@mantine/hooks';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const DEFAULT_WIDTH = 280;
/** Below this width the sidebar is hidden entirely. */
export const MIN_SIDEBAR_WIDTH = 200;

/**
 * Maximum sidebar width: 480px, and never more than 40% of the viewport.
 * @returns {number} Width in px.
 */
function maxWidth(): number {
  return Math.min(480, window.innerWidth * 0.4);
}

/**
 * Width the content of an element misses: the most any of its parts is cut (a name ending with "…").
 * @param {HTMLElement} element Element.
 * @returns {number} Width, in pixels (with a little room).
 */
function hiddenWidth(element: HTMLElement): number {
  let missing = 0;
  for (const part of element.querySelectorAll<HTMLElement>('*')) {
    if (part.clientWidth > 0 && part.scrollWidth > part.clientWidth) missing = Math.max(missing, part.scrollWidth - part.clientWidth);
  }
  return missing ? Math.ceil(missing) + 8 : 0;
}

/**
 * Sidebar width and open state, persisted, with a drag handle to resize it. Each window keeps its own: the last
 * change is what a new window starts with.
 * Dragging below the minimum hides the sidebar; dragging back reopens it; a double click on the handle gives it its
 * minimum width, and at its minimum width the width of its content.
 * @returns {object} Width, open state, toggles and the handle pointer and double click handlers.
 */
export function useResizableSidebar() {
  const [width, setWidth] = useLocalStorage({ key: 'ordo.sidebar.width', sync: false, defaultValue: DEFAULT_WIDTH });
  const [opened, setOpened] = useLocalStorage({ key: 'ordo.sidebar.opened', sync: false, defaultValue: true });
  const [resizing, setResizing] = useState(false);
  const frame = useRef(0);

  // Keeps the stored width valid when the window shrinks.
  useEffect(() => {
    const clamp = () => setWidth((current) => Math.min(current, maxWidth()));
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [setWidth]);

  /**
   * Starts resizing from the handle.
   * @param {ReactPointerEvent<HTMLElement>} event Pointer down event on the handle.
   * @returns {void}
   */
  const onResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      setResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const next = moveEvent.clientX;
          if (next < MIN_SIDEBAR_WIDTH) {
            setOpened(false);
          } else {
            setOpened(true);
            setWidth(Math.min(next, maxWidth()));
          }
        });
      };
      const handleUp = () => {
        setResizing(false);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [setOpened, setWidth],
  );

  return {
    width,
    opened,
    resizing,
    toggle: () => setOpened((current) => !current),
    onResizeStart,
    /**
     * Double click on the handle: the sidebar at its minimum width; already there, at the width of its content.
     * @param {ReactMouseEvent<HTMLElement>} event Double click on the handle (inside the sidebar).
     * @returns {void}
     */
    onResizeReset: (event: ReactMouseEvent<HTMLElement>) => {
      const sidebar = event.currentTarget.parentElement;
      if (opened && width <= MIN_SIDEBAR_WIDTH + 1 && sidebar) {
        setWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth(), width + hiddenWidth(sidebar))));
        return;
      }
      setOpened(true);
      setWidth(MIN_SIDEBAR_WIDTH);
    },
  };
}
