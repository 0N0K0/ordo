import { ActionIcon, Menu } from '@mantine/core';
import {
  ArrowLeftIcon,
  ArrowLineLeftIcon,
  ArrowLineRightIcon,
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

/** Where a column is moved. */
export type ColumnMove = 'start' | 'left' | 'right' | 'end';

/** Optional actions of a column menu, offered when the table has them. */
export interface ColumnMenuExtras {
  /** Selects the cells of the column (bulk editing). Optional. */
  onSelect?: () => void;
  /** Opens the filters on this column. Optional. */
  onFilter?: () => void;
  /** Groups by the values of this column, or stops. Optional. */
  group?: { active: boolean; onToggle: () => void };
}

interface ColumnHeaderMenuProps extends ColumnMenuExtras {
  label: string;
  /** Sort of the column, null when sortable but not sorted, undefined when not sortable. */
  sort: { desc: boolean } | null | undefined;
  /** Sorts by this column only (or removes its sort, with null). */
  onSortBy: (desc: boolean | null) => void;
  /** Hides the column; undefined when it cannot be. */
  onHide?: () => void;
  /** Index among the shown columns, and their number. */
  index: number;
  count: number;
  onMove: (where: ColumnMove) => void;
}

/**
 * Menu of a column header, the same on every table: select its cells, sort, filter, group, hide and move it.
 * @param {ColumnHeaderMenuProps} props Component props.
 * @returns {JSX.Element} Menu.
 */
export function ColumnHeaderMenu({ label, sort, onSortBy, onSelect, onFilter, group, onHide, index, count, onMove }: ColumnHeaderMenuProps) {
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
        {onSelect && (
          <>
            <Menu.Item leftSection={<SelectionAllIcon aria-hidden />} onClick={onSelect}>
              Sélectionner la colonne
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        {sort !== undefined && (
          <>
            <Menu.Item leftSection={<SortAscendingIcon aria-hidden />} onClick={() => onSortBy(false)}>
              Trier par ordre croissant
            </Menu.Item>
            <Menu.Item leftSection={<SortDescendingIcon aria-hidden />} onClick={() => onSortBy(true)}>
              Trier par ordre décroissant
            </Menu.Item>
            {sort && (
              <Menu.Item leftSection={<XIcon aria-hidden />} onClick={() => onSortBy(null)}>
                Retirer ce tri
              </Menu.Item>
            )}
          </>
        )}
        {onFilter && (
          <Menu.Item leftSection={<FunnelIcon aria-hidden />} onClick={onFilter}>
            Filtrer selon cette colonne
          </Menu.Item>
        )}
        {group && (
          <Menu.Item leftSection={<RowsIcon aria-hidden />} onClick={group.onToggle}>
            {group.active ? 'Ne plus grouper' : 'Grouper selon les valeurs'}
          </Menu.Item>
        )}
        {onHide && (
          <Menu.Item leftSection={<EyeSlashIcon aria-hidden />} onClick={onHide}>
            Masquer la colonne
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Label>Déplacer</Menu.Label>
        <Menu.Item leftSection={<ArrowLineLeftIcon aria-hidden />} disabled={index <= 0} onClick={() => onMove('start')}>
          Au début
        </Menu.Item>
        <Menu.Item leftSection={<ArrowLeftIcon aria-hidden />} disabled={index <= 0} onClick={() => onMove('left')}>
          À gauche
        </Menu.Item>
        <Menu.Item leftSection={<ArrowRightIcon aria-hidden />} disabled={index === count - 1} onClick={() => onMove('right')}>
          À droite
        </Menu.Item>
        <Menu.Item leftSection={<ArrowLineRightIcon aria-hidden />} disabled={index === count - 1} onClick={() => onMove('end')}>
          À la fin
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
