import { Button, Group, Select } from '@mantine/core';
import { FileCsvIcon, FilePdfIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { notifyError } from '../../lib/notify';
import { FieldsFilterBuilder } from '../../features/tasks/views/FilterBuilder';
import { countConditions } from '../../features/tasks/views/filter-meta';
import { ViewTabs } from '../../features/tasks/views/ViewTabs';
import { SortPanel } from '../../features/tasks/views/ViewToolbar';
import { DataColumnsPanel } from './ColumnsPanel';
import { groupableColumns, tableFilterFields } from './table-engine';
import { downloadTableCsv, downloadTablePdf, type TableExport } from './table-export';
import { TableOptions, TableToolbar, ToolbarFilter, ToolbarSort } from './TableToolbar';
import type { DataView } from './use-data-view';

/**
 * CSV and PDF buttons of the exports of a table.
 * @param {{ table: () => TableExport<R>, disabled?: boolean }} props Component props: what is exported (built on a click), nothing to export.
 * @returns {JSX.Element} Buttons.
 */
export function ExportButtons<R>({ table, disabled = false }: { table: () => TableExport<R>; disabled?: boolean }) {
  const [exporting, setExporting] = useState(false);
  return (
    <Group gap="xs" grow>
      <Button variant="default" leftSection={<FileCsvIcon aria-hidden />} disabled={disabled} onClick={() => downloadTableCsv(table())}>
        CSV
      </Button>
      <Button
        variant="default"
        leftSection={<FilePdfIcon aria-hidden />}
        disabled={disabled}
        loading={exporting}
        onClick={() => {
          setExporting(true);
          downloadTablePdf(table())
            .catch((error: Error) => notifyError(error.message))
            .finally(() => setExporting(false));
        }}
      >
        PDF
      </Button>
    </Group>
  );
}

/**
 * CSV and PDF buttons of the exports of a table of saved views (what it shows: the current view, its groups).
 * @param {{ view: DataView<R>, subtitle?: string }} props Component props: view, what is exported (else the name of the view).
 * @returns {JSX.Element} Buttons.
 */
export function TableExportButtons<R>({ view, subtitle }: { view: DataView<R>; subtitle?: string }) {
  return (
    <ExportButtons
      disabled={view.rows.length === 0}
      table={() => ({ title: view.title, subtitle: subtitle ?? view.views.current?.name ?? '', columns: view.shown, groups: view.groups, grouped: Boolean(view.groupColumn) })}
    />
  );
}

export interface DataViewBarProps<R> {
  view: DataView<R>;
  /** Placeholder of the search. Optional. Default = « Rechercher ». */
  searchLabel?: string;
  /** Buttons after the tabs of the views (« Nouveau »…). Optional. */
  actions?: ReactNode;
  /** Tools of the toolbar, after the filters and sorts. Optional. */
  tools?: ReactNode;
  /** More display options, under the groups. Optional. */
  displayOptions?: ReactNode;
  /** More exports, under CSV and PDF. Optional. */
  exports?: ReactNode;
  /** What the order without sort is. Optional. */
  manualText?: string;
}

/**
 * Views and tools of a table, the same on every table (as on the tasks): the tabs of its saved views, then its
 * toolbar — search, filters on its columns, sorts, its tools, and its options (unsaved changes, groups, columns, CSV
 * and PDF exports).
 * @param {DataViewBarProps<R>} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function DataViewBar<R>({ view, searchLabel = 'Rechercher', actions, tools, displayOptions, exports, manualText = 'Sans tri : l’ordre par défaut du tableau.' }: DataViewBarProps<R>) {
  const { config, views } = view;
  const sortable = view.columns.filter((column) => column.sortValue);
  const groupable = groupableColumns(view.columns);
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <>
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-end">
        <div style={{ minWidth: 0, flex: 1 }}>
          <ViewTabs state={views} />
        </div>
        {actions}
      </Group>
      {config && (
        <TableToolbar
          search={{ value: config.search, onChange: (search) => view.change((current) => ({ ...current, search })), placeholder: searchLabel }}
          options={
            <TableOptions
              dirty={views.dirty}
              onSave={views.save}
              onRevert={views.revert}
              display={
                (groupable.length > 0 || displayOptions) && (
                  <>
                    {groupable.length > 0 && (
                      <Select
                        label="Grouper par"
                        placeholder="Aucun groupe"
                        data={groupable.map((column) => ({ value: column.id, label: column.label }))}
                        value={view.groupColumn?.id ?? null}
                        onChange={(groupBy) => view.change((current) => ({ ...current, groupBy }))}
                        clearable
                        comboboxProps={inPanel}
                      />
                    )}
                    {displayOptions}
                  </>
                )
              }
              columns={<DataColumnsPanel columns={view.columns} layout={view.layout} onLayoutChange={view.setLayout} />}
              exports={
                <>
                  <TableExportButtons view={view} />
                  {exports}
                </>
              }
            />
          }
        >
          <ToolbarFilter count={countConditions(config.filter)} opened={view.filterOpened} onOpenedChange={view.setFilterOpened}>
            <FieldsFilterBuilder filter={config.filter} fields={tableFilterFields(view.columns)} onChange={(filter) => view.change((current) => ({ ...current, filter }))} />
          </ToolbarFilter>
          {sortable.length > 0 && (
            <ToolbarSort count={view.sorting.length}>
              <SortPanel
                sorting={view.sorting}
                onChange={view.setSorting}
                keys={sortable.map((column) => column.id)}
                labels={Object.fromEntries(sortable.map((column) => [column.id, column.label]))}
                manualText={manualText}
                hint="Astuce : cliquez sur un en-tête de colonne pour trier, Maj + clic pour ajouter un niveau."
              />
            </ToolbarSort>
          )}
          {tools}
        </TableToolbar>
      )}
    </>
  );
}
