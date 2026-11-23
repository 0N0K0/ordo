import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';

import { DURATION_MAX_SECONDS, DURATION_MIN_SECONDS, entrySeconds, formatDuration } from '@ordo/shared';

import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useQueryClient } from '@tanstack/react-query';
import type { DuplicateOptions } from '../../../components/data-table/selection/selection-actions';
import { cachedItem } from '../../../lib/mutation';
import { timeQueryKey, useTimeMutations, type TimeEntry } from '../api';
import { TimeEntryForm } from '../components/TimeEntryForm';
import { parseEventKeys, entryEventKeys } from '../lib/time-events';
import { endTimerByHand } from './use-stop-timer';

/**
 * Dialogs of the tracked times: the form adding or editing one, and the confirmation of a deletion.
 * @param {TaskContext | null} context Task context.
 * @param {string} [defaultProjectId] Project of a new time. Optional.
 * @returns {{ openForm: (entry?: TimeEntry) => void, duplicate: DuplicateOptions<TimeEntry, string>, confirmDelete: (entry: TimeEntry) => void }} Openers, and « Dupliquer ».
 */
export function useTimeEntryDialogs(context: TaskContext | null, defaultProjectId?: string) {
  const { create, remove } = useTimeMutations();
  const queryClient = useQueryClient();

  /**
   * Opens the time form.
   * @param {TimeEntry} [entry] Entry to edit. Optional.
   * @returns {void}
   */
  const openForm = (entry?: TimeEntry) => {
    if (!context) return;
    openFormPanel(entry ? 'Temps' : 'Ajouter un temps', (close) => <TimeEntryForm context={context} entry={entry} defaultProjectId={defaultProjectId} onDone={close} />);
  };

  /** « Dupliquer » a time: saved at once (not billed, 1 minute to 24 hours), then its form opens. */
  const duplicate: DuplicateOptions<TimeEntry, string> = {
    duplicate: async (entry) =>
      (
        await create.mutateAsync({
          projectId: entry.projectId ?? null,
          routineIds: entry.routines.map((routine) => routine.id),
          taskIds: entry.taskIds,
          description: entry.description ?? '',
          startedAt: entry.startedAt,
          // A time added lasts 1 minute to 24 hours: a timer stopped under a minute is copied as 1 minute.
          duration: Math.min(DURATION_MAX_SECONDS, Math.max(DURATION_MIN_SECONDS, entrySeconds(entry))),
          events: parseEventKeys(entryEventKeys(entry)),
        })
      ).id,
    done: 'Temps dupliqué.',
    open: (id) => {
      const copy = cachedItem(queryClient, timeQueryKey, id, (entries: TimeEntry[] | TimeEntry | null) => (Array.isArray(entries) ? entries : []));
      if (copy) openForm(copy);
    },
  };

  /**
   * Asks for confirmation before deleting a time.
   * @param {TimeEntry} entry Entry.
   * @returns {void}
   */
  const confirmDelete = (entry: TimeEntry) => {
    confirmDestructive({
      title: 'Supprimer le temps',
      risks: `Ce temps (${formatDuration(entrySeconds(entry))}) sera supprimé définitivement et retiré du temps passé de ses tâches.`,
      // A running one deleted is ended by hand: not told as stopped after 24 hours.
      run: () => endTimerByHand(entry.id, () => remove.mutateAsync(entry.id)),
      done: 'Temps supprimé.',
    });
  };

  return { openForm, duplicate, confirmDelete };
}
