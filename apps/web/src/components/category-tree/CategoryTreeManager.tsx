import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ActionIcon, Button, ColorSwatch, Group, Paper, Stack, Table, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { DotsSixVerticalIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { DestructiveActions } from '../../features/workspace/DeleteDialogs';
import { categoryTree, type PlacedCategory, type TreeCategory } from './category-tree';
import classes from './CategoryTreeManager.module.css';

/** Id of the drop zone making a category a top-level one. */
const ROOT = 'category-root';

/**
 * Where a dragged category goes: the row (or the top-level zone) under the pointer; with the keyboard, the closest.
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

interface CategoryRowProps<C extends TreeCategory> {
  placed: PlacedCategory<C>;
  usage: number;
  badges?: ReactNode;
  /** Receives the dragged category (which is not itself nor one of its parents). */
  receiving: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Row of the tree: moved by its handle under another category, receiving the category dropped on it.
 * @param {CategoryRowProps<C>} props Component props.
 * @returns {JSX.Element} Row.
 */
function CategoryRow<C extends TreeCategory>({ placed, usage, badges, receiving, onAdd, onEdit, onDelete }: CategoryRowProps<C>) {
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
      data-over={receiving || undefined}
      data-dragging={isDragging || undefined}
    >
      <Table.Td w={32} px={4}>
        <ActionIcon
          ref={setActivatorNodeRef}
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`Déplacer ${path} sous une autre catégorie`}
          className={classes.handle}
          {...attributes}
          {...listeners}
        >
          <DotsSixVerticalIcon weight="bold" aria-hidden />
        </ActionIcon>
      </Table.Td>
      <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}>
        <Group gap="xs" wrap="nowrap">
          {color && <ColorSwatch color={color} size={12} />}
          <Text size="sm" fw={depth === 0 ? 600 : undefined}>
            {category.name}
          </Text>
          {badges}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          {usage || ''}
        </Text>
      </Table.Td>
      <Table.Td w={1}>
        <Group gap={2} wrap="nowrap" justify="flex-end">
          <Tooltip label="Ajouter une sous-catégorie">
            <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter une sous-catégorie à ${path}`} onClick={onAdd}>
              <PlusIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Modifier">
            <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${path}`} onClick={onEdit}>
              <PencilSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Supprimer">
            <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${path}`} onClick={onDelete}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Zone shown while dragging a sub-category: dropped there, it becomes a top-level category.
 * @param {{ over: boolean }} props Component props.
 * @param {boolean} props.over The dragged category is over it.
 * @returns {JSX.Element} Zone.
 */
function RootZone({ over }: { over: boolean }) {
  const { setNodeRef } = useDroppable({ id: ROOT });
  return (
    <Paper ref={setNodeRef} withBorder radius="sm" p="xs" className={classes.rootZone} data-over={over || undefined}>
      <Text size="sm" c="dimmed" ta="center">
        Déposer ici pour en faire une catégorie principale
      </Text>
    </Paper>
  );
}

let modalCount = 0;

export interface CategoryTreeManagerProps<C extends TreeCategory> {
  title?: string;
  description: string;
  categories: C[];
  /** Number of rows of each category. */
  usage: Map<string, number>;
  /** What the rows are, in the deletion message ("produit(s)"). */
  usageNoun: string;
  /** Form of a category: the one edited, or a new one under a parent. */
  renderForm: (props: { category?: C; parentId?: string | null; onDone: () => void }) => ReactNode;
  /** Extra badges of a row. Optional. */
  renderBadges?: (category: C) => ReactNode;
  /** Puts a category under another one (null: top level). */
  onMove: (id: string, parentId: string | null) => void;
  /** Deletes a category. */
  onDelete: (id: string) => void;
}

/**
 * Categories as a tree: add a category or a sub-category, edit, delete, put one under another by drag and drop (or
 * back to the top level).
 * @param {CategoryTreeManagerProps<C>} props Component props.
 * @returns {JSX.Element} Manager.
 */
export function CategoryTreeManager<C extends TreeCategory>({
  title = 'Catégories',
  description,
  categories,
  usage,
  usageNoun,
  renderForm,
  renderBadges,
  onMove,
  onDelete,
}: CategoryTreeManagerProps<C>) {
  const tree = categoryTree(categories);
  const [dragged, setDragged] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  /**
   * Opens the category form.
   * @param {{ category?: C, parentId?: string | null }} [options] Category edited, or parent of a new one. Optional.
   * @returns {void}
   */
  const openForm = ({ category, parentId }: { category?: C; parentId?: string | null } = {}) => {
    const modalId = `category-tree-${++modalCount}`;
    modals.open({
      modalId,
      title: category ? 'Modifier la catégorie' : parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie',
      children: renderForm({ category, parentId, onDone: () => modals.close(modalId) }),
    });
  };

  /**
   * Asks for confirmation before deleting a category.
   * @param {C} category Category.
   * @param {string} path Its full name.
   * @returns {void}
   */
  const confirmDelete = (category: C, path: string) => {
    const modalId = `delete-category-${category.id}`;
    const used = usage.get(category.id) ?? 0;
    modals.open({
      modalId,
      title: 'Supprimer la catégorie',
      children: (
        <Stack gap="md">
          <Text size="sm">
            « {path} » sera supprimée définitivement.{used ? ` Ses ${used} ${usageNoun} n’auront plus de catégorie.` : ''} Ses sous-catégories remonteront d’un niveau. Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              onDelete(category.id);
            }}
          />
        </Stack>
      ),
    });
  };

  /**
   * Whether a category can be put under a target: not itself, not one of its sub-categories, not its parent already.
   * @param {string} id Dragged category.
   * @param {string} target Category or ROOT.
   * @returns {boolean} Allowed.
   */
  const canReceive = (id: string, target: string) => {
    const moved = tree.find((item) => item.category.id === id);
    if (!moved) return false;
    if (target === ROOT) return Boolean(moved.category.parentId);
    const into = tree.find((item) => item.category.id === target);
    return into !== undefined && target !== id && moved.category.parentId !== target && !into.path.startsWith(`${moved.path} › `);
  };

  /**
   * Puts the dropped category under the one it was dropped on (or at the top level).
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    setOverId(null);
    if (!over || !canReceive(String(active.id), String(over.id))) return;
    onMove(String(active.id), over.id === ROOT ? null : String(over.id));
  };

  const active = dragged ? tree.find((item) => item.category.id === dragged) : undefined;

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              {title}
            </Title>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter
          </Button>
        </Group>
        {tree.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <TagIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune catégorie pour le moment.
            </Text>
          </Group>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collision}
            onDragStart={({ active: start }) => setDragged(String(start.id))}
            onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setDragged(null);
              setOverId(null);
            }}
          >
            <Stack gap="xs">
              {active?.category.parentId && <RootZone over={overId === ROOT} />}
              <Table verticalSpacing={4}>
                <Table.Tbody>
                  {tree.map((placed) => (
                    <CategoryRow
                      key={placed.category.id}
                      placed={placed}
                      usage={usage.get(placed.category.id) ?? 0}
                      badges={renderBadges?.(placed.category)}
                      receiving={dragged !== null && overId === placed.category.id && canReceive(dragged, placed.category.id)}
                      onAdd={() => openForm({ parentId: placed.category.id })}
                      onEdit={() => openForm({ category: placed.category })}
                      onDelete={() => confirmDelete(placed.category, placed.path)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
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
        )}
      </Stack>
    </Paper>
  );
}
