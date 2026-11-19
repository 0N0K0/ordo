import { useSortable } from '@dnd-kit/sortable';

import { Group, Tabs, type TabsTabProps } from '@mantine/core';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode, Ref } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../actions/ActionsMenu';
import { IconAction } from '../actions/IconAction';
import { sortableStyle } from '../dnd/sortable-style';
import { SortableArea } from '../dnd/sortable';

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
      style={{ ...sortableStyle({ transform: transform && { ...transform, y: 0 }, transition, isDragging }), cursor: isDragging ? 'grabbing' : undefined }}
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
  const addButton = (
    <IconAction label={add.label} ml="xs" onClick={add.onClick}>
      <PlusIcon aria-hidden />
    </IconAction>
  );

  return (
    <Group ref={ref} gap={0} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
      <Tabs value={value} onChange={(id) => id && onChange(id)} style={{ minWidth: 0 }}>
        {/* Pointer only: the tabs keep their keyboard navigation (their menu moves them with the keyboard). */}
        <SortableArea ids={items.map((item) => item.id)} layout="row" pointerOnly onMove={(id, _from, to) => onMove(id, to)}>
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
                      nested
                      size="xs"
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
        </SortableArea>
      </Tabs>
      {add.menu ? <ActionsMenu name={add.label} position="bottom-start" target={addButton} items={add.menu} /> : addButton}
    </Group>
  );
}
