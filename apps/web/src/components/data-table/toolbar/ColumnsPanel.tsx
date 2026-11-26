import { mapById } from '@ordo/shared';
import { arrayMove } from '@dnd-kit/sortable';

import { Box, Checkbox, Group, Stack, Text } from '@mantine/core';
import type { ColumnLayout } from '@ordo/shared';

import { columnOrder, isHidden, withOrder, withVisibility, type DataColumn } from '../table/data-table';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { DragHandle } from '../../dnd/DragHandle';
import { useSortableItem } from '../../dnd/use-sortable-item';
import { SortableArea } from '../../dnd/sortable';
import { ActionButton } from '../../actions/ActionButton';

/** Column of the panel. */
interface ColumnsListItem {
  id: string;
  label: string;
  /** Always shown. Optional. */
  locked?: boolean;
  visible: boolean;
}

/**
 * Column of the panel: moved by its handle, shown or hidden by its box.
 * @param {{ item: ColumnsListItem, onToggle: (visible: boolean) => void }} props Component props.
 * @returns {JSX.Element} Item.
 */
function ColumnItem({ item, onToggle }: { item: ColumnsListItem; onToggle: (visible: boolean) => void }) {
  const { ref, style, handle } = useSortableItem(item.id);
  return (
    <Group ref={ref} gap="xs" wrap="nowrap" style={style}>
      <DragHandle item={item.label} size="sm" {...handle} />
      <Checkbox size="xs" label={item.label} checked={item.visible} disabled={item.locked} onChange={(event) => onToggle(event.currentTarget.checked)} />
    </Group>
  );
}

interface ColumnsListProps {
  /** Every column, in its order. */
  items: readonly ColumnsListItem[];
  onReorder: (ids: string[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  /** Back to the default columns. Optional. */
  onReset?: () => void;
  /** Those columns are not known yet: the button is disabled. Optional. Default = false. */
  resetDisabled?: boolean;
  /** Tip about the headers. Optional. Default = true. */
  withHint?: boolean;
  /** Height the list of columns takes at most, scrolling beyond (a long list in a settings panel). Optional. Default = none. */
  maxHeight?: number;
}

/**
 * Columns of every table (tasks too): shown or hidden by their box, moved by drag and drop (or the keyboard on their
 * handle), back to the default ones.
 * @param {ColumnsListProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
function ColumnsList({ items, onReorder, onToggle, onReset, resetDisabled = false, withHint = true, maxHeight }: ColumnsListProps) {
  const ids = items.map((item) => item.id);

  return (
    <Stack gap="xs">
      {/* Pointer, or keyboard on the handles (space, arrows, space). */}
      <Box mah={maxHeight} style={maxHeight ? { overflowY: 'auto' } : undefined}>
        <SortableArea ids={ids} layout="list" onMove={(_id, from, to) => onReorder(arrayMove(ids, from, to))}>
          <Stack gap={4}>
            {items.map((item) => (
              <ColumnItem key={item.id} item={item} onToggle={(visible) => onToggle(item.id, visible)} />
            ))}
          </Stack>
        </SortableArea>
      </Box>
      {onReset && (
        <ActionButton priority="tertiary" icon={<ArrowCounterClockwiseIcon aria-hidden />} disabled={resetDisabled} onClick={onReset}>
          Colonnes par défaut
        </ActionButton>
      )}
      {withHint && (
        <Text size="xs" c="dimmed">
          Astuce : cliquez sur un en-tête pour trier, Maj + clic pour ajouter un niveau ; glissez un en-tête pour le déplacer, son bord pour le redimensionner.
        </Text>
      )}
    </Stack>
  );
}

interface DataColumnsPanelProps<R> {
  columns: readonly DataColumn<R>[];
  layout: ColumnLayout;
  onLayoutChange: (layout: ColumnLayout) => void;
  /** Layout « Colonnes par défaut » goes back to (a view: that of its new views), null while unknown (the button disabled). Optional. Default = empty (the app's columns). */
  defaultLayout?: ColumnLayout | null;
  /** Height the list takes at most, scrolling beyond. Optional. Default = none. */
  maxHeight?: number;
}

/** Empty layout: the columns of the app, those hidden by default hidden. */
const APP_LAYOUT: Readonly<ColumnLayout> = Object.freeze({ columnOrder: [], hiddenColumns: [], columnSizing: {} });

/**
 * Columns of a data table, from its layout.
 * @param {DataColumnsPanelProps<R>} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function DataColumnsPanel<R>({ columns, layout, onLayoutChange, defaultLayout = APP_LAYOUT, maxHeight }: DataColumnsPanelProps<R>) {
  const byId = mapById(columns);
  const items = columnOrder(columns, layout).map((id) => {
    const column = byId.get(id)!;
    return { id, label: column.label, locked: column.locked, visible: !isHidden(column, layout) };
  });
  return (
    <ColumnsList
      items={items}
      onReorder={(order) => onLayoutChange(withOrder(columns, layout, order))}
      onToggle={(id, visible) => onLayoutChange(withVisibility(columns, layout, id, visible))}
      onReset={() => defaultLayout && onLayoutChange({ ...defaultLayout })}
      resetDisabled={!defaultLayout}
      maxHeight={maxHeight}
    />
  );
}
