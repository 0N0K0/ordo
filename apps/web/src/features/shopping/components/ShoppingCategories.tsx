import { Badge } from '@mantine/core';
import { shoppingCategorySchema } from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useShoppingData, useShoppingMutations, type ShoppingCategory } from '../api';
import { unarchived } from '../../../lib/archive';

/**
 * Categories of the products, as a tree: add a category or a sub-category, edit (name, color — the one of its parent
 * by default —, image, parent and base lists it is offered in), delete, put one under another by drag and drop.
 * @param {{ categories: ShoppingCategory[], usage: Map<string, number> }} props Component props.
 * @param {ShoppingCategory[]} props.categories All categories.
 * @param {Map<string, number>} props.usage Number of products and items of each category.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingCategories({ categories, usage }: { categories: ShoppingCategory[]; usage: Map<string, number> }) {
  const { createCategory, updateCategory, deleteCategory, moveCategory } = useShoppingMutations();
  const { data } = useShoppingData();
  const baseLists = data?.shoppingBaseLists ?? [];
  const baseListNames = new Map(baseLists.map((baseList) => [baseList.id, baseList.name]));
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null, baseListIds: string[] }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null; baseListIds: string[] }) => ({ ...values, color: values.color || null });
  return (
    <SettingsList<ShoppingCategory, { baseListIds: string[] }>
      kind="SHOPPING_CATEGORY"
      nested
      title="Catégories"
      description="Classent les produits, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. Une catégorie peut être réservée à certaines références."
      noun="la catégorie"
      items={categories}
      usage={usage}
      usageNoun="produits et éléments"
      schema={shoppingCategorySchema}
      extra={{
        initial: (category) => ({ baseListIds: category?.baseListIds ?? [] }),
        render: (form) => (
          <BatchMultiSelect
            label="Références"
            description="Celles où elle est proposée. Aucune : toutes (une sous-catégorie sans liste prend celles de sa catégorie parente)."
            placeholder={form.getValues().baseListIds.length ? undefined : 'Toutes'}
            data={unarchived(baseLists, form.getValues().baseListIds).map((baseList) => ({ value: baseList.id, label: baseList.name }))}
            clearable
            {...form.getInputProps('baseListIds')}
          />
        ),
      }}
      create={async (values) => createdId(await createCategory.mutateAsync(input(values)))}
      update={(id, values) => updateCategory.mutateAsync({ id, input: input(values) })}
      remove={(id) => deleteCategory.mutateAsync(id)}
      move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
      renderBadges={(category) =>
        category.baseListIds.map((id) => (
          <Badge key={id} size="xs" variant="light" color="gray" tt="none">
            {baseListNames.get(id)}
          </Badge>
        ))
      }
    />
  );
}
