import { modals } from '@mantine/modals';
import { NewListForm } from './NewListForm';

/**
 * Opens the form of a new list.
 * @param {{ fromMissing?: boolean, missingCount: number, taskId?: string | null }} options Defaults.
 * @returns {void}
 */
export function openNewList({ fromMissing = true, missingCount, taskId = null }: { fromMissing?: boolean; missingCount: number; taskId?: string | null }): void {
  const modalId = 'new-shopping-list';
  modals.open({
    modalId,
    title: 'Nouvelle liste',
    children: <NewListForm fromMissing={fromMissing} missingCount={missingCount} taskId={taskId} onDone={() => modals.close(modalId)} />,
  });
}
