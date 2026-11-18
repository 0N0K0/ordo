import { SegmentedControl, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { ChartConfig } from '@ordo/shared';
import { DOCUMENT_TYPE_LABELS } from '../../accounting/lib/labels';
import { useDocumentStatuses } from '../../accounting/api/tracking';
import { useTreasuryAccounts, useTreasurySettings } from '../../treasury/api';
import { useWorkspace } from '../../workspace/api';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeOptions, treeSelectProps } from '../../../components/tree/tree-select';
import { categoryPaths, categoryTree } from '../../treasury/lib/categories';
import { TaskFilterBuilder } from '../../tasks/components/TaskFilterBuilder';
import type { TaskContext } from '../../tasks/hooks/use-task-context';

/** Filters of the records of a chart (or of one of its data sets), whatever its source. */
type SourceFilterFields = Pick<ChartConfig, 'search' | 'filter' | 'includeArchived' | 'documents' | 'treasury'>;

/** Change of the filters of a chart (or of one of its data sets). */
type SourceFilterChange = (changes: Partial<SourceFilterFields>) => void;

/**
 * Filters of a document chart: types, clients, tracking statuses, drafts, imported documents, credit notes.
 * @param {{ config: Pick<ChartConfig, 'documents' | 'treasury'>, change: SourceFilterChange }} props Configuration and update.
 * @returns {JSX.Element} Filters.
 */
function DocumentFilters({ config, change }: { config: Pick<ChartConfig, 'documents' | 'treasury'>; change: SourceFilterChange }) {
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
 * @param {{ config: Pick<ChartConfig, 'documents' | 'treasury'>, change: SourceFilterChange }} props Configuration and update.
 * @returns {JSX.Element} Filters.
 */
function TreasuryFilters({ config, change }: { config: Pick<ChartConfig, 'documents' | 'treasury'>; change: SourceFilterChange }) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: settings } = useTreasurySettings();
  // By full path (a category also keeps the movements of its sub-categories), in tree order under Recettes and Dépenses.
  const all = settings?.treasuryCategories ?? [];
  const paths = categoryPaths(all);
  const categories = treeOptions(
    [
      { id: 'direction:IN', parentId: null, label: 'Recettes', pathless: true },
      { id: 'direction:OUT', parentId: null, label: 'Dépenses', pathless: true },
      ...categoryTree(all).map(({ category, path }) => ({
        id: path,
        parentId: category.parentId ? (paths.get(category.parentId) ?? null) : `direction:${category.direction}`,
        label: category.name,
        color: category.color,
      })),
    ],
    (id) => !id.startsWith('direction:'),
  );
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
      <BatchMultiSelect label="Catégories" placeholder="Toutes" searchable {...treeSelectProps(categories)} value={filter.categories} onChange={(selected) => set({ categories: selected })} />
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

/**
 * Filters of the records a chart (or one of its data sets) counts, by its source: search, task filter and archived tasks
 * (tasks), the document filters (billing) or the movement filters (treasury).
 * @param {{ source: ChartConfig['source'], config: SourceFilterFields, context: TaskContext, change: SourceFilterChange }} props Source, filters,
 *   task context and update.
 * @returns {JSX.Element | null} Filters.
 */
export function SourceFilters({ source, config, context, change }: { source: ChartConfig['source']; config: SourceFilterFields; context: TaskContext; change: SourceFilterChange }) {
  if (source === 'documents') return <DocumentFilters config={config} change={change} />;
  if (source === 'treasury') return <TreasuryFilters config={config} change={change} />;
  return (
    <>
      <TextInput placeholder="Recherche (titre, description)" value={config.search} onChange={(event) => change({ search: event.currentTarget.value })} />
      <TaskFilterBuilder filter={config.filter} context={context} onChange={(filter) => change({ filter })} />
      <Switch label="Inclure les tâches archivées" checked={config.includeArchived} onChange={(event) => change({ includeArchived: event.currentTarget.checked })} />
    </>
  );
}
