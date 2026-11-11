import { ActionIcon, Button, ColorInput, ColorSwatch, Group, Paper, Select, Stack, Table, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { shoppingCategorySchema } from '@ordo/shared';
import { PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useShoppingMutations, type ShoppingCategory } from './api';
import { shoppingCategoryOptions, shoppingCategoryTree } from './shopping-format';

interface CategoryFormProps {
  categories: ShoppingCategory[];
  category?: ShoppingCategory;
  parentId?: string | null;
  onDone: () => void;
}

/**
 * Category of products: name, color (the one of its parent by default) and parent category.
 * @param {CategoryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function CategoryForm({ categories, category, parentId = null, onDone }: CategoryFormProps) {
  const { createCategory, updateCategory } = useShoppingMutations();
  const swatches = useColorSwatches();
  const parentColor = parentId ? shoppingCategoryTree(categories).find((item) => item.category.id === parentId)?.color : null;
  const form = useAppForm<{ name: string; color: string; parentId: string | null }>({
    initialValues: { name: category?.name ?? '', color: category ? (category.color ?? '') : (parentColor ?? swatches[0]), parentId: category ? (category.parentId ?? null) : parentId },
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
        <Select label="Catégorie parente" placeholder="Aucune (catégorie principale)" clearable searchable data={shoppingCategoryOptions(categories, category?.id)} {...form.getInputProps('parentId')} />
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

let modalCount = 0;

/**
 * Categories of the products, as a tree (as the treasury categories): add a category or a sub-category, edit,
 * delete.
 * @param {{ categories: ShoppingCategory[], usage: Map<string, number> }} props Component props.
 * @param {ShoppingCategory[]} props.categories All categories.
 * @param {Map<string, number>} props.usage Number of products and items of each category.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingCategories({ categories, usage }: { categories: ShoppingCategory[]; usage: Map<string, number> }) {
  const { deleteCategory } = useShoppingMutations();
  const tree = shoppingCategoryTree(categories);

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
            « {path} » sera supprimée définitivement.{used ? ` Ses ${used} produit(s) et élément(s) n’auront plus de catégorie.` : ''} Ses sous-catégories remonteront d’un niveau. Cette action
            est irréversible.
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

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Catégories
            </Title>
            <Text size="sm" c="dimmed">
              Classent les produits, en arborescence. Une sous-catégorie sans couleur prend celle de sa catégorie parente.
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
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {tree.map(({ category, depth, path, color }) => (
                <Table.Tr key={category.id}>
                  <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}>
                    <Group gap="xs" wrap="nowrap">
                      {color && <ColorSwatch color={color} size={12} />}
                      <Text size="sm" fw={depth === 0 ? 600 : undefined}>
                        {category.name}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {usage.get(category.id) || ''}
                    </Text>
                  </Table.Td>
                  <Table.Td w={1}>
                    <Group gap={2} wrap="nowrap" justify="flex-end">
                      <Tooltip label="Ajouter une sous-catégorie">
                        <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter une sous-catégorie à ${path}`} onClick={() => openForm({ parentId: category.id })}>
                          <PlusIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${path}`} onClick={() => openForm({ category })}>
                          <PencilSimpleIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${path}`} onClick={() => confirmDelete(category, path)}>
                          <TrashIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}
