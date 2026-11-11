import { useLocalStorage } from '@mantine/hooks';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Narrowest the settings sidebar is: dragged below, it closes; a double click on its handle brings it back here. */
export const MIN_ASIDE_WIDTH = 480;
const DEFAULT_WIDTH = 640;

/**
 * Widest the settings sidebar may be: 1280px, and never more than 90% of the window (it lies over the page).
 * @returns {number} Width in px.
 */
function maxWidth(): number {
  return Math.max(MIN_ASIDE_WIDTH, Math.min(1280, window.innerWidth * 0.9));
}

/**
 * Width of the settings sidebar, kept (each window its own), with a handle on its left edge to resize it, like the
 * navigation sidebar: dragging below the minimum closes it, dragging back reopens it; a double click on the handle
 * gives it its minimum width.
 * @param {(opened: boolean) => void} setOpened Opens or closes the sidebar.
 * @returns {object} Width shown, resizing state, and the handle pointer and double click handlers.
 */
export function useResizableAside(setOpened: (opened: boolean) => void) {
  const [width, setWidth] = useLocalStorage({ key: 'ordo.settings.width', sync: false, defaultValue: DEFAULT_WIDTH });
  const [resizing, setResizing] = useState(false);
  const [limit, setLimit] = useState(maxWidth);
  const frame = useRef(0);
  const closed = useRef(false);

  useEffect(() => {
    const update = () => setLimit(maxWidth());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const chosen = Number.isFinite(width) ? width : DEFAULT_WIDTH;
  const shown = Math.round(Math.max(MIN_ASIDE_WIDTH, Math.min(chosen, limit)));

  /**
   * Starts resizing from the handle: the width is the distance from the pointer to the right of the window.
   * @param {ReactPointerEvent<HTMLElement>} event Pointer down event on the handle.
   * @returns {void}
   */
  const onResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      setResizing(true);
      closed.current = false;
      const handleMove = (moveEvent: PointerEvent) => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const next = window.innerWidth - moveEvent.clientX;
          // Opened or closed only when crossing the minimum: not on every move.
          if (next < MIN_ASIDE_WIDTH) {
            if (!closed.current) setOpened(false);
            closed.current = true;
          } else {
            if (closed.current) setOpened(true);
            closed.current = false;
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

  return { width: shown, resizing, onResizeStart, onResizeReset: () => setWidth(MIN_ASIDE_WIDTH) };
}
