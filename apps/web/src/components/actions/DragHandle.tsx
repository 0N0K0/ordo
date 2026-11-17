import { ActionIcon, type ActionIconProps } from '@mantine/core';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';

interface DragHandleProps {
  /** What it moves (« Déplacer … »). */
  label: string;
  /** Sets the element starting the drag (`setActivatorNodeRef` of `useSortable`). */
  activator: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** The item is being dragged. */
  dragging: boolean;
  size?: ActionIconProps['size'];
}

/**
 * Handle moving a sortable item (a card, a case) by drag and drop, the same everywhere; the keyboard moves it too.
 * @param {DragHandleProps} props Component props.
 * @returns {JSX.Element} Handle.
 */
export function DragHandle({ label, activator, attributes, listeners, dragging, size }: DragHandleProps) {
  return (
    <ActionIcon
      ref={activator}
      variant="subtle"
      color="gray"
      size={size}
      aria-label={label}
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', flex: 'none' }}
      {...attributes}
      {...listeners}
    >
      <DotsSixVerticalIcon weight="bold" aria-hidden />
    </ActionIcon>
  );
}
