import { countBy } from '@ordo/shared';
import { useSetParams } from '../../../lib/search-params';
import { Stack } from '@mantine/core';
import { ArchiveIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../../components/actions/PageHeader';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { PageSettings } from '../../../app/layout/PageSettings';
import * as fmt from '../../../lib/format';
import { useStockCounts, useStockItems, useStockLocations, type StockCount } from '../api';
import { MovementsTable } from '../components/MovementsTable';
import { locationPaths } from '../lib/stock-format';
import { StockLocations } from '../components/StockLocations';
import { StockTable } from '../components/StockTable';

/**
 * Inventories recorded, latest first.
 * @returns {JSX.Element} Table.
 */
function CountsTable() {
  const { data: counts } = useStockCounts();
  const { data: locations } = useStockLocations();
  const places = locationPaths(locations ?? []);
  const columns: DataColumn<StockCount>[] = [
    {
      id: 'date',
      label: 'Date',
      size: 160,
      locked: true,
      sortValue: (count) => String(count.date),
      text: (count) => fmt.dateTime(new Date(count.date)),
      filter: { kind: 'date', value: (count) => String(count.date).slice(0, 10) },
    },
    {
      id: 'location',
      label: 'Emplacement',
      size: 200,
      sortValue: (count) => places.get(count.locationId ?? '') ?? 'Tout le stock',
      text: (count) => (count.locationId ? (places.get(count.locationId) ?? '') : 'Tout le stock'),
      groupable: true,
    },
    {
      id: 'lines',
      label: 'Écarts notés',
      size: 120,
      numeric: true,
      sortValue: (count) => count.lines,
      text: (count) => String(count.lines),
      filter: { kind: 'number', value: (count) => count.lines },
    },
    { id: 'note', label: 'Note', size: 260, sortValue: (count) => count.note ?? null, text: (count) => count.note ?? '' },
  ];
  const view = useDataView({ tableKey: 'stock-counts', getKey: (count) => count.id, columns, rows: counts ?? [], title: 'Inventaires' });
  return (
    <DataTable
      framed
      view={view}
      verticalSpacing="xs"
      empty={<EmptyState compact icon={<ListChecksIcon aria-hidden />} message="Aucun inventaire : « Faire l’inventaire » depuis le stock." />}
      getKey={(count) => count.id}
      cells={() => ({})}
    />
  );
}

/**
 * Settings of the inventory: the places (a tree).
 * @returns {JSX.Element} Settings, in the sidebar.
 */
function StockSettings() {
  const { data: items } = useStockItems();
  const usage = countBy(items ?? [], (item) => item.locationId);
  return (
    <PageSettings title="Paramètres de l’inventaire">
      <Stack gap="md">
        <StockLocations usage={usage} />
      </Stack>
    </PageSettings>
  );
}

/**
 * Inventory page: the stock (its items and their lots), the history of its movements, the inventories made, and its
 * settings (the places).
 * @returns {JSX.Element} Page.
 */
export function StockPage() {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const tab = params.get('tab') ?? 'stock';
  return (
    <Stack gap="lg">
      <PageHeader title="Inventaire" />
      <PageTabs value={tab} onChange={(value) => setParams({ tab: value && value !== 'stock' ? value : null }, { only: true })} keepMounted={false}>
        <PageTabs.List>
          <PageTabs.Tab value="stock" leftSection={<ArchiveIcon aria-hidden />}>
            Stock
          </PageTabs.Tab>
          <PageTabs.Tab value="movements" leftSection={<ClockCounterClockwiseIcon aria-hidden />}>
            Mouvements
          </PageTabs.Tab>
          <PageTabs.Tab value="counts" leftSection={<ListChecksIcon aria-hidden />}>
            Inventaires
          </PageTabs.Tab>
        </PageTabs.List>
        <PageTabs.Panel value="stock">
          <StockTable />
        </PageTabs.Panel>
        <PageTabs.Panel value="movements">
          <MovementsTable />
        </PageTabs.Panel>
        <PageTabs.Panel value="counts">
          <CountsTable />
        </PageTabs.Panel>
      </PageTabs>
      <StockSettings />
    </Stack>
  );
}
