import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ActionIcon, Badge, Button, ColorInput, ColorSwatch, Group, Paper, Select, Stack, Table, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { shoppingCategorySchema } from '@ordo/shared';
import { DotsSixVerticalIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useShoppingData, useShoppingMutations, type ShoppingCategory } from './api';
import { shoppingCategoryOptions, shoppingCategoryTree, type PlacedShoppingCategory } from './shopping-format';
import classes from './Shopping.module.css';

interface CategoryFormProps {
  categories: ShoppingCategory[];
  category?: ShoppingCategory;
  parentId?: string | null;
  onDone: () => void;
}

/**
 * Category of products: name, color (the one of its parent by default), parent category and base lists it is offered
 * in.
 * @param {CategoryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function CategoryForm({ categories, category, parentId = null, onDone }: CategoryFormProps) {
  const { createCategory, updateCategory } = useShoppingMutations();
  const { data } = useShoppingData();
  const swatches = useColorSwatches();
  const parentColor = parentId ? shoppingCategoryTree(categories).find((item) => item.category.id === parentId)?.color : null;
  const form = useAppForm<{ name: string; color: string; parentId: string | null; baseListIds: string[] }>({
    initialValues: {
      name: category?.name ?? '',
      color: category ? (category.color ?? '') : (parentColor ?? swatches[0]),
      parentId: category ? (category.parentId ?? null) : parentId,
      baseListIds: category?.baseListIds ?? [],
    },
    schema: shoppingCategorySchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const input = { ...values, color: values.color || null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(category ? 'Catégorie modifiée.' : 'Catégorie créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (category) updateCategory.mutate({ id: category.id, input }, callbacks);
    else createCategory.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Couleur" format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Select
          label="Catégorie parente"
          placeholder="Aucune (catégorie principale)"
          clearable
          searchable
          data={shoppingCategoryOptions(categories, category?.id)}
          {...form.getInputProps('parentId')}
        />
        <BatchMultiSelect
          label="Listes types"
          description="Celles où elle est proposée. Aucune : toutes (une sous-catégorie sans liste prend celles de sa catégorie parente)."
          placeholder={form.getValues().baseListIds.length ? undefined : 'Toutes'}
          data={(data?.shoppingBaseLists ?? []).map((baseList) => ({ value: baseList.id, label: baseList.name }))}
          clearable
          {...form.getInputProps('baseListIds')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
            {category ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

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

interface CategoryRowProps {
  placed: PlacedShoppingCategory;
  usage: number;
  /** Base list names, by id. */
  baseListNames: Map<string, string>;
  /** Receives the dragged category (which is not itself nor one of its parents). */
  receiving: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Row of the tree: moved by its handle under another category, receiving the category dropped on it.
 * @param {CategoryRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function CategoryRow({ placed, usage, baseListNames, receiving, onAdd, onEdit, onDelete }: CategoryRowProps) {
  const { category, depth, path, color } = placed;
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: category.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: category.id });
  return (
    <Table.Tr
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={classes.itemRow}
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
          {category.baseListIds.map((id) => (
            <Badge key={id} size="xs" variant="light" color="gray" tt="none">
              {baseListNames.get(id)}
            </Badge>
          ))}
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

/**
 * Categories of the products, as a tree (as the treasury categories): add a category or a sub-category, edit,
 * delete, put one under another by drag and drop (or back to the top level).
 * @param {{ categories: ShoppingCategory[], usage: Map<string, number> }} props Component props.
 * @param {ShoppingCategory[]} props.categories All categories.
 * @param {Map<string, number>} props.usage Number of products and items of each category.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingCategories({ categories, usage }: { categories: ShoppingCategory[]; usage: Map<string, number> }) {
  const { deleteCategory, moveCategory } = useShoppingMutations();
  const { data } = useShoppingData();
  const tree = shoppingCategoryTree(categories);
  const baseListNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.name]));
  const [dragged, setDragged] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  /**
   * Opens the category form.
   * @param {{ category?: ShoppingCategory, parentId?: string | null }} [options] Category edited, or parent of a new one. Optional.
   * @returns {void}
   */
  const openForm = ({ category, parentId }: { category?: ShoppingCategory; parentId?: string | null } = {}) => {
    const modalId = `shopping-category-${++modalCount}`;
    modals.open({
      modalId,
      title: category ? 'Modifier la catégorie' : parentId ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie',
      children: <CategoryForm categories={categories} category={category} parentId={parentId} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a category.
   * @param {ShoppingCategory} category Category.
   * @param {string} path Its full name.
   * @returns {void}
   */
  const confirmDelete = (category: ShoppingCategory, path: string) => {
    const modalId = `delete-shopping-category-${category.id}`;
    const used = usage.get(category.id) ?? 0;
    modals.open({
      modalId,
      title: 'Supprimer la catégorie',
      children: (
        <Stack gap="md">
          <Text size="sm">
            « {path} » sera supprimée définitivement.{used ? ` Ses ${used} produit(s) et élément(s) n’auront plus de catégorie.` : ''} Ses sous-catégories remonteront d’un niveau. Cette action est
            irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              deleteCategory.mutate(category.id, { onSuccess: () => notifySuccess('Catégorie supprimée.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
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
    const parentId = over.id === ROOT ? null : String(over.id);
    moveCategory.mutate({ id: String(active.id), parentId }, { onError: (error) => notifyError(error.message) });
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
    if (target === ROOT) return moved.category.parentId !== null;
    const into = tree.find((item) => item.category.id === target);
    return into !== undefined && target !== id && moved.category.parentId !== target && !into.path.startsWith(`${moved.path} › `);
  };

  const active = dragged ? tree.find((item) => item.category.id === dragged) : undefined;

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Catégories
            </Title>
            <Text size="sm" c="dimmed">
              Classent les produits, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. Une catégorie peut être
              réservée à certaines listes types.
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
              {active && active.category.parentId !== null && <RootZone over={overId === ROOT} />}
              <Table verticalSpacing={4}>
                <Table.Tbody>
                  {tree.map((placed) => (
                    <CategoryRow
                      key={placed.category.id}
                      placed={placed}
                      usage={usage.get(placed.category.id) ?? 0}
                      baseListNames={baseListNames}
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
