import { ActionIcon } from '@mantine/core';
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
import { ActionsMenu } from '../../actions/ActionsMenu';

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
    <ActionsMenu
      name={`la colonne ${label}`}
      position="bottom-start"
      width={240}
      target={
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
      }
      items={[
        onSelect && { label: 'Sélectionner la colonne', icon: <SelectionAllIcon aria-hidden />, onClick: onSelect },
        onSelect && 'divider',
        sort !== undefined && { label: 'Trier par ordre croissant', icon: <SortAscendingIcon aria-hidden />, onClick: () => onSortBy(false) },
        sort !== undefined && { label: 'Trier par ordre décroissant', icon: <SortDescendingIcon aria-hidden />, onClick: () => onSortBy(true) },
        sort && { label: 'Retirer ce tri', icon: <XIcon aria-hidden />, onClick: () => onSortBy(null) },
        onFilter && { label: 'Filtrer selon cette colonne', icon: <FunnelIcon aria-hidden />, onClick: onFilter },
        group && { label: group.active ? 'Ne plus grouper' : 'Grouper selon les valeurs', icon: <RowsIcon aria-hidden />, onClick: group.onToggle },
        onHide && { label: 'Masquer la colonne', icon: <EyeSlashIcon aria-hidden />, onClick: onHide },
        'divider',
        { section: 'Déplacer' },
        { label: 'Au début', icon: <ArrowLineLeftIcon aria-hidden />, disabled: index <= 0, onClick: () => onMove('start') },
        { label: 'À gauche', icon: <ArrowLeftIcon aria-hidden />, disabled: index <= 0, onClick: () => onMove('left') },
        { label: 'À droite', icon: <ArrowRightIcon aria-hidden />, disabled: index === count - 1, onClick: () => onMove('right') },
        { label: 'À la fin', icon: <ArrowLineRightIcon aria-hidden />, disabled: index === count - 1, onClick: () => onMove('end') },
      ]}
    />
  );
}
