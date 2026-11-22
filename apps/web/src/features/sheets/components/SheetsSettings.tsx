import { Stack } from '@mantine/core';
import { countBy, labelFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { ShoppingCategories } from '../../shopping/components/ShoppingCategories';
import { ShoppingUnits } from '../../shopping/components/ShoppingUnits';
import { useSheetCategories, useSheetMutations, useSheets } from '../api';

/**
 * Settings of the sheets: their own categories, then the categories of the items and the units (those of the
 * shopping, also in the shopping settings). In the settings of the sheets pages and in the sheets tab of a project.
 * @returns {JSX.Element} Settings.
 */
export function SheetsSettings() {
  const { data: sheets } = useSheets();
  const { data: sheetCategories } = useSheetCategories();
  const mutations = useSheetMutations();
  const sheetUsage = countBy(sheets ?? [], (sheet) => sheet.categoryIds);
  return (
    <Stack gap="md">
      <SettingsList
        kind="SHEET_CATEGORY"
        title="Catégories de fiches"
        description="Classent les fiches (recettes, valises, trousses…) : une fiche peut en avoir plusieurs."
        noun="la catégorie"
        feminine
        usageNoun={{ one: 'de la fiche', many: 'fiches' }}
        items={sheetCategories ?? []}
        usage={sheetUsage}
        schema={labelFormSchema}
        {...listMutations({ create: mutations.createCategory, update: mutations.updateCategory, remove: mutations.deleteCategory })}
      />
      <ShoppingCategories />
      <ShoppingUnits />
    </Stack>
  );
}

/**
 * Settings of the sheets pages (the page of the sheets and the page of a sheet), in the settings sidebar.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function SheetsPageSettings() {
  return (
    <PageSettings title="Paramètres des fiches">
      <SheetsSettings />
    </PageSettings>
  );
}
