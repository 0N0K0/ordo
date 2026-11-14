import { closePanel, openPanel } from '../../components/panels/panels';
import type { MailSearchCriteria } from '@ordo/shared';
import type { MailSearch } from './api';
import { MailSearchForm } from './MailSearchForm';

let modalCount = 0;

/**
 * Opens the form of a search folder.
 * @param {MailSearch | undefined} search Search edited (none: new).
 * @param {(id: string) => void} [onCreated] Called with the id of a new search. Optional.
 * @param {MailSearchCriteria} [initial] Criteria of a new search (an advanced search saved). Optional.
 * @returns {void}
 */
export function openSearchForm(search: MailSearch | undefined, onCreated?: (id: string) => void, initial?: MailSearchCriteria): void {
  const modalId = `mail-search-${++modalCount}`;
  openPanel({
    panelId: modalId,
    title: search ? 'Modifier le dossier de recherche' : 'Nouveau dossier de recherche',
    children: (
      <MailSearchForm
        search={search}
        initial={initial}
        onDone={(id) => {
          closePanel(modalId);
          if (id) onCreated?.(id);
        }}
      />
    ),
  });
}
