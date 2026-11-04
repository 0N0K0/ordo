import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SimpleGrid } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { DragHandleContext } from './drag-handle';

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
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const handle = useMemo(() => ({ attributes, listeners }), [attributes, listeners]);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
    >
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map((item) => item.id);

  /**
   * Moves the dropped card to its new place.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {item.node}
            </SortableItem>
          ))}
        </SimpleGrid>
      </SortableContext>
    </DndContext>
  );
}
