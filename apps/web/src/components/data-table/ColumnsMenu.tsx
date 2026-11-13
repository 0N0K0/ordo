import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Button, Checkbox, Group, Popover, Stack, Text, Tooltip } from '@mantine/core';
import type { ColumnLayout } from '@ordo/shared';
import { ColumnsIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { columnOrder, isHidden, withVisibility, type DataColumn } from './data-table';

/**
 * Column of the panel: moved by its handle, shown or hidden by its box.
 * @param {{ column: DataColumn<R>, visible: boolean, onToggle: (visible: boolean) => void }} props Component props.
 * @returns {JSX.Element} Item.
 */
function ColumnItem<R>({ column, visible, onToggle }: { column: DataColumn<R>; visible: boolean; onToggle: (visible: boolean) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: column.id });
  return (
    <Group ref={setNodeRef} gap="xs" wrap="nowrap" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${column.label}`} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <DotsSixVerticalIcon aria-hidden />
      </ActionIcon>
      <Checkbox size="xs" label={column.label} checked={visible} disabled={column.locked} onChange={(event) => onToggle(event.currentTarget.checked)} />
    </Group>
  );
}

interface ColumnsPanelProps<R> {
  columns: readonly DataColumn<R>[];
  layout: ColumnLayout;
  onLayoutChange: (layout: ColumnLayout) => void;
}

/**
 * Columns of a table: shown or hidden, moved by drag and drop; back to the default columns.
 * @param {ColumnsPanelProps<R>} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function DataColumnsPanel<R>({ columns, layout, onLayoutChange }: ColumnsPanelProps<R>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const order = columnOrder(columns, layout);
  const byId = new Map(columns.map((column) => [column.id, column]));

  /**
   * Moves a dropped column.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onLayoutChange({ ...layout, columnOrder: arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))) });
  };

  return (
    <Stack gap="xs">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <Stack gap={4} w={220}>
            {order.map((id) => (
              <ColumnItem key={id} column={byId.get(id)!} visible={!isHidden(byId.get(id)!, layout)} onToggle={(visible) => onLayoutChange(withVisibility(columns, layout, id, visible))} />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
      <Button size="compact-sm" variant="subtle" color="gray" onClick={() => onLayoutChange({ columnOrder: [], hiddenColumns: [], columnSizing: {} })}>
        Colonnes par défaut
      </Button>
      <Text size="xs" c="dimmed">
        Astuce : cliquez sur un en-tête pour trier, Maj + clic pour ajouter un niveau ; glissez un en-tête pour le déplacer, son bord pour le redimensionner.
      </Text>
    </Stack>
  );
}

/**
 * Button opening the columns panel of a table.
 * @param {ColumnsPanelProps<R>} props Component props.
 * @returns {JSX.Element} Button.
 */
export function ColumnsMenu<R>(props: ColumnsPanelProps<R>) {
  return (
    <Popover position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Tooltip label="Colonnes">
          <ActionIcon variant="subtle" color="gray" aria-label="Choisir les colonnes">
            <ColumnsIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <DataColumnsPanel {...props} />
      </Popover.Dropdown>
    </Popover>
  );
}
