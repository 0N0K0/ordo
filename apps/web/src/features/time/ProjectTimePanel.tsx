import { Button, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { entrySeconds, formatDuration } from '@ordo/shared';
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

  const finished = (entries.data ?? []).filter((entry) => entry.endedAt !== null);
  const total = finished.reduce((sum, entry) => sum + entrySeconds(entry), 0);
  const unbilled = finished.filter((entry) => !entry.documentId).reduce((sum, entry) => sum + entrySeconds(entry), 0);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Title order={2} size="h4">
            Temps passé
          </Title>
          <Text size="sm" c="dimmed">
            Projet et sous-projets : {formatDuration(total)} au total
            {total > 0 && (unbilled > 0 ? `, dont ${formatDuration(unbilled)} à facturer (depuis une facture, « Temps passé »)` : ', tout est facturé')}.
          </Text>
        </Stack>
        {/* One timer runs at a time: the one running shows in the top bar. */}
        <Group gap="sm">
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
      </Group>
      <TimeLog entries={entries.data} context={context} projectId={projectId} emptyMessage="Aucun temps sur ce projet." onEdit={openForm} onDuplicate={duplicate} onDelete={confirmDelete} />
    </Stack>
  );
}
