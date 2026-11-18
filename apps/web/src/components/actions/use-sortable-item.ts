import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { useMemo, type CSSProperties } from 'react';
import { sortableStyle } from './sortable-style';

/** What a DragHandle takes from its sortable item. */
export interface SortableHandle {
  activator: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  dragging: boolean;
}

/**
 * Item of a SortableArea moved by its DragHandle (a card, a case, a column of a panel), the same everywhere: its node
 * ref, its style (moved with the pointer, above the others and faded while dragged) and the props of its handle.
 * @param {string} id Id of the item in its area.
 * @param {boolean} [disabled] Not moved (read only). Optional.
 * @returns {{ ref: (element: HTMLElement | null) => void, style: CSSProperties, dragging: boolean, handle: SortableHandle }} Item.
 */
export function useSortableItem(id: string, disabled = false): { ref: (element: HTMLElement | null) => void; style: CSSProperties; dragging: boolean; handle: SortableHandle } {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = useMemo(() => ({ activator: setActivatorNodeRef, attributes, listeners, dragging: isDragging }), [setActivatorNodeRef, attributes, listeners, isDragging]);
  const style: CSSProperties = { ...sortableStyle({ transform, transition, isDragging }), opacity: isDragging ? 'var(--onoko-dragging-opacity)' : undefined };
  return { ref: setNodeRef, style, dragging: isDragging, handle };
}
