import { Text } from '@mantine/core';
import { DataColumnsPanel } from '../toolbar/ColumnsPanel';
import type { DataColumn } from '../table/data-table';
import { ON_ERROR } from '../../../lib/notify';
import { SettingsSection } from '../../settings/SettingsSection';
import { useSetTableColumnDefaults, useTableColumnDefaults } from './api';

/** Height of the list of columns in the settings (12 steps of the vertical rhythm): a long list scrolls. */
const SETTINGS_COLUMNS_HEIGHT = 288;

interface ColumnDefaultsProps<R> {
  /** Table whose new views start with these columns. */
  tableKey: string;
  /** Its columns, as the table has them. */
  columns: readonly DataColumn<R>[];
  /** Name of the table, in the title, when the settings hold several tables (« Mouvements »). Optional. Default = none. */
  label?: string;
}

/**
 * Columns new views of a data table of the workspace start with: those shown and their order, by drag and drop, in the
 * panel of the columns of every table (its list limited in height, scrolling); « Colonnes par défaut » gives back the
 * app's. The views already made keep theirs. Shown last in the settings of a page.
 * @param {ColumnDefaultsProps<R>} props Component props.
 * @returns {JSX.Element} Section.
 */
export function ColumnDefaults<R>({ tableKey, columns, label }: ColumnDefaultsProps<R>) {
  const { data: defaults } = useTableColumnDefaults(tableKey);
  // eslint-disable-next-line no-restricted-syntax -- ColumnDefaults itself.
  const save = useSetTableColumnDefaults(tableKey);
  return (
    <SettingsSection title={label ? `Colonnes des nouvelles vues : ${label}` : 'Colonnes des nouvelles vues'}>
      <Text size="xs" c="dimmed">
        Colonnes affichées et leur ordre (glissez-déposez) quand une vue de ce tableau est créée. Les vues existantes gardent les leurs.
      </Text>
      {defaults && (
        <DataColumnsPanel
          columns={columns}
          layout={{ columnOrder: defaults.columnOrder, hiddenColumns: defaults.hiddenColumns, columnSizing: {} }}
          onLayoutChange={(layout) => save.mutate(layout.columnOrder.length ? { columnOrder: layout.columnOrder, hiddenColumns: layout.hiddenColumns } : null, ON_ERROR)}
          // eslint-disable-next-line no-restricted-syntax -- ColumnDefaults itself.
          maxHeight={SETTINGS_COLUMNS_HEIGHT}
        />
      )}
    </SettingsSection>
  );
}
