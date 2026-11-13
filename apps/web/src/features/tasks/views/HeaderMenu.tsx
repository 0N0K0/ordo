import type { TaskColumn, TaskViewConfig } from '@ordo/shared';
import { ColumnHeaderMenu, type ColumnMove } from '../../../components/data-table/ColumnHeaderMenu';
import { BULK_EDITABLE_COLUMNS, COLUMN_FILTER_FIELDS, COLUMN_GROUP_BY, COLUMN_LABELS, LOCKED_COLUMNS } from './columns-meta';

type Change = (change: (config: TaskViewConfig) => TaskViewConfig) => void;

interface HeaderMenuProps {
  column: TaskColumn;
  config: TaskViewConfig;
  change: Change;
  /** Full column order (missing columns appended). */
  order: TaskColumn[];
  onSelectColumn: () => void;
  onFilter: () => void;
}

/**
 * Menu of a task column header (the one of every table): select the column cells, sort, filter, group, hide and move
 * the column.
 * @param {HeaderMenuProps} props Component props.
 * @returns {JSX.Element} Menu.
 */
export function HeaderMenu({ column, config, change, order, onSelectColumn, onFilter }: HeaderMenuProps) {
  const sort = config.sorting.find((item) => item.id === column);
  const groupBy = COLUMN_GROUP_BY[column];
  const visible = order.filter((id) => !config.hiddenColumns.includes(id));
  const index = visible.indexOf(column);

  /**
   * Moves the column next to another visible column, or to an end.
   * @param {ColumnMove} where Destination.
   * @returns {void}
   */
  const move = (where: ColumnMove) =>
    change((current) => {
      const others = order.filter((id) => id !== column);
      let at: number;
      if (where === 'start') at = 0;
      else if (where === 'end') at = others.length;
      else {
        const neighbour = visible[where === 'left' ? index - 1 : index + 1];
        at = others.indexOf(neighbour) + (where === 'right' ? 1 : 0);
      }
      return { ...current, columnOrder: [...others.slice(0, at), column, ...others.slice(at)] };
    });

  return (
    <ColumnHeaderMenu
      label={COLUMN_LABELS[column]}
      sort={sort ?? null}
      onSortBy={(desc) => change((current) => ({ ...current, sorting: desc === null ? current.sorting.filter((item) => item.id !== column) : [{ id: column, desc }] }))}
      onSelect={BULK_EDITABLE_COLUMNS.includes(column) ? onSelectColumn : undefined}
      onFilter={COLUMN_FILTER_FIELDS[column] ? onFilter : undefined}
      group={groupBy ? { active: config.groupBy === groupBy, onToggle: () => change((current) => ({ ...current, groupBy: current.groupBy === groupBy ? null : groupBy })) } : undefined}
      onHide={LOCKED_COLUMNS.includes(column) ? undefined : () => change((current) => ({ ...current, hiddenColumns: [...current.hiddenColumns, column] }))}
      index={index}
      count={visible.length}
      onMove={move}
    />
  );
}
