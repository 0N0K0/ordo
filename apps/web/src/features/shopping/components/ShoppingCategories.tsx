import { Badge } from '@mantine/core';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useShoppingData, useShoppingMutations, type ShoppingCategory } from '../api';
import { useShoppingCategoryItems } from '../hooks/use-settings-items';

/**
 * Categories of the products, as a tree: add a category or a sub-category, edit (name, color — the one of its parent
 * by default —, image, parent and base lists it is offered in), delete, put one under another by drag and drop.
 * @param {{ categories: ShoppingCategory[], usage: Map<string, number> }} props Component props.
 * @param {ShoppingCategory[]} props.categories All categories.
 * @param {Map<string, number>} props.usage Number of products and items of each category.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingCategories({ categories, usage }: { categories: ShoppingCategory[]; usage: Map<string, number> }) {
  const { deleteCategory, moveCategory } = useShoppingMutations();
  const kind = useShoppingCategoryItems();
  const { data } = useShoppingData();
  const baseListNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.label]));
  return (
    <SettingsList
      {...kind}
      nested
      title="Catégories"
      description="Classent les produits, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. Une catégorie peut être réservée à certaines références."
      noun="la catégorie"
      feminine
      items={categories}
      usage={usage}
      usageNoun={{ one: 'du produit ou de l’élément', many: 'produits et éléments' }}
      remove={(id) => deleteCategory.mutateAsync(id)}
      move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
      renderBadges={(category) =>
        category.baseListIds.map((id) => (
          <Badge key={id} size="xs" variant="light" color="gray">
            {baseListNames.get(id)}
          </Badge>
        ))
      }
    />
  );
}
