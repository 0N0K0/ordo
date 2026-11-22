import { SettingsList } from '../../../components/settings/SettingsList';
import { useShoppingData, useShoppingLists } from '../api';
import { useUnitItems } from '../hooks/use-settings-items';

/**
 * Units of quantity: add, rename (the products and the items of the lists in it follow), delete; each one counts the
 * products and items of lists in it (the unit is kept as text, matched by its label). In the settings of the shopping,
 * of the sheets and of the stock.
 * @returns {JSX.Element} Manager.
 */
export function ShoppingUnits() {
  const units = useUnitItems();
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const rows = [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items)];
  return (
    <SettingsList
      {...units}
      title="Unités"
      description="Unités de quantité des produits (kg, boîte, bouteille…). Renommer une unité la renomme dans les produits et les listes."
      noun="l’unité"
      feminine
      usageNoun={{ one: 'du produit', many: 'produits' }}
      items={data?.shoppingUnits ?? []}
      usage={new Map((data?.shoppingUnits ?? []).map((unit) => [unit.id, rows.filter((row) => row.unit === unit.label).length]))}
    />
  );
}
