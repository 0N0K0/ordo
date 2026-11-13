import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import type { ColumnLayout } from '@ordo/shared';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { columnOrder, isHidden, withOrder, withVisibility, type DataColumn } from './data-table';

/** Column of the panel. */
export interface ColumnsListItem {
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
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <Group ref={setNodeRef} gap="xs" wrap="nowrap" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${item.label}`} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <DotsSixVerticalIcon aria-hidden />
      </ActionIcon>
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
  /** Tip about the headers. Optional. Default = true. */
  withHint?: boolean;
}

/**
 * Columns of every table (tasks too): shown or hidden by their box, moved by drag and drop, back to the default ones.
 * @param {ColumnsListProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ColumnsList({ items, onReorder, onToggle, onReset, withHint = true }: ColumnsListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = items.map((item) => item.id);

  /**
   * Moves a dropped column.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <Stack gap="xs">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Stack gap={4}>
            {items.map((item) => (
              <ColumnItem key={item.id} item={item} onToggle={(visible) => onToggle(item.id, visible)} />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
      {onReset && (
        <Button size="compact-sm" variant="subtle" color="gray" onClick={onReset}>
          Colonnes par défaut
        </Button>
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
}

/**
 * Columns of a data table, from its layout.
 * @param {DataColumnsPanelProps<R>} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function DataColumnsPanel<R>({ columns, layout, onLayoutChange }: DataColumnsPanelProps<R>) {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const items = columnOrder(columns, layout).map((id) => {
    const column = byId.get(id)!;
    return { id, label: column.label, locked: column.locked, visible: !isHidden(column, layout) };
  });
  return (
    <ColumnsList
      items={items}
      onReorder={(order) => onLayoutChange(withOrder(columns, layout, order))}
      onToggle={(id, visible) => onLayoutChange(withVisibility(columns, layout, id, visible))}
      onReset={() => onLayoutChange({ columnOrder: [], hiddenColumns: [], columnSizing: {} })}
    />
  );
}
