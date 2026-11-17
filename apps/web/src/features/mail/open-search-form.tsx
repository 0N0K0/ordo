import { openFormPanel } from '../../components/panels/panels';
import type { MailSearchCriteria } from '@ordo/shared';
import type { MailSearch } from './api';
import { MailSearchForm } from './MailSearchForm';

/**
 * Opens the form of a search folder.
 * @param {MailSearch | undefined} search Search edited (none: new).
 * @param {(id: string) => void} [onCreated] Called with the id of a new search. Optional.
 * @param {MailSearchCriteria} [initial] Criteria of a new search (an advanced search saved). Optional.
 * @returns {void}
 */
export function openSearchForm(search: MailSearch | undefined, onCreated?: (id: string) => void, initial?: MailSearchCriteria): void {
  openFormPanel(search ? 'Modifier le dossier de recherche' : 'Nouveau dossier de recherche', (close) => (
    <MailSearchForm
      search={search}
      initial={initial}
      onDone={(id) => {
        close();
        if (id) onCreated?.(id);
      }}
    />
  ));
}
