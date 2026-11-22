import { Stack } from '@mantine/core';
import { countBy } from '@ordo/shared';
import { useStorageItems, useStoreItems } from '../hooks/use-settings-items';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useActiveWorkspace } from '../../workspaces/api';
import { useShoppingData, useShoppingLists, type ShoppingProduct } from '../api';
import { ShoppingCategories } from './ShoppingCategories';
import { ShoppingUnits } from './ShoppingUnits';
import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { useBaseListColumns, useShoppingItemColumns, useShoppingListColumns } from '../hooks/use-shopping-columns';

/** No product: the columns of the references without their comments counted. */
const NO_PRODUCTS: readonly ShoppingProduct[] = [];

/**
 * Settings of the shopping: the categories (a tree), the stores, the units and the storage modes, then the columns of
 * new views of its tables (references, lists, a list). In the settings of
 * the shopping pages and in the shopping tab of a project (the categories and the units also in those of the sheets
 * and of the stock).
 * @returns {JSX.Element} Settings.
 */
export function ShoppingSettings() {
  const { perso } = useActiveWorkspace();
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const stores = useStoreItems();
  const storages = useStorageItems();
  const rows = [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items)];
  const productColumns = useBaseListColumns(null, NO_PRODUCTS);
  const listColumns = useShoppingListColumns(lists);
  const itemColumns = useShoppingItemColumns(undefined);
  return (
    <Stack gap="md">
      <ShoppingCategories />
      <SettingsList
        {...stores}
        title="Magasins"
        description={perso ? 'Où vous achetez les produits.' : 'Magasins et fournisseurs des produits.'}
        noun="le magasin"
        usageNoun={{ one: 'du produit', many: 'produits' }}
        items={data?.shoppingStores ?? []}
        usage={countBy(rows, (row) => row.storeId)}
      />
      <ShoppingUnits />
      <SettingsList
        {...storages}
        title="Modes de conservation"
        description="Comment se conservent les produits périssables : frais, congélation, à l’abri de la lumière…"
        noun="le mode de conservation"
        usageNoun={{ one: 'du produit', many: 'produits' }}
        items={data?.shoppingStorages ?? []}
        usage={countBy(rows, (row) => row.storageId)}
      />
      {/* Last: the columns of new views (long lists). */}
      <ColumnDefaults tableKey="shopping-base-list" columns={productColumns} label="Références" />
      <ColumnDefaults tableKey="shopping-lists" columns={listColumns} label="Listes" />
      <ColumnDefaults tableKey="shopping-list" columns={itemColumns} label="Une liste" />
    </Stack>
  );
}

/**
 * Settings of the shopping pages (the page of the lists and the page of a list), in the settings sidebar.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function ShoppingPageSettings() {
  return (
    <PageSettings title="Paramètres des achats">
      <ShoppingSettings />
    </PageSettings>
  );
}
