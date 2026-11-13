import { Badge, Button, ColorInput, Group, Select, Stack, TextInput } from '@mantine/core';
import { shoppingCategorySchema } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { CategoryTreeManager } from '../../components/category-tree/CategoryTreeManager';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useShoppingData, useShoppingMutations, type ShoppingCategory } from './api';
import { shoppingCategoryOptions, shoppingCategoryTree } from './shopping-format';
import { treeSelectProps } from '../../components/tree-select/tree-select';

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
          {...treeSelectProps(shoppingCategoryOptions(categories, category?.id))}
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
  const baseListNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.name]));
  return (
    <CategoryTreeManager
      description="Classent les produits, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. Une catégorie peut être réservée à certaines listes types."
      categories={categories}
      usage={usage}
      usageNoun="produit(s) et élément(s)"
      renderForm={(props) => <CategoryForm categories={categories} {...props} />}
      renderBadges={(category) =>
        category.baseListIds.map((id) => (
          <Badge key={id} size="xs" variant="light" color="gray" tt="none">
            {baseListNames.get(id)}
          </Badge>
        ))
      }
      onMove={(id, parentId, index) => moveCategory.mutate({ id, parentId, index }, { onError: (error) => notifyError(error.message) })}
      onDelete={(id) => deleteCategory.mutate(id, { onSuccess: () => notifySuccess('Catégorie supprimée.'), onError: (error) => notifyError(error.message) })}
    />
  );
}
