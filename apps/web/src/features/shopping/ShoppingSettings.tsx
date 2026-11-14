import { Stack } from '@mantine/core';
import { LabelManager } from '../../components/settings/LabelManager';
import { PageSettings } from '../../layouts/PageSettings';
import { useActiveWorkspace } from '../workspaces/api';
import { useShoppingData, useShoppingLists, useShoppingMutations } from './api';
import { ShoppingCategories } from './ShoppingCategories';

/**
 * Number of products and items of each category or store, for the settings.
 * @param {(item: { categoryId?: string | null, storeId?: string | null }) => string | null | undefined} key Category or store of a row.
 * @param {{ categoryId?: string | null, storeId?: string | null }[]} rows Products and items.
 * @returns {Map<string, number>} Usage by id.
 */
function usageOf(
  key: (row: { categoryId?: string | null; storeId?: string | null; storageId?: string | null }) => string | null | undefined,
  rows: { categoryId?: string | null; storeId?: string | null; storageId?: string | null }[],
) {
  const usage = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/**
 * Settings of the shopping pages (the page of the lists and the page of a list): the categories (a tree), the stores
 * and the storage modes.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function ShoppingSettings() {
  const { perso } = useActiveWorkspace();
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const mutations = useShoppingMutations();
  const rows = [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items)];
  return (
    <PageSettings title="Paramètres des achats">
      <Stack gap="md">
        <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={usageOf((row) => row.categoryId, rows)} />
        <LabelManager
          title="Magasins"
          description={perso ? 'Où vous achetez les produits.' : 'Magasins et fournisseurs des produits.'}
          noun="le magasin"
          usageNoun="produits"
          labels={data?.shoppingStores ?? []}
          usage={usageOf((row) => row.storeId, rows)}
          create={mutations.createStore}
          update={mutations.updateStore}
          remove={mutations.deleteStore}
          move={mutations.moveStore}
        />
        <LabelManager
          title="Modes de conservation"
          description="Comment se conservent les produits périssables : frais, congélation, à l’abri de la lumière…"
          noun="le mode de conservation"
          usageNoun="produits"
          labels={data?.shoppingStorages ?? []}
          usage={usageOf((row) => row.storageId, rows)}
          create={mutations.createStorage}
          update={mutations.updateStorage}
          remove={mutations.deleteStorage}
          move={mutations.moveStorage}
        />
      </Stack>
    </PageSettings>
  );
}
