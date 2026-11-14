import { closePanel, openPanel } from '../../components/panels/panels';
import { NewListForm } from './NewListForm';

/**
 * Opens the form of a new list.
 * @param {{ baseListIds?: string[], taskIds?: string[], projectIds?: ReadonlySet<string> }} [options] Base lists whose missing products it takes, tasks, projects it is made for (one of their tasks asked). Optional.
 * @returns {void}
 */
export function openNewList({ baseListIds = [], taskIds = [], projectIds }: { baseListIds?: string[]; taskIds?: string[]; projectIds?: ReadonlySet<string> } = {}): void {
  const modalId = 'new-shopping-list';
  openPanel({
    panelId: modalId,
    title: 'Nouvelle liste',
    children: <NewListForm baseListIds={baseListIds} taskIds={taskIds} projectIds={projectIds} onDone={() => closePanel(modalId)} />,
  });
}
