import { PAGES } from '../../../app/pages';
import { Stack } from '@mantine/core';
import { PageHeader } from '../../../components/page/PageHeader';
import { SheetsSettings } from '../components/SheetsSettings';
import { SheetsTable } from '../components/SheetsTable';

/**
 * Sheets page: every sheet (a recipe, the content of a suitcase…), and their settings.
 * @returns {JSX.Element} Page.
 */
export function SheetsPage() {
  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.sheets.label} />
      <SheetsTable />
      <SheetsSettings />
    </Stack>
  );
}
