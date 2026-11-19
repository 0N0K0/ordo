import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, rectSortingStrategy, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useDragSensors } from './drag';

/** Sorting strategy of each layout. */
const STRATEGIES = { grid: rectSortingStrategy, list: verticalListSortingStrategy, row: horizontalListSortingStrategy };

interface SortableAreaProps {
  /** Ids of the items, in their order. */
  ids: string[];
  /** Layout of the items: a grid of cards, a vertical list, or a row (tabs). */
  layout: 'grid' | 'list' | 'row';
  /** Moved with the pointer only (the items keep their own keyboard navigation: tabs). Optional. Default = false. */
  pointerOnly?: boolean;
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
export function SortableArea({ ids, layout, pointerOnly = false, onMove, children }: SortableAreaProps) {
  const sensors = useDragSensors(pointerOnly ? false : 'sortable');

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
      <SortableContext items={ids} strategy={STRATEGIES[layout]}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
