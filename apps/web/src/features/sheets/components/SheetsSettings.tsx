import { Stack } from '@mantine/core';
import { countBy, labelFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { ShoppingCategories } from '../../shopping/components/ShoppingCategories';
import { useShoppingData, useShoppingLists } from '../../shopping/api';
import { useSheetCategories, useSheetMutations, useSheets } from '../api';

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
  const sheetUsage = countBy(sheets ?? [], (sheet) => sheet.categoryIds);
  const usage = countBy([...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items), ...(sheets ?? []).flatMap((sheet) => sheet.items)], (row) => row.categoryId);
  return (
    <PageSettings title="Paramètres des fiches">
      <Stack gap="md">
        <SettingsList
          kind="SHEET_CATEGORY"
          title="Catégories de fiches"
          description="Classent les fiches (recettes, valises, trousses…) : une fiche peut en avoir plusieurs."
          noun="la catégorie"
          usageNoun="fiches"
          items={sheetCategories ?? []}
          usage={sheetUsage}
          schema={labelFormSchema}
          {...listMutations({ create: mutations.createCategory, update: mutations.updateCategory, remove: mutations.deleteCategory })}
        />
        <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={usage} />
      </Stack>
    </PageSettings>
  );
}
