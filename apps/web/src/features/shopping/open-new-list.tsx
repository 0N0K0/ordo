import { modals } from '@mantine/modals';
import { NewListForm } from './NewListForm';

/**
 * Opens the form of a new list.
 * @param {{ baseListIds?: string[], taskId?: string | null }} [options] Base lists whose missing products it takes, task. Optional.
 * @returns {void}
 */
export function openNewList({ baseListIds = [], taskId = null }: { baseListIds?: string[]; taskId?: string | null } = {}): void {
  const modalId = 'new-shopping-list';
  modals.open({
    modalId,
    title: 'Nouvelle liste',
    children: <NewListForm baseListIds={baseListIds} taskId={taskId} onDone={() => modals.close(modalId)} />,
  });
}
