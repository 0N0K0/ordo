import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Group, Tabs, Tooltip, type TabsTabProps } from '@mantine/core';
import { ArrowLeftIcon, ArrowRightIcon, CaretDownIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode, Ref } from 'react';
import { useDragSensors } from '../../lib/drag';
import { ActionsMenu, type RowMenuEntry } from '../actions/ActionsMenu';

/**
 * Tab dragged along the tab list (a click still selects it: the drag starts after a few pixels).
 * @param {TabsTabProps & { value: string }} props Tab props.
 * @returns {JSX.Element} Tab.
 */
function SortableTab(props: TabsTabProps & { value: string }) {
  // Pointer only: the tab keeps its role and keyboard navigation (its menu moves it with the keyboard).
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: props.value });
  return (
    <Tabs.Tab
      ref={setNodeRef}
      {...props}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, y: 0 }), transition, zIndex: isDragging ? 1 : undefined, cursor: isDragging ? 'grabbing' : undefined }}
    />
  );
}

/** Button after the tabs adding one: a click, or a menu of the ways to add one. */
type AddTab = { label: string; onClick: () => void; menu?: never } | { label: string; menu: readonly RowMenuEntry[]; onClick?: never };

interface SortableTabsProps<T extends { id: string }> {
  items: T[];
  /** Selected tab. */
  value: string | null;
  onChange: (id: string) => void;
  /** Moves a tab to an index (drag and drop, or « Déplacer » in its menu). */
  onMove: (id: string, index: number) => void;
  /** Content of a tab. */
  label: (item: T) => ReactNode;
  /** Before the content of a tab (avatar, default star…). Optional. */
  leftSection?: (item: T) => ReactNode;
  /** Name of a tab for its menu button (« Actions de … »). */
  name: (item: T) => string;
  /** First entries of the menu of the selected tab (edit, duplicate…), before the moves. */
  actions: (item: T) => readonly RowMenuEntry[];
  /** Deletes a tab (last entry of its menu, after a divider). Optional. */
  onDelete?: (item: T) => void;
  /** The tab cannot be deleted (the last view…). Optional. */
  deleteDisabled?: (item: T) => boolean;
  add: AddTab;
  /** Ref of the bar (its height published…). Optional. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Bar of tabs reordered by drag and drop, the selected one with its menu (its actions, move left or right, delete),
 * followed by the button adding one.
 * @param {SortableTabsProps<T>} props Component props.
 * @returns {JSX.Element} Tabs.
 */
export function SortableTabs<T extends { id: string }>({ items, value, onChange, onMove, label, leftSection, name, actions, onDelete, deleteDisabled, add, ref }: SortableTabsProps<T>) {
  const sensors = useDragSensors();

  /**
   * Moves the dropped tab to its new place.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = items.findIndex((item) => item.id === over.id);
    if (index >= 0) onMove(String(active.id), index);
  };

  const addButton = (
    <ActionIcon variant="subtle" color="gray" ml="xs" aria-label={add.label} onClick={add.onClick}>
      <PlusIcon aria-hidden />
    </ActionIcon>
  );

  return (
    <Group ref={ref} gap={0} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
      <Tabs value={value} onChange={(id) => id && onChange(id)} style={{ minWidth: 0 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
            <Tabs.List>
              {items.map((item, index) => (
                <SortableTab
                  key={item.id}
                  value={item.id}
                  leftSection={leftSection?.(item)}
                  rightSection={
                    item.id === value ? (
                      <ActionsMenu
                        name={name(item)}
                        target={
                          <ActionIcon component="span" variant="subtle" color="gray" size="xs" aria-label={`Actions de ${name(item)}`} onClick={(event) => event.stopPropagation()}>
                            <CaretDownIcon aria-hidden />
                          </ActionIcon>
                        }
                        items={[
                          ...actions(item),
                          { label: 'Déplacer à gauche', icon: <ArrowLeftIcon aria-hidden />, disabled: index === 0, onClick: () => onMove(item.id, index - 1) },
                          { label: 'Déplacer à droite', icon: <ArrowRightIcon aria-hidden />, disabled: index === items.length - 1, onClick: () => onMove(item.id, index + 1) },
                          onDelete && { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, disabled: deleteDisabled?.(item), onClick: () => onDelete(item) },
                        ]}
                      />
                    ) : undefined
                  }
                >
                  {label(item)}
                </SortableTab>
              ))}
            </Tabs.List>
          </SortableContext>
        </DndContext>
      </Tabs>
      {add.menu ? (
        <ActionsMenu name={add.label} position="bottom-start" target={<Tooltip label={add.label}>{addButton}</Tooltip>} items={add.menu} />
      ) : (
        <Tooltip label={add.label}>{addButton}</Tooltip>
      )}
    </Group>
  );
}
