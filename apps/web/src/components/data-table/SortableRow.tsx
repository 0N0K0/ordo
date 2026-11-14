import { ActionIcon, Table, type TableTrProps } from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/** Width of the drag handle cell. */
export const DRAG_HANDLE_WIDTH = 32;

/**
 * Row of a table put in order by hand: dragged by its handle (first cell); keyboard too (space, arrows).
 * @param {{ id: string, children: ReactNode } & TableTrProps} props Row key, cells and row props.
 * @returns {JSX.Element} Row.
 */
export function SortableRow({ id, children, style, ...props }: { id: string; children: ReactNode } & TableTrProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <Table.Tr
      ref={setNodeRef}
      {...props}
      style={{
        ...(typeof style === 'object' ? style : {}),
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : undefined,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Table.Td w={DRAG_HANDLE_WIDTH} px={4}>
        <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label="Déplacer la ligne" style={{ cursor: 'grab' }} {...attributes} {...listeners}>
          <DotsSixVerticalIcon aria-hidden />
        </ActionIcon>
      </Table.Td>
      {children}
    </Table.Tr>
  );
}
