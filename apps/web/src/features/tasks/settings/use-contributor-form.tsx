import { modals } from '@mantine/modals';
import type { Contributor } from '../api';
import { ContributorForm } from './ContributorForm';

let modalCount = 0;

/**
 * Opens the contributor creation / edition form in a modal.
 * @returns {(contributor?: Contributor, defaultProjectIds?: string[]) => void} Opener.
 */
export function useContributorForm() {
  return (contributor?: Contributor, defaultProjectIds?: string[]) => {
    const modalId = `contributor-${++modalCount}`;
    modals.open({
      modalId,
      title: contributor ? 'Modifier le contributeur' : 'Nouveau contributeur',
      children: <ContributorForm contributor={contributor} defaultProjectIds={defaultProjectIds} onDone={() => modals.close(modalId)} />,
    });
  };
}
