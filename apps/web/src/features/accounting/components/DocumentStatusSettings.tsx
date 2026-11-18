import { Select, Stack } from '@mantine/core';
import { labelFormSchema, STATUS_CATEGORIES_BY_SCOPE, type DocumentStatusCategory, type DocumentStatusScope } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { useDocumentStatusMutations, useDocumentStatuses, type DocumentStatus } from '../api/tracking';

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
    <SettingsList<DocumentStatus, { category: DocumentStatusCategory }>
      kind="DOCUMENT_STATUS"
      title={scope === 'QUOTE' ? 'Statuts des devis' : 'Statuts des factures'}
      description={DESCRIPTIONS[scope]}
      noun="le statut"
      usageNoun="documents"
      items={statuses}
      usage={new Map(statuses.map((status) => [status.id, status.documentCount]))}
      schema={labelFormSchema}
      extra={{
        initial: (status) => ({ category: status?.category ?? 'SENT' }),
        render: (form) => <Select label="Catégorie" data={STATUS_CATEGORIES_BY_SCOPE[scope]} allowDeselect={false} {...form.getInputProps('category')} />,
      }}
      {...listMutations(mutations, (values: { label: string; color: string; category: DocumentStatusCategory }) => ({ label: values.label, color: values.color, category: values.category }))}
      renderBadges={(status) => STATUS_CATEGORIES_BY_SCOPE[scope].find((option) => option.value === status.category)?.label}
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
