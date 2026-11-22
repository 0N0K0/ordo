import { PAGES } from '../../../app/pages';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { countBy } from '@ordo/shared';
import { Stack } from '@mantine/core';
import { ArchiveIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { PageHeader } from '../../../components/page/PageHeader';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useStockCounts, useStockItems } from '../api';
import { MovementsTable } from '../components/MovementsTable';
import { StockLocations } from '../components/StockLocations';
import { StockTable } from '../components/StockTable';
import { LOT_COLUMNS, MOVEMENT_COLUMNS, useCountColumns, useCountFormColumns, useStockItemColumns } from '../hooks/use-stock-columns';
import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { ShoppingCategories } from '../../shopping/components/ShoppingCategories';
import { ShoppingUnits } from '../../shopping/components/ShoppingUnits';

/**
 * Inventories recorded, latest first.
 * @returns {JSX.Element} Table.
 */
function CountsTable() {
  const { data: counts } = useStockCounts();
  const columns = useCountColumns();
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

/** No count: the columns of an inventory being made, in the settings. */
const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/**
 * Settings of the inventory: the places (a tree), then the categories and the units of the articles (those of the
 * shopping, also in the shopping settings), then the columns of new views of its tables.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
function StockSettings() {
  const { data: items } = useStockItems();
  const usage = countBy(items ?? [], (item) => item.locationId);
  const stockColumns = useStockItemColumns();
  const countColumns = useCountColumns();
  const countFormColumns = useCountFormColumns(NO_COUNTS);
  return (
    <PageSettings title="Paramètres de l’inventaire">
      <Stack gap="md">
        <StockLocations usage={usage} />
        <ShoppingCategories />
        <ShoppingUnits />
        {/* Last: the columns of new views (long lists). */}
        <ColumnDefaults tableKey="stock" columns={stockColumns} label="Stock" />
        <ColumnDefaults tableKey="stock-lots" columns={LOT_COLUMNS} label="Lots d’un article" />
        <ColumnDefaults tableKey="stock-movements" columns={MOVEMENT_COLUMNS} label="Mouvements" />
        <ColumnDefaults tableKey="stock-item-movements" columns={MOVEMENT_COLUMNS} label="Historique d’un article" />
        <ColumnDefaults tableKey="stock-counts" columns={countColumns} label="Inventaires" />
        <ColumnDefaults tableKey="stock-count" columns={countFormColumns} label="Faire l’inventaire" />
      </Stack>
    </PageSettings>
  );
}

/** Tabs of the inventory page. */
const STOCK_TABS = ['stock', 'movements', 'counts'] as const;

/**
 * Inventory page: the stock (its items and their lots), the history of its movements, the inventories made, and its
 * settings (the places, the categories and the units).
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
