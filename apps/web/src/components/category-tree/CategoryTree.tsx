import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragOverEvent } from '@dnd-kit/core';
import { ActionIcon, ColorSwatch, Group, Paper, Table, Text } from '@mantine/core';
import { CaretDownIcon, CaretRightIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { categoryTree, treeDestination, type PlacedCategory, type TreeCategory, type TreePlace } from './category-tree';
import classes from './CategoryTreeManager.module.css';
import { pointerPlace, treeCollision, useFolded } from './tree-dnd';

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
}

/**
 * Row of the tree: moved by its handle before, after or under another category, receiving the category dropped on it.
 * @param {CategoryRowProps<C>} props Component props.
 * @returns {JSX.Element} Row.
 */
function CategoryRow<C extends TreeCategory>({ placed, meta, badges, actions, drop, folded, onToggle }: CategoryRowProps<C>) {
  const { category, depth, path, color } = placed;
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: category.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: category.id });
  return (
    <Table.Tr
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={classes.row}
      data-drop={drop ?? undefined}
      data-dragging={isDragging || undefined}
    >
      <Table.Td w={32} px={4}>
        <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${path}`} className={classes.handle} {...attributes} {...listeners}>
          <DotsSixVerticalIcon weight="bold" aria-hidden />
        </ActionIcon>
      </Table.Td>
      <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}>
        <Group gap="xs" wrap="nowrap">
          {folded !== undefined ? (
            <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`${folded ? 'Déplier' : 'Replier'} ${path}`} aria-expanded={!folded} onClick={onToggle}>
              {folded ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
            </ActionIcon>
          ) : (
            <span className={classes.caretSpace} />
          )}
          {color && <ColorSwatch color={color} size={12} />}
          <Text size="sm" fw={depth === 0 ? 600 : undefined}>
            {category.name}
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

export interface CategoryTreeProps<C extends TreeCategory> {
  /** Categories of the tree. */
  categories: readonly C[];
  /** Key remembering the folded categories in this browser. Optional. */
  storageKey?: string;
  /** Cell after the name (number of uses…). Optional. */
  renderMeta?: (placed: PlacedCategory<C>) => ReactNode;
  /** Badges after the name. Optional. */
  renderBadges?: (category: C) => ReactNode;
  /** Buttons at the end of a row. */
  renderActions: (placed: PlacedCategory<C>) => ReactNode;
  /** Puts a category under a parent (null: top level) at an index among its siblings. */
  onMove: (id: string, parentId: string | null, index: number) => void;
}

/**
 * Categories as a tree table: each one folds its sub-categories, and moves by drag and drop before or after another
 * one (top of a row: before, bottom: after, middle: under it, last; with the keyboard: under it).
 * @param {CategoryTreeProps<C>} props Component props.
 * @returns {JSX.Element} Tree.
 */
export function CategoryTree<C extends TreeCategory>({ categories, storageKey, renderMeta, renderBadges, renderActions, onMove }: CategoryTreeProps<C>) {
  const tree = categoryTree(categories);
  const [folded, toggle] = useFolded(storageKey);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: TreePlace } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const parents = new Set(tree.map(({ category }) => category.parentId).filter(Boolean));
  // A folded category hides all its sub-categories.
  const hidden = new Set<string>();
  for (const { category } of tree) {
    if (category.parentId && (hidden.has(category.parentId) || folded.has(category.parentId))) hidden.add(category.id);
  }
  const shown = tree.filter(({ category }) => !hidden.has(category.id));

  /**
   * Updates where the dragged category would go.
   * @param {DragMoveEvent | DragOverEvent} event Drag event.
   * @returns {void}
   */
  const handleDragMove = (event: DragMoveEvent | DragOverEvent) => {
    const next = pointerPlace(event);
    setDrop((current) => (current?.id === next?.id && current?.place === next?.place ? current : next));
  };

  /**
   * Moves the dropped category where the pointer shows.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const place = drop?.place ?? 'INSIDE';
    setDragged(null);
    setDrop(null);
    if (!over) return;
    const destination = treeDestination(categories, String(active.id), String(over.id), place);
    if (destination) onMove(String(active.id), destination.parentId, destination.index);
  };

  const active = dragged ? tree.find((item) => item.category.id === dragged) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={treeCollision}
      onDragStart={({ active: start }) => setDragged(String(start.id))}
      onDragMove={handleDragMove}
      onDragOver={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null);
        setDrop(null);
      }}
      accessibility={{
        announcements: {
          onDragStart: () => `${active?.category.name ?? 'Catégorie'} saisie.`,
          onDragOver: () => undefined,
          onDragMove: () => undefined,
          onDragEnd: ({ over }) => (over ? 'Catégorie déplacée.' : 'Déplacement annulé.'),
          onDragCancel: () => 'Déplacement annulé.',
        },
      }}
    >
      <Table verticalSpacing={4}>
        <Table.Tbody>
          {shown.map((placed) => {
            const { id } = placed.category;
            const dropHere = dragged !== null && drop?.id === id && treeDestination(categories, dragged, id, drop.place) ? drop.place : null;
            return (
              <CategoryRow
                key={id}
                placed={placed}
                meta={renderMeta?.(placed)}
                badges={renderBadges?.(placed.category)}
                actions={renderActions(placed)}
                drop={dropHere}
                folded={parents.has(id) ? folded.has(id) : undefined}
                onToggle={() => toggle(id)}
              />
            );
          })}
        </Table.Tbody>
      </Table>
      <DragOverlay dropAnimation={null}>
        {active && (
          <Paper shadow="md" radius="sm" px="sm" py={4} withBorder className={classes.overlay}>
            <Group gap="xs" wrap="nowrap">
              <DotsSixVerticalIcon weight="bold" aria-hidden />
              <Text size="sm" fw={500}>
                {active.category.name}
              </Text>
            </Group>
          </Paper>
        )}
      </DragOverlay>
    </DndContext>
  );
}
