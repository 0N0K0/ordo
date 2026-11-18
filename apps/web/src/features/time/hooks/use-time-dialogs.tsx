import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';

import { entrySeconds, formatDuration } from '@ordo/shared';

import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry } from '../api';
import { TimeEntryForm } from '../components/TimeEntryForm';

/**
 * Dialogs of the tracked times: the form adding or editing one, and the confirmation of a deletion.
 * @param {TaskContext | null} context Task context.
 * @param {string} [defaultProjectId] Project of a new time. Optional.
 * @returns {{ openForm: (entry?: TimeEntry, options?: { copy?: boolean }) => void, duplicate: (entry: TimeEntry) => void, confirmDelete: (entry: TimeEntry) => void }} Openers.
 */
export function useTimeEntryDialogs(context: TaskContext | null, defaultProjectId?: string) {
  const { remove } = useTimeMutations();

  /**
   * Opens the time form.
   * @param {TimeEntry} [entry] Entry to edit (or to copy). Optional.
   * @param {{ copy?: boolean }} [options] The entry is copied into a new one. Optional.
   * @returns {void}
   */
  const openForm = (entry?: TimeEntry, { copy = false }: { copy?: boolean } = {}) => {
    if (!context) return;
    openFormPanel(copy ? 'Dupliquer le temps' : entry ? 'Modifier le temps' : 'Ajouter un temps', (close) => (
      <TimeEntryForm context={context} entry={entry} copy={copy} defaultProjectId={defaultProjectId} onDone={close} />
    ));
  };

  /**
   * Opens the time form on a copy of a time.
   * @param {TimeEntry} entry Entry copied.
   * @returns {void}
   */
  const duplicate = (entry: TimeEntry) => openForm(entry, { copy: true });

  /**
   * Asks for confirmation before deleting a time.
   * @param {TimeEntry} entry Entry.
   * @returns {void}
   */
  const confirmDelete = (entry: TimeEntry) => {
    confirmDestructive({
      title: 'Supprimer le temps',
      risks: `Ce temps (${formatDuration(entrySeconds(entry))}) sera supprimé définitivement et retiré du temps passé de ses tâches. Cette action est irréversible.`,
      run: () => remove.mutateAsync(entry.id),
      done: 'Temps supprimé.',
    });
  };

  return { openForm, duplicate, confirmDelete };
}
