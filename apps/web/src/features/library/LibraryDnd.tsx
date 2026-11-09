import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, NavLink, Table, type NavLinkProps } from '@mantine/core';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { dndId } from './library-dnd';

interface SortableRowProps {
  /** "folder:<id>" or "doc:<id>". */
  id: string;
  /** Name, for the handle. */
  label: string;
  disabled?: boolean;
  bg?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}

/**
 * Row of the library moved by its handle: among the rows of its kind, or (a document) into a folder; a folder row
 * shows when a document is dropped into it.
 * @param {SortableRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function SortableRow({ id, label, disabled = false, bg, style, onClick, children }: SortableRowProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging, isOver, active } = useSortable({ id, disabled });
  // A document over a folder row goes into it.
  const receiving = isOver && active !== null && dndId(active.id).kind === 'doc' && dndId(id).kind === 'folder';
  return (
    <Table.Tr
      ref={setNodeRef}
      bg={receiving ? 'var(--mantine-primary-color-light)' : bg}
      onClick={onClick}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.6 : undefined,
        outline: receiving ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2,
      }}
    >
      <Table.Td w={32} px={4}>
        {!disabled && (
          <ActionIcon
            ref={setActivatorNodeRef}
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Déplacer ${label}`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <DotsSixVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Table.Td>
      {children}
    </Table.Tr>
  );
}

interface DroppableFolderLinkProps extends NavLinkProps {
  /** Folder, or null for the root. */
  folderId: string | null;
  onClick?: () => void;
}

/**
 * Folder of the tree receiving what is dropped on it: documents, or folders (moved into it).
 * @param {DroppableFolderLinkProps} props Component props.
 * @returns {JSX.Element} Link.
 */
export function DroppableFolderLink({ folderId, style, ...props }: DroppableFolderLinkProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `tree:${folderId ?? 'root'}` });
  const receiving = isOver && active !== null;
  return (
    <NavLink
      ref={setNodeRef}
      {...props}
      style={{ ...(style as CSSProperties), outline: receiving ? '2px solid var(--mantine-primary-color-filled)' : undefined, outlineOffset: -2, borderRadius: 'var(--mantine-radius-sm)' }}
    />
  );
}
