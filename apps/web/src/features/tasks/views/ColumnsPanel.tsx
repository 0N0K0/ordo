import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Checkbox, Group, Stack } from '@mantine/core';
import { TASK_COLUMNS, type TaskColumn } from '@ordo/shared';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { COLUMN_LABELS, LOCKED_COLUMNS } from './columns-meta';

/**
 * Column of the visibility / order list, draggable.
 * @param {object} props Component props.
 * @param {TaskColumn} props.column Column.
 * @param {boolean} props.visible Whether it is shown.
 * @param {(visible: boolean) => void} props.onToggle Shows or hides it.
 * @returns {JSX.Element} Row.
 */
function ColumnItem({ column, visible, onToggle }: { column: TaskColumn; visible: boolean; onToggle: (visible: boolean) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: column });
  return (
    <Group ref={setNodeRef} gap="xs" wrap="nowrap" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${COLUMN_LABELS[column]}`} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <DotsSixVerticalIcon aria-hidden />
      </ActionIcon>
      <Checkbox size="xs" label={COLUMN_LABELS[column]} checked={visible} disabled={LOCKED_COLUMNS.includes(column)} onChange={(event) => onToggle(event.currentTarget.checked)} />
    </Group>
  );
}

interface ColumnsPanelProps {
  columnOrder: readonly TaskColumn[];
  hiddenColumns: readonly TaskColumn[];
  onChange: (columns: { columnOrder: TaskColumn[]; hiddenColumns: TaskColumn[] }) => void;
}

/**
 * Columns shown and their order, reordered by drag and drop: of a view, or of the new views of the workspace.
 * @param {ColumnsPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ColumnsPanel({ columnOrder, hiddenColumns, onChange }: ColumnsPanelProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // Columns missing from a saved order (added later) go at the end.
  const order = [...columnOrder, ...TASK_COLUMNS.filter((column) => !columnOrder.includes(column))];
  const hidden = new Set(hiddenColumns);

  /**
   * Moves a dragged column.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange({ columnOrder: arrayMove(order, order.indexOf(active.id as TaskColumn), order.indexOf(over.id as TaskColumn)), hiddenColumns: [...hiddenColumns] });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <Stack gap={4} w={220}>
          {order.map((column) => (
            <ColumnItem
              key={column}
              column={column}
              visible={!hidden.has(column)}
              onToggle={(visible) => onChange({ columnOrder: order, hiddenColumns: visible ? hiddenColumns.filter((item) => item !== column) : [...hiddenColumns, column] })}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
