import { PageHeader } from '../components/actions/PageHeader';
import { Stack } from '@mantine/core';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TaskSettings } from '../features/tasks/settings/TaskSettings';
import { PageSettings } from '../layouts/PageSettings';

/**
 * Every task, of every project and of none, with their own saved views (filters, groups, the period of the events…).
 * @returns {JSX.Element} Page.
 */
export function TasksPage() {
  return (
    <Stack gap="md">
      <PageHeader title="Tâches" />
      {/* Statuses, priorities, types, tags and columns of the tasks: in the settings sidebar, as on every page. */}
      <PageSettings title="Paramètres des tâches">
        <TaskSettings />
      </PageSettings>
      <TaskBoard projectId={null} emptyMessage="Aucune tâche." title="Tâches" />
    </Stack>
  );
}
