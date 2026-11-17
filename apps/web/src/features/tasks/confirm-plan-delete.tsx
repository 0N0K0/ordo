import { Text } from '@mantine/core';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { countOf } from '../../lib/text';

/**
 * Asks before deleting what plans tasks (a milestone, a sprint): the tasks stay, without it.
 * @param {object} options What is deleted.
 * @param {string} options.title Title of the confirmation (« Supprimer le jalon »).
 * @param {string} options.what What is deleted (« Le jalon « V2 » »).
 * @param {number} options.count Tasks planned with it.
 * @param {string} options.link How the tasks hold it (« qui l’utilisent »).
 * @param {string} options.done Success message.
 * @param {() => Promise<unknown>} options.remove Deletes it.
 * @returns {void}
 */
export function confirmPlanDelete({ title, what, count, link, done, remove }: { title: string; what: string; count: number; link: string; done: string; remove: () => Promise<unknown> }): void {
  confirmDestructive({
    title,
    risks: (
      <Text size="sm">
        {what} sera supprimé définitivement{count > 0 ? ` et retiré des ${countOf(count, 'tâche')} ${link}` : ''}. Les tâches ne sont pas supprimées. Cette action est irréversible.
      </Text>
    ),
    onConfirm: () => {
      remove().then(() => notifySuccess(done), onMutationError);
    },
  });
}
