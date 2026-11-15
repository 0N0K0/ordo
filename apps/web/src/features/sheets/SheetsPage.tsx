import { Stack } from '@mantine/core';
import { PageHeader } from '../../components/actions/PageHeader';
import { PageSettings } from '../../layouts/PageSettings';
import { ShoppingCategories } from '../shopping/ShoppingCategories';
import { useShoppingData, useShoppingLists } from '../shopping/api';
import { useSheets } from './api';
import { SheetsTable } from './SheetsTable';

/**
 * Settings of the sheets: the categories, the same as those of the shopping (also in the shopping settings).
 * @returns {JSX.Element} Settings, in the sidebar.
 */
function SheetsSettings() {
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const { data: sheets } = useSheets();
  const usage = new Map<string, number>();
  for (const row of [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items), ...(sheets ?? []).flatMap((sheet) => sheet.items)]) {
    if (row.categoryId) usage.set(row.categoryId, (usage.get(row.categoryId) ?? 0) + 1);
  }
  return (
    <PageSettings title="Paramètres des fiches">
      <Stack gap="md">
        <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={usage} />
      </Stack>
    </PageSettings>
  );
}

/**
 * Sheets page: every sheet (a recipe, the content of a suitcase…), and their settings.
 * @returns {JSX.Element} Page.
 */
export function SheetsPage() {
  return (
    <Stack gap="lg">
      <PageHeader title="Fiches" />
      <SheetsTable />
      <SheetsSettings />
    </Stack>
  );
}
