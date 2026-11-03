import { Stack, Title } from '@mantine/core';
import { DashboardBoard } from '../features/dashboards/DashboardBoard';

/**
 * Global dashboards: charts on every task.
 * @returns {JSX.Element} Page.
 */
export function DashboardsPage() {
  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        Tableaux de bord
      </Title>
      <DashboardBoard projectId={null} baseFilter={null} title="Tous les projets" />
    </Stack>
  );
}
