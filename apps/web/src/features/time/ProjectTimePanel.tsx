import { Button, Group, Tooltip } from '@mantine/core';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { useTaskContext } from '../tasks/use-task-context';
import { useRunningTimer, useTimeEntries } from './api';
import { openTimerForm } from './open-timer-form';
import { TimeLog } from './TimeLog';
import { useTimeEntryDialogs } from './use-time-dialogs';

/**
 * Time tab of a project: a button starting a timer on it (in a modal), time added by hand, and the tracked times of the project and its
 * sub-projects by day, with day and overall totals and what is billed.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectTimePanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const entries = useTimeEntries(projectId);
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context, projectId);
  const archived = context?.projectById.get(projectId)?.archived;
  const running = useRunningTimer();

  return (
    <TimeLog
      entries={entries.data}
      context={context}
      projectId={projectId}
      emptyMessage="Aucun temps sur ce projet."
      onEdit={openForm}
      onDuplicate={duplicate}
      onDelete={confirmDelete}
      actions={
        // One timer runs at a time: the one running shows in the top bar.
        <Group gap="sm" wrap="nowrap">
          <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context || archived}>
            Ajouter un temps
          </Button>
          {!archived && (
            <Tooltip label="Un chrono tourne déjà" disabled={!running.data}>
              <Button leftSection={<PlayIcon aria-hidden />} onClick={() => context && openTimerForm(context, projectId)} disabled={!context || Boolean(running.data)}>
                Lancer un chrono
              </Button>
            </Tooltip>
          )}
        </Group>
      }
    />
  );
}
