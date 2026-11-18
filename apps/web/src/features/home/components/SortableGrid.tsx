import { arrayMove } from '@dnd-kit/sortable';
import { SimpleGrid } from '@mantine/core';
import type { ReactNode } from 'react';
import { DragHandleContext } from '../lib/drag-handle';
import { SortableArea } from '../../../components/dnd/sortable';
import { useSortableItem } from '../../../components/dnd/use-sortable-item';

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

/**
 * Card of the grid that can be moved by its handle.
 * @param {SortableItemProps} props Component props.
 * @returns {JSX.Element} Item.
 */
function SortableItem({ id, children }: SortableItemProps) {
  const { ref, style, handle } = useSortableItem(id);
  return (
    <div ref={ref} style={style}>
      <DragHandleContext.Provider value={handle}>{children}</DragHandleContext.Provider>
    </div>
  );
}

interface SortableGridProps {
  /** Cards, in their order. */
  items: { id: string; node: ReactNode }[];
  onReorder: (ids: string[]) => void;
}

/**
 * Grid of cards reordered by drag and drop (pointer, or keyboard on the handle: space, arrows, space).
 * @param {SortableGridProps} props Component props.
 * @returns {JSX.Element} Grid.
 */
export function SortableGrid({ items, onReorder }: SortableGridProps) {
  const ids = items.map((item) => item.id);
  return (
    <SortableArea ids={ids} layout="grid" onMove={(_, from, to) => onReorder(arrayMove(ids, from, to))}>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {item.node}
          </SortableItem>
        ))}
      </SimpleGrid>
    </SortableArea>
  );
}
