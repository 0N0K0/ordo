import { ActionIcon, Menu } from '@mantine/core';
import type { TaskColumn, TaskViewConfig } from '@ordo/shared';
import {
  ArrowLineLeftIcon,
  ArrowLineRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DotsThreeIcon,
  EyeSlashIcon,
  FunnelIcon,
  RowsIcon,
  SelectionAllIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  XIcon,
} from '@phosphor-icons/react';
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
 * Menu of a column header: select the column cells, sort, filter, group, hide and move the column.
 * @param {HeaderMenuProps} props Component props.
 * @returns {JSX.Element} Menu.
 */
export function HeaderMenu({ column, config, change, order, onSelectColumn, onFilter }: HeaderMenuProps) {
  const label = COLUMN_LABELS[column];
  const sort = config.sorting.find((item) => item.id === column);
  const groupBy = COLUMN_GROUP_BY[column];
  const visible = order.filter((id) => !config.hiddenColumns.includes(id));
  const index = visible.indexOf(column);

  /**
   * Sorts by this column only, in the given direction.
   * @param {boolean} desc Descending.
   * @returns {void}
   */
  const sortBy = (desc: boolean) => change((current) => ({ ...current, sorting: [{ id: column, desc }] }));

  /**
   * Moves the column next to another visible column, or to an end.
   * @param {'start' | 'left' | 'right' | 'end'} where Destination.
   * @returns {void}
   */
  const move = (where: 'start' | 'left' | 'right' | 'end') =>
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
    <Menu position="bottom-start" withinPortal shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="xs"
          aria-label={`Options de la colonne ${label}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DotsThreeIcon weight="bold" aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {BULK_EDITABLE_COLUMNS.includes(column) && (
          <>
            <Menu.Item leftSection={<SelectionAllIcon aria-hidden />} onClick={onSelectColumn}>
              Sélectionner la colonne
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item leftSection={<SortAscendingIcon aria-hidden />} onClick={() => sortBy(false)}>
          Trier par ordre croissant
        </Menu.Item>
        <Menu.Item leftSection={<SortDescendingIcon aria-hidden />} onClick={() => sortBy(true)}>
          Trier par ordre décroissant
        </Menu.Item>
        {sort && (
          <Menu.Item
            leftSection={<XIcon aria-hidden />}
            onClick={() => change((current) => ({ ...current, sorting: current.sorting.filter((item) => item.id !== column) }))}
          >
            Retirer ce tri
          </Menu.Item>
        )}
        {COLUMN_FILTER_FIELDS[column] && (
          <Menu.Item leftSection={<FunnelIcon aria-hidden />} onClick={onFilter}>
            Filtrer selon cette colonne
          </Menu.Item>
        )}
        {groupBy && (
          <Menu.Item
            leftSection={<RowsIcon aria-hidden />}
            onClick={() =>
              change((current) => ({ ...current, groupBy: current.groupBy === groupBy ? null : groupBy }))
            }
          >
            {config.groupBy === groupBy ? 'Ne plus grouper' : 'Grouper selon les valeurs'}
          </Menu.Item>
        )}
        {!LOCKED_COLUMNS.includes(column) && (
          <Menu.Item
            leftSection={<EyeSlashIcon aria-hidden />}
            onClick={() => change((current) => ({ ...current, hiddenColumns: [...current.hiddenColumns, column] }))}
          >
            Masquer la colonne
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Label>Déplacer</Menu.Label>
        <Menu.Item leftSection={<ArrowLineLeftIcon aria-hidden />} disabled={index <= 0} onClick={() => move('start')}>
          Au début
        </Menu.Item>
        <Menu.Item leftSection={<ArrowLeftIcon aria-hidden />} disabled={index <= 0} onClick={() => move('left')}>
          À gauche
        </Menu.Item>
        <Menu.Item
          leftSection={<ArrowRightIcon aria-hidden />}
          disabled={index === visible.length - 1}
          onClick={() => move('right')}
        >
          À droite
        </Menu.Item>
        <Menu.Item
          leftSection={<ArrowLineRightIcon aria-hidden />}
          disabled={index === visible.length - 1}
          onClick={() => move('end')}
        >
          À la fin
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
