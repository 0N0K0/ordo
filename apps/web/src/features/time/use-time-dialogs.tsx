import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useTimeMutations, type TimeEntry } from './api';
import { TimeEntryForm } from './TimeEntryForm';

let modalCount = 0;

/**
 * Dialogs of the tracked times: the form adding or editing one, and the confirmation of a deletion.
 * @param {TaskContext | null} context Task context.
 * @param {string} [defaultProjectId] Project of a new time. Optional.
 * @returns {{ openForm: (entry?: TimeEntry) => void, confirmDelete: (entry: TimeEntry) => void }} Openers.
 */
export function useTimeEntryDialogs(context: TaskContext | null, defaultProjectId?: string) {
  const { remove } = useTimeMutations();

  /**
   * Opens the time form.
   * @param {TimeEntry} [entry] Entry to edit. Optional.
   * @returns {void}
   */
  const openForm = (entry?: TimeEntry) => {
    if (!context) return;
    const modalId = `time-entry-${++modalCount}`;
    modals.open({
      modalId,
      title: entry ? 'Modifier le temps' : 'Ajouter un temps',
      size: 'lg',
      children: <TimeEntryForm context={context} entry={entry} defaultProjectId={defaultProjectId} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a time.
   * @param {TimeEntry} entry Entry.
   * @returns {void}
   */
  const confirmDelete = (entry: TimeEntry) => {
    const modalId = `delete-time-${entry.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le temps',
      children: (
        <Stack gap="md">
          <Text size="sm">Ce temps ({formatDuration(entrySeconds(entry))}) sera supprimé définitivement et retiré du temps passé de ses tâches. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(entry.id, {
                onSuccess: () => notifySuccess('Temps supprimé.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  return { openForm, confirmDelete };
}
