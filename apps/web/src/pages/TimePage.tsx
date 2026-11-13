import { Button, Group, Stack, Title, Tooltip } from '@mantine/core';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useRunningTimer, useTimeEntriesSince } from '../features/time/api';
import { openTimerForm } from '../features/time/open-timer-form';
import { PlannedTime } from '../features/time/PlannedTime';
import { TimeLog } from '../features/time/TimeLog';
import { useTimeEntryDialogs } from '../features/time/use-time-dialogs';
import { useActiveWorkspace } from '../features/workspaces/api';
import { PageTitle } from '../components/PageTitle';

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
  const running = useRunningTimer();
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context);

  return (
    <Stack gap="lg">
      <PageTitle>Chronos</PageTitle>
      {/* In a personal workspace, slots are no working hours: timers are not compared with them. */}
      {!perso && <PlannedTime />}
      <Title order={2} size="h4">
        Temps passé
      </Title>
      <TimeLog
        entries={entries.data}
        context={context}
        projectId={null}
        emptyMessage="Aucun temps pour le moment."
        onEdit={openForm}
        onDuplicate={duplicate}
        onDelete={confirmDelete}
        actions={
          // One timer runs at a time: the one running shows in the top bar.
          <Group gap="sm" wrap="nowrap">
            <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context}>
              Ajouter un temps
            </Button>
            <Tooltip label="Un chrono tourne déjà" disabled={!running.data}>
              <Button leftSection={<PlayIcon aria-hidden />} onClick={() => context && openTimerForm(context)} disabled={!context || Boolean(running.data)}>
                Lancer un chrono
              </Button>
            </Tooltip>
          </Group>
        }
      />
    </Stack>
  );
}
