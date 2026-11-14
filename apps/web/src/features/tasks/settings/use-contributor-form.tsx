import { closePanel, openPanel } from '../../../components/panels/panels';
import type { Contributor } from '../api';
import { ContributorForm } from './ContributorForm';

let modalCount = 0;

/**
 * Opens the contributor creation / edition form in the side panel.
 * @returns {(contributor?: Contributor, defaultProjectIds?: string[]) => void} Opener.
 */
export function useContributorForm() {
  return (contributor?: Contributor, defaultProjectIds?: string[]) => {
    const modalId = `contributor-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: contributor ? 'Modifier le contributeur' : 'Nouveau contributeur',
      children: <ContributorForm contributor={contributor} defaultProjectIds={defaultProjectIds} onDone={() => closePanel(modalId)} />,
    });
  };
}
