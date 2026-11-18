import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { SimpleGrid } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { DragHandleContext } from '../lib/drag-handle';
import { SortableArea } from '../../../components/actions/sortable';
import { sortableStyle } from '../../../components/actions/sortable-style';

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
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const handle = useMemo(() => ({ activator: setActivatorNodeRef, attributes, listeners, dragging: isDragging }), [setActivatorNodeRef, attributes, listeners, isDragging]);
  return (
    <div ref={setNodeRef} style={{ ...sortableStyle({ transform, transition, isDragging }), opacity: isDragging ? 0.85 : undefined }}>
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
