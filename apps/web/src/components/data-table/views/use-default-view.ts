import { byPosition, type TableViewConfig } from '@ordo/shared';
import { useMemo } from 'react';
import { parisToday } from '../../../lib/dates';
import type { DataColumn } from '../table/data-table';
import { viewRows, type ViewRows } from '../table/table-engine';
import { useTaskViews } from './api';
import { parseTableViewConfig } from './use-data-view';
import { defaultView, type SavedView } from './use-saved-views';

/** Default view of a table. */
export interface DefaultTableView {
  /** The view the table opens by default, none while loading or when the table has no view yet. */
  view: SavedView<TableViewConfig> | null;
  /** Its views are loading. */
  isPending: boolean;
}

/**
 * Default view of a table (the one chosen by default, else its first tab), read elsewhere than the table: read only,
 * no view is made nor changed.
 * @param {string} tableKey Table.
 * @param {string | null} [projectId] Project of the views (a project's tab), null for the page. Optional. Default = null.
 * @returns {DefaultTableView} View.
 */
export function useDefaultTableView(tableKey: string, projectId: string | null = null): DefaultTableView {
  const { data, isPending } = useTaskViews(projectId, 'TABLE', tableKey);
  const view = useMemo(() => {
    const saved = defaultView([...(data ?? [])].sort(byPosition));
    return saved ? { ...saved, config: parseTableViewConfig(saved.config, tableKey) } : null;
  }, [data, tableKey]);
  return { view, isPending };
}

interface ViewRowsOptions<R> {
  /** View applied (`useDefaultTableView`); none: no row. */
  view: SavedView<TableViewConfig> | null;
  columns: readonly DataColumn<R>[];
  /** Every row, in their default order. */
  rows: readonly R[];
  /** The row is archived: left out, as the table does until « Afficher les archivés » is on. Optional. Default = none archived. */
  archived?: (row: R) => boolean;
}

/**
 * Rows of a table as a view shows them, elsewhere than the table: the same search, filter, sorts and groups (the
 * columns shown do not matter), the archived rows left out.
 * @param {ViewRowsOptions<R>} options View, columns and rows of the table.
 * @returns {ViewRows<R>} Rows, groups and the column grouped by.
 */
export function useViewRows<R>({ view, columns, rows, archived }: ViewRowsOptions<R>): ViewRows<R> {
  const today = parisToday();
  return useMemo(() => {
    if (!view) return { rows: [], groups: [], groupColumn: null };
    return viewRows(archived ? rows.filter((row) => !archived(row)) : rows, columns, view.config, today);
  }, [view, rows, columns, archived, today]);
}
