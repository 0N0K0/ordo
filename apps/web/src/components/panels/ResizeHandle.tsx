import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import classes from './ResizeHandle.module.css';

interface ResizeHandleProps {
  /** Edge of the panel the handle is on. */
  edge: 'left' | 'right';
  label: string;
  /** The panel is being resized: the handle stays highlighted. */
  resizing: boolean;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeReset: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * Handle on the edge of a resizable panel (useResizablePanel): dragged to resize it, double clicked to reset its width.
 * @param {ResizeHandleProps} props Component props.
 * @returns {JSX.Element} Handle.
 */
export function ResizeHandle({ edge, label, resizing, onResizeStart, onResizeReset }: ResizeHandleProps) {
  return (
    <div
      className={classes.resizeHandle}
      data-edge={edge}
      data-resizing={resizing || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onResizeStart}
      onDoubleClick={onResizeReset}
    />
  );
}
