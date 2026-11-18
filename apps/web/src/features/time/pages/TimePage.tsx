import { PAGES } from '../../../app/pages';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { useSetParams } from '../../../lib/search-params';
import { PageHeader } from '../../../components/page/PageHeader';
import { Badge, CloseButton, Group, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { taskRef, useTaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeEntriesSince } from '../api';
import { TimeLogActions } from '../components/TimeLogActions';
import { PlannedTime } from '../components/PlannedTime';
import { TimeLog } from '../components/TimeLog';
import { useTimeEntryDialogs } from '../hooks/use-time-dialogs';
import { useActiveWorkspace } from '../../workspaces/api';

/**
 * Timers of every project: a button starting one (in a modal), planned against tracked time, time added by hand,
 * and the tracked times in a table of saved views (this week, this month, all; by day), filtered by period, project…
 * @returns {JSX.Element} Page.
 */
export function TimePage() {
  const { perso } = useActiveWorkspace();
  const { context } = useTaskContext();
  // Every time: the views choose their period.
  const entries = useTimeEntriesSince(null);
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context);
  // From the « Temps passé » of a task: its times only, until dismissed.
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const taskId = params.get('task');
  const task = taskId ? context?.taskById.get(taskId) : undefined;
  const shown = taskId ? entries.data?.filter((entry) => entry.taskIds.includes(taskId)) : entries.data;

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.time.title} />
      {/* In a personal workspace, slots are no working hours: timers are not compared with them. */}
      {!perso && <PlannedTime />}
      <SectionHeader title="Temps passé" />
      {taskId && (
        <Group gap="xs">
          <Badge size="lg" variant="light" tt="none" rightSection={<CloseButton size="xs" aria-label="Voir tous les temps" onClick={() => setParams({ task: null })} />}>
            Tâche : {task ? `${taskRef(task)}${task.title}` : 'introuvable'}
          </Badge>
        </Group>
      )}
      <TimeLog
        entries={shown}
        context={context}
        projectId={null}
        emptyMessage="Aucun temps pour le moment."
        onEdit={openForm}
        onDuplicate={duplicate}
        onDelete={confirmDelete}
        actions={<TimeLogActions context={context} onNew={() => openForm()} />}
      />
    </Stack>
  );
}
