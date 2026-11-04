import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import { useTaskContext } from '../tasks/use-task-context';
import { useTimeEntries } from './api';
import { TimeLog } from './TimeLog';
import { TimerCard } from './TimerCard';
import { useTimeEntryDialogs } from './use-time-dialogs';

/**
 * Time tab of a project: the timer, time added by hand, and the tracked times of the project and its
 * sub-projects by day, with day and overall totals and what is billed.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectTimePanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const entries = useTimeEntries(projectId);
  const { openForm, confirmDelete } = useTimeEntryDialogs(context, projectId);
  const archived = context?.projectById.get(projectId)?.archived;

  const finished = (entries.data ?? []).filter((entry) => entry.endedAt !== null);
  const total = finished.reduce((sum, entry) => sum + entrySeconds(entry), 0);
  const unbilled = finished.filter((entry) => !entry.documentId).reduce((sum, entry) => sum + entrySeconds(entry), 0);

  return (
    <Stack gap="lg">
      {!archived && <TimerCard projectId={projectId} />}
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
        <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context || archived}>
          Ajouter un temps
        </Button>
      </Group>
      <TimeLog entries={entries.data} context={context} projectId={projectId} emptyMessage="Aucun temps sur ce projet." onEdit={openForm} onDelete={confirmDelete} />
    </Stack>
  );
}
