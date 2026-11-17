import { Stack } from '@mantine/core';
import { UNIT_COLOR } from '../lib/shopping-format';
import { countBy, labelFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useActiveWorkspace } from '../../workspaces/api';
import { useShoppingData, useShoppingLists, useShoppingMutations } from '../api';
import { ShoppingCategories } from './ShoppingCategories';
import { useSheets } from '../../sheets/api';

/**
 * Settings of the shopping pages (the page of the lists and the page of a list): the categories (a tree), the stores,
 * the units and the storage modes.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function ShoppingSettings() {
  const { perso } = useActiveWorkspace();
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const mutations = useShoppingMutations();
  const { data: sheets } = useSheets();
  const rows = [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items)];
  // The categories are those of the sheets too.
  const categoryRows = [...rows, ...(sheets ?? []).flatMap((sheet) => sheet.items)];
  return (
    <PageSettings title="Paramètres des achats">
      <Stack gap="md">
        <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={countBy(categoryRows, (row) => row.categoryId)} />
        <SettingsList
          kind="SHOPPING_STORE"
          title="Magasins"
          description={perso ? 'Où vous achetez les produits.' : 'Magasins et fournisseurs des produits.'}
          noun="le magasin"
          usageNoun="produits"
          items={data?.shoppingStores ?? []}
          usage={countBy(rows, (row) => row.storeId)}
          schema={labelFormSchema}
          {...listMutations({ create: mutations.createStore, update: mutations.updateStore, remove: mutations.deleteStore })}
        />
        <SettingsList
          kind="SHOPPING_UNIT"
          title="Unités"
          description="Unités de quantité des produits (kg, boîte, bouteille…). Renommer une unité la renomme dans les produits et les listes."
          noun="l’unité"
          usageNoun="produits"
          items={data?.shoppingUnits ?? []}
          usage={new Map((data?.shoppingUnits ?? []).map((unit) => [unit.id, rows.filter((row) => row.unit === unit.name).length]))}
          withColor={false}
          schema={labelFormSchema.pick({ name: true })}
          {...listMutations({ create: mutations.createUnit, update: mutations.updateUnit, remove: mutations.deleteUnit }, (values) => ({
            name: values.name,
            color: UNIT_COLOR,
          }))}
        />
        <SettingsList
          kind="SHOPPING_STORAGE"
          title="Modes de conservation"
          description="Comment se conservent les produits périssables : frais, congélation, à l’abri de la lumière…"
          noun="le mode de conservation"
          usageNoun="produits"
          items={data?.shoppingStorages ?? []}
          usage={countBy(rows, (row) => row.storageId)}
          schema={labelFormSchema}
          {...listMutations({ create: mutations.createStorage, update: mutations.updateStorage, remove: mutations.deleteStorage })}
        />
      </Stack>
    </PageSettings>
  );
}
