import { useLocalStorage } from '@mantine/hooks';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

interface ResizablePanelOptions {
  /** Local storage key of the width (each window keeps its own: the last change is what a new window starts with). */
  storageKey: string;
  defaultWidth: number;
  /** Side of the window the panel lies on: its handle is on its other edge. */
  side: 'left' | 'right';
  /** Narrowest the panel is (read again when the window is resized): dragged below, it closes. */
  minWidth: () => number;
  /** Widest the panel may be (read again when the window is resized). */
  maxWidth: () => number;
  opened: boolean;
  /** Opens or closes the panel. */
  setOpened: (opened: boolean) => void;
  /** A double click on the handle at the minimum width gives the panel the width of its content. Optional. */
  fitContent?: boolean;
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
 * Width of a panel on a side of the window (the navigation sidebar, the settings sidebar, the side panel), kept, with a
 * handle on its inner edge to resize it: dragging below the minimum closes it, dragging back reopens it; a double click on the
 * handle gives it its minimum width (and, with `fitContent`, at its minimum width the width of its content). The width
 * shown stays between the limits of the window, the stored one is left as chosen (a narrow window, even for a moment,
 * would otherwise shrink it for good).
 * @param {ResizablePanelOptions} options Storage, side, limits and open state of the panel.
 * @returns {{ width: number, resizing: boolean, onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void, onResizeReset: (event: ReactMouseEvent<HTMLElement>) => void }}
 *   Width shown, resizing state, and the handle pointer and double click handlers.
 */
export function useResizablePanel({ storageKey, defaultWidth, side, minWidth, maxWidth, opened, setOpened, fitContent = false }: ResizablePanelOptions) {
  const [width, setWidth] = useLocalStorage({ key: storageKey, sync: false, defaultValue: defaultWidth });
  const [resizing, setResizing] = useState(false);
  const [limits, setLimits] = useState(() => ({ min: minWidth(), max: maxWidth() }));
  const frame = useRef(0);
  const closed = useRef(false);

  useEffect(() => {
    const update = () => setLimits({ min: minWidth(), max: maxWidth() });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [minWidth, maxWidth]);
  // Width shown: the one chosen, between the limits (a stored value not a number gives the default).
  const chosen = Number.isFinite(width) ? width : defaultWidth;
  const shown = Math.round(Math.max(limits.min, Math.min(chosen, limits.max)));

  /**
   * Starts resizing from the handle: the width is the distance from the pointer to the side of the panel.
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
          const next = side === 'left' ? moveEvent.clientX : window.innerWidth - moveEvent.clientX;
          // Opened or closed only when crossing the minimum: not on every move.
          if (next < minWidth()) {
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
    [side, minWidth, maxWidth, setOpened, setWidth],
  );

  /**
   * Double click on the handle: the panel at its minimum width; with `fitContent`, already there, at the width of its
   * content.
   * @param {ReactMouseEvent<HTMLElement>} event Double click on the handle (inside the panel).
   * @returns {void}
   */
  const onResizeReset = (event: ReactMouseEvent<HTMLElement>) => {
    const panel = event.currentTarget.parentElement;
    const min = minWidth();
    if (fitContent && opened && shown <= min + 1 && panel) {
      setWidth(Math.max(min, Math.min(maxWidth(), shown + hiddenWidth(panel))));
      return;
    }
    if (!opened) setOpened(true);
    setWidth(min);
  };

  return { width: shown, resizing, onResizeStart, onResizeReset };
}
