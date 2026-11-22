import { Badge } from '@mantine/core';
import { countBy } from '@ordo/shared';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useSheets } from '../../sheets/api';
import { useStockItems } from '../../stock/api';
import { useShoppingData, useShoppingLists, useShoppingMutations } from '../api';
import { useShoppingCategoryItems } from '../hooks/use-settings-items';

/**
 * Categories of the products, as a tree: add a category or a sub-category, edit (name, color — the one of its parent
 * by default —, image, parent and base lists it is offered in), delete, put one under another by drag and drop. Each
 * one counts the products, items of lists, items of sheets and articles of the stock in it. In the settings of the
 * shopping, of the sheets and of the stock.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingCategories() {
  const { deleteCategory, moveCategory } = useShoppingMutations();
  const kind = useShoppingCategoryItems();
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const { data: sheets } = useSheets();
  const { data: stockItems } = useStockItems();
  const usage = countBy(
    [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items), ...(sheets ?? []).flatMap((sheet) => sheet.items), ...(stockItems ?? [])],
    (row) => row.categoryId,
  );
  const baseListNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.label]));
  return (
    <SettingsList
      {...kind}
      nested
      title="Catégories"
      description="Classent les produits, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. Une catégorie peut être réservée à certaines références."
      noun="la catégorie"
      feminine
      items={data?.shoppingCategories ?? []}
      usage={usage}
      usageNoun={{ one: 'du produit, de l’élément ou de l’article', many: 'produits, éléments et articles' }}
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
