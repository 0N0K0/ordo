import { PAGES } from '../../../app/pages';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { categoryPaths } from '../../../components/tree/category-tree';
import { countBy } from '@ordo/shared';
import { Stack } from '@mantine/core';
import { ArchiveIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { PageHeader } from '../../../components/page/PageHeader';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { PageSettings } from '../../../app/layout/PageSettings';
import * as fmt from '../../../lib/format';
import { useStockCounts, useStockItems, useStockLocations, type StockCount } from '../api';
import { MovementsTable } from '../components/MovementsTable';
import { StockLocations } from '../components/StockLocations';
import { StockTable } from '../components/StockTable';
import { localDay } from '../../../lib/dates';
import { noteColumn } from '../../shopping/lib/product-columns';

/**
 * Inventories recorded, latest first.
 * @returns {JSX.Element} Table.
 */
function CountsTable() {
  const { data: counts } = useStockCounts();
  const { data: locations } = useStockLocations();
  const places = categoryPaths(locations ?? []);
  /**
   * Place of an inventory: its path, or the whole stock.
   * @param {StockCount} count Inventory.
   * @returns {string} Place.
   */
  const locationOf = (count: StockCount) => (count.locationId ? (places.get(count.locationId) ?? '') : 'Tout le stock');
  const columns: DataColumn<StockCount>[] = [
    {
      id: 'date',
      required: true,
      label: 'Date',
      size: 160,
      locked: true,
      sortValue: (count) => count.date,
      text: (count) => fmt.dateTime(count.date),
      filter: { kind: 'date', value: (count) => localDay(count.date) },
    },
    {
      id: 'location',
      // Without a place: the whole stock (never empty).
      required: true,
      label: 'Emplacement',
      size: 200,
      sortValue: locationOf,
      text: locationOf,
      groupable: true,
    },
    {
      id: 'lines',
      required: true,
      label: 'Écarts notés',
      size: 120,
      numeric: true,
      sortValue: (count) => count.lines,
      text: (count) => fmt.count(count.lines),
      filter: { kind: 'number', value: (count) => count.lines },
    },
    noteColumn({ size: 260, bulk: false }),
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

/** Tabs of the inventory page. */
const STOCK_TABS = ['stock', 'movements', 'counts'] as const;

/**
 * Inventory page: the stock (its items and their lots), the history of its movements, the inventories made, and its
 * settings (the places).
 * @returns {JSX.Element} Page.
 */
export function StockPage() {
  const [tab, setTab] = usePageTab(STOCK_TABS);
  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.stock.label} />
      <PageTabs value={tab} onChange={(value) => setTab(value, {}, { only: true })} keepMounted={false}>
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
