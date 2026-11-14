import { PageHeader } from '../components/actions/PageHeader';
import { Stack } from '@mantine/core';
import { DashboardBoard } from '../features/dashboards/DashboardBoard';

/**
 * Global dashboards: charts on every task.
 * @returns {JSX.Element} Page.
 */
export function DashboardsPage() {
  return (
    <Stack gap="lg">
      <PageHeader title="Tableaux de bord" />
      <DashboardBoard projectId={null} baseFilter={null} title="Tous les projets" />
    </Stack>
  );
}
