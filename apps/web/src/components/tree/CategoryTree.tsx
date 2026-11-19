import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { DragLabel } from '../dnd/DragLabel';
import { Group, Table, Text } from '@mantine/core';
import { ItemAvatar } from '../items/ItemAvatar';

import { type ReactNode } from 'react';
import { categoryTree, treeDestination, type PlacedCategory, type TreeCategory, type TreePlace } from './category-tree';
import { useFolded, useTreeDrop } from './tree-dnd';

import treeRow from './tree-drop.module.css';
import { DragHandle } from '../dnd/DragHandle';
import { FoldButton } from '../actions/FoldButton';
import { agreed } from '@ordo/shared';

interface CategoryRowProps<C extends TreeCategory> {
  placed: PlacedCategory<C>;
  meta?: ReactNode;
  badges?: ReactNode;
  actions: ReactNode;
  /** Where the dragged category would go on this row. */
  drop: TreePlace | null;
  /** Its sub-categories are folded (undefined: it has none). */
  folded: boolean | undefined;
  onToggle: () => void;
  /** A tree (else a flat list: no folding). */
  nested: boolean;
  /** Not moved (read only): no drag handle. Optional. */
  locked?: boolean;
}

/**
 * Row of the tree: moved by its handle before, after or under another category, receiving the category dropped on it.
 * @param {CategoryRowProps<C>} props Component props.
 * @returns {JSX.Element} Row.
 */
function CategoryRow<C extends TreeCategory>({ placed, meta, badges, actions, drop, folded, onToggle, nested, locked = false }: CategoryRowProps<C>) {
  const { category, depth, path, color } = placed;
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: category.id, disabled: locked });
  const { setNodeRef: setDropRef } = useDroppable({ id: category.id });
  return (
    <Table.Tr
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={treeRow.row}
      data-drop={drop ?? undefined}
      data-dragging={isDragging || undefined}
    >
      <Table.Td w={32} px={4}>
        {!locked && <DragHandle item={path} size="sm" activator={setActivatorNodeRef} attributes={attributes} listeners={listeners} dragging={isDragging} />}
      </Table.Td>
      <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}>
        <Group gap="xs" wrap="nowrap">
          {!nested ? null : folded !== undefined ? <FoldButton expanded={!folded} item={path} onToggle={onToggle} /> : <span className={treeRow.caretSpace} />}
          <ItemAvatar name={category.label} iconUrl={category.iconUrl} color={color} size={22} />
          <Text size="sm" fw={depth === 0 && nested ? 600 : undefined}>
            {category.label}
          </Text>
          {badges}
        </Group>
      </Table.Td>
      {meta !== undefined && <Table.Td>{meta}</Table.Td>}
      <Table.Td w={1}>
        <Group gap={2} wrap="nowrap" justify="flex-end">
          {actions}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

interface CategoryTreeProps<C extends TreeCategory> {
  /** Categories of the tree. */
  categories: readonly C[];
  /** Key remembering the folded categories in this browser. Optional. */
  storageKey?: string;
  /** Cell after the label (number of uses…). Optional. */
  renderMeta?: (placed: PlacedCategory<C>) => ReactNode;
  /** Badges after the label. Optional. */
  renderBadges?: (category: C) => ReactNode;
  /** Buttons at the end of a row. */
  renderActions: (placed: PlacedCategory<C>) => ReactNode;
  /** Puts a category under a parent (null: top level) at an index among its siblings. */
  onMove: (id: string, parentId: string | null, index: number) => void;
  /** Rows can be put under another (else a flat list, reordered only). Optional. Default = true. */
  nested?: boolean;
  /** Whether a row may go under a parent (null: the top level); refused drops are not shown. Optional. */
  canMove?: (id: string, parentId: string | null) => boolean;
  /** Whether a row is read only (an archived item): not moved, no drag handle. Optional. */
  locked?: (category: C) => boolean;
  /** What a row is, in the announcements of a move (« Catégorie », « Statut »). */
  noun: string;
  /** The noun is feminine: « Catégorie déplacée », « Statut déplacé ». Optional. Default = false. */
  feminine?: boolean;
}

/**
 * Items of a settings list as a table, each with its avatar (its image, or its initials on its color): in a tree, each
 * one folds its sub-items and moves by drag and drop before or after another one (top of a row: before, bottom: after,
 * middle: under it, last; with the keyboard: under it); in a flat list, before or after another one.
 * @param {CategoryTreeProps<C>} props Component props.
 * @returns {JSX.Element} Tree.
 */
export function CategoryTree<C extends TreeCategory>({
  categories,
  storageKey,
  renderMeta,
  renderBadges,
  renderActions,
  onMove,
  nested = true,
  canMove,
  locked,
  noun,
  feminine = false,
}: CategoryTreeProps<C>) {
  const tree = categoryTree(categories);
  const [folded, toggle] = useFolded(storageKey);

  const parents = new Set(tree.map(({ category }) => category.parentId).filter(Boolean));
  // A folded category hides all its sub-categories.
  const hidden = new Set<string>();
  for (const { category } of tree) {
    if (category.parentId && (hidden.has(category.parentId) || folded.has(category.parentId))) hidden.add(category.id);
  }
  const shown = tree.filter(({ category }) => !hidden.has(category.id));

  /**
   * Destination of a drop, when the move is allowed.
   * @param {string} id Row dragged.
   * @param {string} targetId Row dropped on.
   * @param {TreePlace} place Where.
   * @returns {{ parentId: string | null, index: number } | null} Destination, null when refused.
   */
  const allowed = (id: string, targetId: string, place: TreePlace) => {
    const destination = treeDestination(categories, id, targetId, place);
    return destination && (!canMove || canMove(id, destination.parentId)) ? destination : null;
  };

  const { dragged, dropOn, dndProps } = useTreeDrop({
    nested,
    fallback: nested ? 'INSIDE' : 'AFTER',
    destination: allowed,
    onDrop: (id, destination) => onMove(id, destination.parentId, destination.index),
    taken: (id) => `${tree.find((item) => item.category.id === id)?.category.label ?? noun} ${agreed('saisi', feminine)}.`,
    moved: `${noun} ${agreed('déplacé', feminine)}.`,
  });

  const active = dragged ? tree.find((item) => item.category.id === dragged) : undefined;

  return (
    <DndContext {...dndProps}>
      <Table verticalSpacing={4}>
        <Table.Tbody>
          {shown.map((placed) => {
            const { id } = placed.category;
            return (
              <CategoryRow
                key={id}
                placed={placed}
                meta={renderMeta?.(placed)}
                badges={renderBadges?.(placed.category)}
                actions={renderActions(placed)}
                drop={dropOn(id)}
                folded={parents.has(id) ? folded.has(id) : undefined}
                onToggle={() => toggle(id)}
                nested={nested}
                locked={locked?.(placed.category)}
              />
            );
          })}
        </Table.Tbody>
      </Table>
      <DragOverlay dropAnimation={null}>{active && <DragLabel label={active.category.label} />}</DragOverlay>
    </DndContext>
  );
}
