import { Stack } from '@mantine/core';
import { PageHeader } from '../../components/actions/PageHeader';
import { SheetsSettings } from './SheetsSettings';
import { SheetsTable } from './SheetsTable';

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
