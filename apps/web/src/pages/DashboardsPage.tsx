import { Stack } from '@mantine/core';
import { DashboardBoard } from '../features/dashboards/DashboardBoard';
import { PageTitle } from '../components/PageTitle';

/**
 * Global dashboards: charts on every task.
 * @returns {JSX.Element} Page.
 */
export function DashboardsPage() {
  return (
    <Stack gap="lg">
      <PageTitle>Tableaux de bord</PageTitle>
      <DashboardBoard projectId={null} baseFilter={null} title="Tous les projets" />
    </Stack>
  );
}
