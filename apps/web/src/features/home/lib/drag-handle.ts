import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { createContext } from 'react';

/** Drag handle of a home card being sorted: what `useSortable` gives its handle, null outside a sortable grid. */
export interface CardDragHandle {
  /** Sets the element starting the drag (`setActivatorNodeRef`). */
  activator: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** The card is being dragged. */
  dragging: boolean;
}

/** Drag handle of the home card being sorted, null outside a sortable grid. */
export const DragHandleContext = createContext<CardDragHandle | null>(null);
