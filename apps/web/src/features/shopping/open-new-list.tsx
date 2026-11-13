import { closePanel, openPanel } from '../../components/panels/panels';
import { NewListForm } from './NewListForm';

/**
 * Opens the form of a new list.
 * @param {{ baseListIds?: string[], taskIds?: string[] }} [options] Base lists whose missing products it takes, tasks. Optional.
 * @returns {void}
 */
export function openNewList({ baseListIds = [], taskIds = [] }: { baseListIds?: string[]; taskIds?: string[] } = {}): void {
  const modalId = 'new-shopping-list';
  openPanel({
    panelId: modalId,
    title: 'Nouvelle liste',
    children: <NewListForm baseListIds={baseListIds} taskIds={taskIds} onDone={() => closePanel(modalId)} />,
  });
}
