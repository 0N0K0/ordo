import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useDragSensors } from '../../lib/drag';

interface SortableAreaProps {
  /** Ids of the items, in their order. */
  ids: string[];
  /** Layout of the items: a grid of cards or a vertical list. */
  layout: 'grid' | 'list';
  /** Moves a dropped item from its index to the index of the item it was dropped on. */
  onMove: (id: string, from: number, to: number) => void;
  children: ReactNode;
}

/**
 * Area of items reordered by drag and drop (pointer, or keyboard on their handle: space, arrows, space): the items use
 * useSortable with their id, and a drop on another item moves it there.
 * @param {SortableAreaProps} props Component props.
 * @returns {JSX.Element} Area.
 */
export function SortableArea({ ids, layout, onMove, children }: SortableAreaProps) {
  const sensors = useDragSensors('sortable');

  /**
   * Moves the dropped item to the place of the one it was dropped on.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(String(active.id), from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
