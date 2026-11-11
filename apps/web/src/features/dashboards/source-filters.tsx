import { SegmentedControl, Stack, Switch, Text } from '@mantine/core';
import type { ChartConfig } from '@ordo/shared';
import { DOCUMENT_TYPE_LABELS } from '../accounting/labels';
import { useDocumentStatuses } from '../accounting/tracking-api';
import { useTreasuryAccounts, useTreasurySettings } from '../treasury/api';
import { useWorkspace } from '../workspace/api';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';

/**
 * Filters of a document chart: types, clients, tracking statuses, drafts, imported documents, credit notes.
 * @param {{ config: ChartConfig, change: (changes: Partial<ChartConfig>) => void }} props Configuration and update.
 * @returns {JSX.Element} Filters.
 */
export function DocumentFilters({ config, change }: { config: Pick<ChartConfig, 'documents' | 'treasury'>; change: (changes: Partial<ChartConfig>) => void }) {
  const { data: workspace } = useWorkspace();
  const { data: statuses } = useDocumentStatuses();
  const filter = config.documents;
  const set = (changes: Partial<ChartConfig['documents']>) => change({ documents: { ...filter, ...changes } });
  return (
    <Stack gap="sm">
      <BatchMultiSelect
        label="Types de documents"
        placeholder="Tous"
        data={(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] as const).map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }))}
        value={filter.types}
        onChange={(types) => set({ types: types as ChartConfig['documents']['types'] })}
      />
      <BatchMultiSelect
        label="Clients"
        placeholder="Tous"
        searchable
        data={(workspace?.clients ?? []).map((client) => ({
          value: client.id,
          label: client.name,
        }))}
        value={filter.clientIds}
        onChange={(clientIds) => set({ clientIds })}
      />
      <BatchMultiSelect
        label="Statuts de suivi"
        placeholder="Tous"
        data={(statuses ?? []).map((status) => ({
          value: status.id,
          label: `${status.name} (${status.scope === 'QUOTE' ? 'devis' : 'factures'})`,
        }))}
        value={filter.statusIds}
        onChange={(statusIds) => set({ statusIds })}
      />
      <Switch label="Avoirs en négatif (chiffre d’affaires net)" checked={filter.creditNotesNegative} onChange={(event) => set({ creditNotesNegative: event.currentTarget.checked })} />
      <Switch label="Inclure les documents importés" checked={filter.includeImported} onChange={(event) => set({ includeImported: event.currentTarget.checked })} />
      <Switch label="Inclure les brouillons" checked={filter.includeDrafts} onChange={(event) => set({ includeDrafts: event.currentTarget.checked })} />
    </Stack>
  );
}

/**
 * Filters of a treasury chart: accounts, categories, money in or out, expected movements.
 * @param {{ config: ChartConfig, change: (changes: Partial<ChartConfig>) => void }} props Configuration and update.
 * @returns {JSX.Element} Filters.
 */
export function TreasuryFilters({ config, change }: { config: Pick<ChartConfig, 'documents' | 'treasury'>; change: (changes: Partial<ChartConfig>) => void }) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: settings } = useTreasurySettings();
  // By name: a category also keeps the movements of its sub-categories.
  const categories = [...new Set((settings?.treasuryCategories ?? []).map((category) => category.name))].sort((a, b) => a.localeCompare(b, 'fr'));
  const filter = config.treasury;
  const set = (changes: Partial<ChartConfig['treasury']>) => change({ treasury: { ...filter, ...changes } });
  return (
    <Stack gap="sm">
      <BatchMultiSelect
        label="Comptes"
        placeholder="Tous"
        data={(accounts ?? []).map((account) => ({
          value: account.id,
          label: account.name,
        }))}
        value={filter.accountIds}
        onChange={(accountIds) => set({ accountIds })}
      />
      <BatchMultiSelect label="Catégories" placeholder="Toutes" searchable data={categories} value={filter.categories} onChange={(selected) => set({ categories: selected })} />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Mouvements
        </Text>
        <SegmentedControl
          data={[
            { value: 'all', label: 'Tous' },
            { value: 'in', label: 'Entrées' },
            { value: 'out', label: 'Sorties' },
          ]}
          value={filter.direction}
          onChange={(direction) =>
            set({
              direction: direction as ChartConfig['treasury']['direction'],
            })
          }
        />
      </Stack>
      <Switch
        label="Inclure le prévisionnel (prévisions, factures à encaisser, factures récurrentes à venir)"
        checked={filter.includeForecast}
        onChange={(event) => set({ includeForecast: event.currentTarget.checked })}
      />
    </Stack>
  );
}
