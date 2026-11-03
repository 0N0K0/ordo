import { Select, Stack } from '@mantine/core';
import { STATUS_CATEGORIES_BY_SCOPE, type DocumentStatusCategory, type DocumentStatusScope } from '@ordo/shared';
import { LabelManager } from '../../components/settings/LabelManager';
import { notifyError } from '../../lib/notify';
import { useDocumentStatusMutations, useDocumentStatuses, type DocumentStatus } from './tracking-api';

const DESCRIPTIONS: Record<DocumentStatusScope, string> = {
  QUOTE:
    'Statuts des devis validés. La catégorie règle le suivi automatique : « À envoyer » à la validation, « Envoyé » à l’envoi par mail, « Accepté » quand le devis signé est enregistré. Un devis encore à envoyer ou envoyé après sa date de validité est signalé expiré.',
  INVOICE:
    'Statuts des factures, factures d’acompte et avoirs validés. « À envoyer » à la validation, « Envoyée » à l’envoi par mail, « Payée » dès que le reste dû est nul (paiements et avoirs). Une facture non payée après son échéance est signalée en retard.',
};

/**
 * Configurable statuses of one scope, with the category each one stands for.
 * @param {{ scope: DocumentStatusScope, statuses: DocumentStatus[] }} props Component props.
 * @returns {JSX.Element} Manager.
 */
function ScopeStatuses({ scope, statuses }: { scope: DocumentStatusScope; statuses: DocumentStatus[] }) {
  const mutations = useDocumentStatusMutations(scope);
  return (
    <LabelManager
      title={scope === 'QUOTE' ? 'Statuts des devis' : 'Statuts des factures'}
      description={DESCRIPTIONS[scope]}
      noun="le statut"
      usageNoun="documents"
      labels={statuses}
      usage={new Map(statuses.map((status) => [status.id, status.documentCount]))}
      create={mutations.create}
      update={mutations.update}
      remove={mutations.remove}
      move={mutations.move}
      renderExtra={(label) => (
        <Select
          aria-label={`Catégorie du statut ${label.name}`}
          data={STATUS_CATEGORIES_BY_SCOPE[scope]}
          value={statuses.find((status) => status.id === label.id)?.category ?? 'SENT'}
          allowDeselect={false}
          onChange={(category) =>
            category &&
            mutations.update.mutate({ id: label.id, input: { category: category as DocumentStatusCategory } }, { onError: (error) => notifyError(error.message) })
          }
          w={130}
        />
      )}
    />
  );
}

/**
 * Settings of the tracking statuses of quotes and invoices.
 * @returns {JSX.Element} Settings.
 */
export function DocumentStatusSettings() {
  const { data } = useDocumentStatuses();
  const statuses = data ?? [];
  return (
    <Stack gap="lg">
      <ScopeStatuses scope="QUOTE" statuses={statuses.filter((status) => status.scope === 'QUOTE')} />
      <ScopeStatuses scope="INVOICE" statuses={statuses.filter((status) => status.scope === 'INVOICE')} />
    </Stack>
  );
}
