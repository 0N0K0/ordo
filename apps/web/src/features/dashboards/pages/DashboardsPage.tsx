import { PAGES } from '../../../app/pages';
import { PageHeader } from '../../../components/page/PageHeader';
import { Stack } from '@mantine/core';
import { DashboardBoard } from '../components/DashboardBoard';

/**
 * Global dashboards: charts on every task.
 * @returns {JSX.Element} Page.
 */
export function DashboardsPage() {
  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.dashboards.label} />
      <DashboardBoard projectId={null} title="Tous les projets" />
    </Stack>
  );
}
