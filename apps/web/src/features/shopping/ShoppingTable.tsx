import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ActionIcon, ColorSwatch, Group, Paper, Table, Text, Tooltip } from '@mantine/core';
import type { ShoppingItemInput } from '@ordo/shared';
import { CaretDownIcon, CaretRightIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useShoppingData, type ShoppingCategory } from './api';
import { ConservationCell, ExpiryCell, NumberCell, PeopleCell, StoreCell, TextCell, UnitCell } from './shopping-cells';
import { inputOf, NO_GROUP, shoppingRows, visibleRows, type ShoppingFields, type ShoppingGrouping, type ShoppingRow } from './shopping-format';
import classes from './Shopping.module.css';

/** What a row is dropped on: a heading or a row of a category (or store), null for the one without. */
interface DropData {
  groupId: string | null;
}

/**
 * Where a dragged row goes: the heading or row under the pointer; with the keyboard, the closest one.
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

export interface ShoppingTableProps<T extends ShoppingFields> {
  /** Products or items, in their order. */
  items: T[];
  grouping: ShoppingGrouping;
  /** Accessible name of the table. */
  label: string;
  /** Nothing can be changed (an archived list). */
  readOnly?: boolean;
  /** Saves a row changed in place or moved to another category (or store). */
  onSave: (row: T, input: ShoppingItemInput) => void;
  /** Checkbox of a row (missing, or bought). */
  check: (row: T) => ReactNode;
  /** Badge after the name. */
  badge?: (row: T) => ReactNode;
  /** Column after the link (last purchase…). */
  extra?: { title: string; render: (row: T) => ReactNode };
  /** Buttons at the end of a row. */
  actions: (row: T) => ReactNode;
  /** Text after the name of a category (or store), from the rows in it and in its sub-categories. */
  summary?: (items: T[]) => ReactNode;
  /** Row shown struck through (bought). */
  done?: (row: T) => boolean;
  /** Categories of the tree (all by default; those of a base list). Optional. */
  categories?: ShoppingCategory[];
}

interface ItemRowProps<T extends ShoppingFields> extends Omit<ShoppingTableProps<T>, 'items' | 'grouping' | 'label' | 'summary' | 'categories'> {
  row: Extract<ShoppingRow<T>, { kind: 'item' }>;
  over: boolean;
}

/**
 * Row of a product or an item: its handle (moved to another category), its fields changed in place.
 * @param {ItemRowProps<T>} props Component props.
 * @returns {JSX.Element} Row.
 */
function ItemRow<T extends ShoppingFields>({ row, over, readOnly = false, onSave, check, badge, extra, actions, done }: ItemRowProps<T>) {
  const { item, depth, groupId } = row;
  const { data } = useShoppingData();
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `row:${item.id}`, data: { groupId } satisfies DropData, disabled: readOnly });
  const { setNodeRef: setDropRef } = useDroppable({ id: `row:${item.id}`, data: { groupId } satisfies DropData });
  /**
   * Saves some fields of the row.
   * @param {Partial<ShoppingItemInput>} patch Changed fields.
   * @returns {void}
   */
  const save = (patch: Partial<ShoppingItemInput>) => onSave(item, { ...inputOf(item), ...patch });
  const name = item.name;

  return (
    <Table.Tr
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className={classes.itemRow}
      data-over={over || undefined}
      data-dragging={isDragging || undefined}
      data-done={done?.(item) || undefined}
    >
      <Table.Td w={32} px={4}>
        {!readOnly && (
          <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${name}`} className={classes.handle} {...attributes} {...listeners}>
            <DotsSixVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Table.Td>
      <Table.Td w={36} px={4}>
        {check(item)}
      </Table.Td>
      <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth - 1} * var(--mantine-spacing-lg))` }}>
        <Group gap={4} wrap="nowrap">
          <TextCell field="name" value={name} label={`Nom de ${name}`} readOnly={readOnly} onSave={(value) => value && save({ name: value })} />
          {badge?.(item)}
        </Group>
        {item.note && (
          <Text size="xs" c="dimmed" lineClamp={1} px={4} title={item.note}>
            {item.note}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <StoreCell value={item.storeId ?? null} stores={data?.shoppingStores ?? []} label={`Magasin de ${name}`} readOnly={readOnly} onSave={(storeId) => save({ storeId })} />
      </Table.Td>
      <Table.Td>
        <NumberCell kind="quantity" value={item.quantity ?? null} label={`Quantité de ${name}`} readOnly={readOnly} onSave={(quantity) => save({ quantity })} />
      </Table.Td>
      <Table.Td>
        <UnitCell value={item.unit ?? null} label={`Unité de ${name}`} readOnly={readOnly} onSave={(unit) => save({ unit })} />
      </Table.Td>
      <Table.Td>
        <NumberCell kind="price" value={item.unitPrice ?? null} label={`Prix unitaire estimé de ${name}`} readOnly={readOnly} onSave={(unitPrice) => save({ unitPrice })} />
      </Table.Td>
      <Table.Td>
        <ConservationCell
          perishable={item.perishable}
          storageId={item.storageId ?? null}
          storages={data?.shoppingStorages ?? []}
          label={`Conservation de ${name}`}
          readOnly={readOnly}
          onSave={(conservation) => save({ ...conservation, expiresAt: conservation.perishable ? (item.expiresAt ?? null) : null })}
        />
      </Table.Td>
      <Table.Td>
        <ExpiryCell value={item.expiresAt ?? null} disabled={!item.perishable} label={`Date de péremption de ${name}`} readOnly={readOnly} onSave={(expiresAt) => save({ expiresAt })} />
      </Table.Td>
      <Table.Td>
        <PeopleCell memberIds={item.memberIds} relationIds={item.relationIds} label={`Pour qui est ${name}`} readOnly={readOnly} onSave={(people) => save(people)} />
      </Table.Td>
      <Table.Td>
        <TextCell field="url" value={item.url ?? null} label={`Lien vers ${name}`} placeholder="https://…" readOnly={readOnly} onSave={(url) => save({ url })} />
      </Table.Td>
      {extra && <Table.Td>{extra.render(item)}</Table.Td>}
      <Table.Td w={1}>
        <Group gap={2} wrap="nowrap" justify="flex-end">
          {actions(item)}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

interface GroupRowProps<T> {
  row: Extract<ShoppingRow<T>, { kind: 'group' }>;
  columns: number;
  over: boolean;
  collapsed: boolean;
  onToggle: () => void;
  summary?: (items: T[]) => ReactNode;
}

/**
 * Heading of a category (indented under its parent) or of a store: folds its rows, receives the rows dropped on it.
 * @param {GroupRowProps<T>} props Component props.
 * @returns {JSX.Element} Row.
 */
function GroupRow<T>({ row, columns, over, collapsed, onToggle, summary }: GroupRowProps<T>) {
  const { setNodeRef } = useDroppable({ id: `group:${row.id ?? NO_GROUP}`, data: { groupId: row.id } satisfies DropData });
  return (
    <Table.Tr ref={setNodeRef} className={classes.groupRow} data-over={over || undefined} data-depth={row.depth}>
      <Table.Td colSpan={columns} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` }}>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={collapsed ? 'Déplier' : 'Replier'}>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Déplier' : 'Replier'} ${row.name}`} onClick={onToggle}>
              {collapsed ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
            </ActionIcon>
          </Tooltip>
          {row.color && <ColorSwatch color={row.color} size={12} />}
          <Text size="sm" fw={row.depth === 0 ? 700 : 600}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {summary ? summary(row.items) : row.items.length || ''}
          </Text>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Table of products or items, as the tree of their categories (or by store): each field changed in place, a row moved
 * to another category (or store) by drag and drop on its heading or one of its rows; the empty categories show
 * while dragging.
 * @param {ShoppingTableProps<T>} props Component props.
 * @returns {JSX.Element} Table.
 */
export function ShoppingTable<T extends ShoppingFields>({ items, grouping, label, summary, categories, ...rowProps }: ShoppingTableProps<T>) {
  const { data } = useShoppingData();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState<T | null>(null);
  // Group under the dragged row: undefined for none, null for the one without category (or store).
  const [overGroup, setOverGroup] = useState<string | null | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const labels = { categories: categories ?? data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] };
  const rows = visibleRows(shoppingRows(items, grouping, labels, active !== null), collapsed);
  const columns = 12 + (rowProps.extra ? 1 : 0);
  const field = grouping === 'category' ? 'categoryId' : 'storeId';

  /**
   * Folds or unfolds a group.
   * @param {string | null} id Group id.
   * @returns {void}
   */
  const toggle = (id: string | null) =>
    setCollapsed((current) => {
      const next = new Set(current);
      const key = id ?? NO_GROUP;
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /**
   * Moves the dropped row to the category (or store) it was dropped on.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    setOverGroup(undefined);
    const row = items.find((item) => `row:${item.id}` === dragged.id);
    const target = over?.data.current as DropData | undefined;
    if (!row || !target || (row[field] ?? null) === target.groupId) return;
    rowProps.onSave(row, { ...inputOf(row), [field]: target.groupId });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active: dragged }) => setActive(items.find((item) => `row:${item.id}` === dragged.id) ?? null)}
      onDragOver={({ over }) => setOverGroup(over ? ((over.data.current as DropData | undefined)?.groupId ?? null) : undefined)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActive(null);
        setOverGroup(undefined);
      }}
      accessibility={{
        announcements: {
          onDragStart: () => `${active?.name ?? 'Ligne'} saisie.`,
          onDragOver: () => '',
          onDragEnd: ({ over }) => (over ? 'Ligne déplacée.' : 'Déplacement annulé.'),
          onDragCancel: () => 'Déplacement annulé.',
        },
      }}
    >
      <Paper withBorder radius="md" className={classes.group}>
        <div className={classes.scroller}>
          <Table verticalSpacing={2} miw={1300} aria-label={label} className={classes.table}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={32} px={4} />
                <Table.Th w={36} px={4} />
                <Table.Th miw={200}>Produit</Table.Th>
                <Table.Th w={150}>Magasin</Table.Th>
                <Table.Th w={88} ta="right">
                  Quantité
                </Table.Th>
                <Table.Th w={100}>Unité</Table.Th>
                <Table.Th w={104} ta="right">
                  Prix unitaire
                </Table.Th>
                <Table.Th w={150}>Conservation</Table.Th>
                <Table.Th w={120}>Péremption</Table.Th>
                <Table.Th w={170}>Pour</Table.Th>
                <Table.Th w={150}>Lien</Table.Th>
                {rowProps.extra && <Table.Th w={120}>{rowProps.extra.title}</Table.Th>}
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) =>
                row.kind === 'group' ? (
                  <GroupRow
                    key={`group:${row.id ?? NO_GROUP}`}
                    row={row}
                    columns={columns}
                    over={active !== null && overGroup === row.id}
                    collapsed={collapsed.has(row.id ?? NO_GROUP)}
                    onToggle={() => toggle(row.id)}
                    summary={summary}
                  />
                ) : (
                  <ItemRow key={row.item.id} row={row} over={active !== null && overGroup === row.groupId} {...rowProps} />
                ),
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Paper>
      <DragOverlay dropAnimation={null}>
        {active && (
          <Paper shadow="md" radius="sm" px="sm" py={4} withBorder className={classes.overlay}>
            <Group gap="xs" wrap="nowrap">
              <DotsSixVerticalIcon weight="bold" aria-hidden />
              <Text size="sm" fw={500}>
                {active.name}
              </Text>
            </Group>
          </Paper>
        )}
      </DragOverlay>
    </DndContext>
  );
}
