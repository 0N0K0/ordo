import { TASK_COLUMNS, type TaskColumn } from '@ordo/shared';
import { ColumnsList } from '../../../components/data-table/ColumnsPanel';
import { COLUMN_LABELS, LOCKED_COLUMNS } from './columns-meta';

interface ColumnsPanelProps {
  columnOrder: readonly TaskColumn[];
  hiddenColumns: readonly TaskColumn[];
  onChange: (columns: { columnOrder: TaskColumn[]; hiddenColumns: TaskColumn[] }) => void;
  /** Back to the default columns. Optional. */
  onReset?: () => void;
  /** Tip about the headers (not in the settings). Optional. Default = true. */
  withHint?: boolean;
}

/**
 * Columns shown and their order, reordered by drag and drop (the panel of every table): of a view, or of the new views
 * of the workspace.
 * @param {ColumnsPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ColumnsPanel({ columnOrder, hiddenColumns, onChange, onReset, withHint }: ColumnsPanelProps) {
  // Columns missing from a saved order (added later) go at the end.
  const order = [...columnOrder, ...TASK_COLUMNS.filter((column) => !columnOrder.includes(column))];
  const hidden = new Set(hiddenColumns);
  return (
    <ColumnsList
      items={order.map((column) => ({ id: column, label: COLUMN_LABELS[column], locked: LOCKED_COLUMNS.includes(column), visible: !hidden.has(column) }))}
      onReorder={(ids) => onChange({ columnOrder: ids as TaskColumn[], hiddenColumns: [...hiddenColumns] })}
      onToggle={(id, visible) => onChange({ columnOrder: order, hiddenColumns: visible ? hiddenColumns.filter((item) => item !== id) : [...hiddenColumns, id as TaskColumn] })}
      onReset={onReset}
      withHint={withHint}
    />
  );
}
