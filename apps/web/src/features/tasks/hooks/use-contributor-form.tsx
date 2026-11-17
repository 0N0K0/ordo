import { openFormPanel } from '../../../components/panels/panels';
import type { Contributor } from '../api';
import { ContributorForm } from '../components/ContributorForm';

/**
 * Opens the contributor creation / edition form in the side panel.
 * @returns {(contributor?: Contributor, defaultProjectIds?: string[]) => void} Opener.
 */
export function useContributorForm() {
  return (contributor?: Contributor, defaultProjectIds?: string[]) => {
    openFormPanel(contributor ? 'Modifier le contributeur' : 'Nouveau contributeur', (close) => <ContributorForm contributor={contributor} defaultProjectIds={defaultProjectIds} onDone={close} />);
  };
}
