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
  /** Class of its own. Optional. */
  className?: string;
  /** Shown only on hover or focus of its host (`data-reveal`, styles/reveal.css). Optional. */
  reveal?: boolean;
}

/**
 * Handle moving a sortable item (a card, a case) by drag and drop, the same everywhere; the keyboard moves it too.
 * @param {DragHandleProps} props Component props.
 * @returns {JSX.Element} Handle.
 */
export function DragHandle({ label, activator, attributes, listeners, dragging, size, className, reveal }: DragHandleProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- the one drag handle (dragged, not clicked).
    <ActionIcon
      ref={activator}
      variant="subtle"
      color="gray"
      size={size}
      className={className}
      data-reveal={reveal || undefined}
      aria-label={label}
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', flex: 'none' }}
      {...attributes}
      {...listeners}
    >
      <DotsSixVerticalIcon weight="bold" aria-hidden />
    </ActionIcon>
  );
}
