import type { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';

/** What a sortable item gets from useSortable to place itself while dragged. */
type SortableState = Pick<ReturnType<typeof useSortable>, 'transform' | 'transition' | 'isDragging'>;

/**
 * Style of a sortable item: moved with the pointer (translated, never scaled), above the others and dimmed while
 * dragged (decision K).
 * @param {SortableState} state Transform, transition and dragging of useSortable.
 * @returns {CSSProperties} Style.
 */
export function sortableStyle({ transform, transition, isDragging }: SortableState): CSSProperties {
  return { transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 1 : undefined, opacity: isDragging ? 'var(--onoko-dragging-opacity)' : undefined };
}
