import { Stack } from '@mantine/core';
import { LabelManager } from '../../components/settings/LabelManager';
import { PageSettings } from '../../layouts/PageSettings';
import { ShoppingCategories } from '../shopping/ShoppingCategories';
import { useShoppingData, useShoppingLists } from '../shopping/api';
import { useSheetCategories, useSheetMutations, useSheets } from './api';

/**
 * Settings of the sheets: their own categories, and the categories of the items (those of the shopping, also in the
 * shopping settings).
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function SheetsSettings() {
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const { data: sheets } = useSheets();
  const { data: sheetCategories } = useSheetCategories();
  const mutations = useSheetMutations();
  const sheetUsage = new Map<string, number>();
  for (const sheet of sheets ?? []) for (const id of sheet.categoryIds) sheetUsage.set(id, (sheetUsage.get(id) ?? 0) + 1);
  const usage = new Map<string, number>();
  for (const row of [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items), ...(sheets ?? []).flatMap((sheet) => sheet.items)]) {
    if (row.categoryId) usage.set(row.categoryId, (usage.get(row.categoryId) ?? 0) + 1);
  }
  return (
    <PageSettings title="Paramètres des fiches">
      <Stack gap="md">
        <LabelManager
          title="Catégories de fiches"
          description="Classent les fiches (recettes, valises, trousses…) : une fiche peut en avoir plusieurs."
          noun="la catégorie"
          usageNoun="fiches"
          labels={sheetCategories ?? []}
          usage={sheetUsage}
          create={mutations.createCategory}
          update={mutations.updateCategory}
          remove={mutations.deleteCategory}
          move={mutations.moveCategory}
        />
        <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={usage} />
      </Stack>
    </PageSettings>
  );
}
