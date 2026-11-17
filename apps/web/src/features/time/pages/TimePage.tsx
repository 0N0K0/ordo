import { PageHeader } from '../../../components/actions/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { Badge, CloseButton, Group, Stack, Title, Tooltip } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { taskRef, useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimer, useTimeEntriesSince } from '../api';
import { openTimerForm } from '../lib/open-timer-form';
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
  const running = useRunningTimer();
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context);
  // From the « Temps passé » of a task: its times only, until dismissed.
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');
  const task = taskId ? context?.taskById.get(taskId) : undefined;
  const shown = taskId ? entries.data?.filter((entry) => entry.taskIds.includes(taskId)) : entries.data;

  return (
    <Stack gap="lg">
      <PageHeader title="Chronos" />
      {/* In a personal workspace, slots are no working hours: timers are not compared with them. */}
      {!perso && <PlannedTime />}
      <Title order={2} size="h4">
        Temps passé
      </Title>
      {taskId && (
        <Group gap="xs">
          <Badge
            size="lg"
            variant="light"
            tt="none"
            rightSection={
              <CloseButton
                size="xs"
                aria-label="Voir tous les temps"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete('task');
                  setParams(next, { replace: true });
                }}
              />
            }
          >
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
        actions={
          // One timer runs at a time: the one running shows in the top bar.
          <Group gap="sm" wrap="nowrap">
            <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context}>
              Nouveau temps
            </ActionButton>
            <Tooltip label="Un chrono tourne déjà" disabled={!running.data}>
              <ActionButton icon={<PlayIcon aria-hidden />} onClick={() => context && openTimerForm(context)} disabled={!context || Boolean(running.data)}>
                Lancer un chrono
              </ActionButton>
            </Tooltip>
          </Group>
        }
      />
    </Stack>
  );
}
