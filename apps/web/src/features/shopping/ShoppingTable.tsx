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
import { useRef, useState, type ReactNode } from 'react';
import { AddShoppingRow, type ShoppingAdd } from './AddShoppingRow';
import { useShoppingData, type ShoppingCategory } from './api';
import { CategoryCell, ConservationCell, ExpiryCell, NumberCell, PeopleCell, StoreCell, TextCell, UnitCell } from './shopping-cells';
import { inputOf, NO_GROUP, shoppingRows, visibleRows, type ShoppingFields, type ShoppingGrouping, type ShoppingRow } from './shopping-format';
import classes from './Shopping.module.css';
import { ROW_ACTIONS_WIDTH } from '../../components/data-table/RowActions';
import { tableWidth, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import type { DataView } from '../../components/data-table/use-data-view';
import { NoMatch } from '../../components/data-table/GroupHeaderRow';

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

/** Width of the actions column. */
const ACTIONS_WIDTH = ROW_ACTIONS_WIDTH;

export interface ShoppingTableProps<T extends ShoppingFields> {
  /** Every product or item, in their order (to move them). */
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
  /** Row added at the end of each category (or store) and of the table. Optional. */
  add?: ShoppingAdd;
  /** Also the categories (or stores) without rows. Optional. */
  showEmpty?: boolean;
  /** Saved views of the table: the rows it keeps, sorted, its columns (as on every table). */
  view: DataView<T>;
}

interface ItemRowProps<T extends ShoppingFields> extends Omit<ShoppingTableProps<T>, 'items' | 'grouping' | 'label' | 'summary' | 'categories' | 'add' | 'showEmpty' | 'view'> {
  row: Extract<ShoppingRow<T>, { kind: 'item' }>;
  /** Columns shown. */
  shown: ShownColumn<T>[];
  over: boolean;
  /** By store: the column shows the category (the store is the group). */
  grouping: ShoppingGrouping;
  /** Categories offered. */
  categories: ShoppingCategory[];
}

/**
 * Row of a product or an item: its handle (moved to another category), its fields changed in place.
 * @param {ItemRowProps<T>} props Component props.
 * @returns {JSX.Element} Row.
 */
function ItemRow<T extends ShoppingFields>({ row, shown, over, categories, readOnly = false, onSave, check, badge, extra, actions, done }: ItemRowProps<T>) {
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
  const cells: Record<string, ReactNode> = {
    name: (
      <>
        <Group gap={4} wrap="nowrap">
          <TextCell field="name" value={name} label={`Nom de ${name}`} readOnly={readOnly} onSave={(value) => value && save({ name: value })} />
          {badge?.(item)}
        </Group>
        {item.note && (
          <Text size="xs" c="dimmed" lineClamp={1} px={4} title={item.note}>
            {item.note}
          </Text>
        )}
      </>
    ),
    category: <CategoryCell value={item.categoryId ?? null} categories={categories} label={`Catégorie de ${name}`} readOnly={readOnly} onSave={(categoryId) => save({ categoryId })} />,
    store: <StoreCell value={item.storeId ?? null} stores={data?.shoppingStores ?? []} label={`Magasin de ${name}`} readOnly={readOnly} onSave={(storeId) => save({ storeId })} />,
    quantity: <NumberCell kind="quantity" value={item.quantity ?? null} label={`Quantité de ${name}`} readOnly={readOnly} onSave={(quantity) => save({ quantity })} />,
    unit: <UnitCell value={item.unit ?? null} label={`Unité de ${name}`} readOnly={readOnly} onSave={(unit) => save({ unit })} />,
    unitPrice: <NumberCell kind="price" value={item.unitPrice ?? null} label={`Prix unitaire estimé de ${name}`} readOnly={readOnly} onSave={(unitPrice) => save({ unitPrice })} />,
    conservation: (
      <ConservationCell
        perishable={item.perishable}
        storageId={item.storageId ?? null}
        storages={data?.shoppingStorages ?? []}
        label={`Conservation de ${name}`}
        readOnly={readOnly}
        onSave={(conservation) => save({ ...conservation, expiresAt: conservation.perishable ? (item.expiresAt ?? null) : null })}
      />
    ),
    expiresAt: <ExpiryCell value={item.expiresAt ?? null} disabled={!item.perishable} label={`Date de péremption de ${name}`} readOnly={readOnly} onSave={(expiresAt) => save({ expiresAt })} />,
    people: <PeopleCell memberIds={item.memberIds} relationIds={item.relationIds} label={`Pour qui est ${name}`} readOnly={readOnly} onSave={(people) => save(people)} />,
    url: <TextCell field="url" value={item.url ?? null} label={`Lien vers ${name}`} placeholder="https://…" readOnly={readOnly} onSave={(url) => save({ url })} />,
    extra: extra?.render(item),
  };

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
      {shown.map((column, index) => (
        <Table.Td key={column.id} className={tableClasses.cell} style={index === 0 ? { paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth - 1} * var(--mantine-spacing-lg))` } : undefined}>
          {column.id in cells ? cells[column.id] : column.text?.(item)}
        </Table.Td>
      ))}
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
export function ShoppingTable<T extends ShoppingFields>({ items, grouping, label, summary, categories, add, showEmpty = false, view, ...rowProps }: ShoppingTableProps<T>) {
  const { layout, setLayout, sorting, setSorting } = view;
  const tableRef = useRef<HTMLTableElement>(null);
  const { columns: allColumns, shown } = view;
  const { data } = useShoppingData();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState<T | null>(null);
  // Group under the dragged row: undefined for none, null for the one without category (or store).
  const [overGroup, setOverGroup] = useState<string | null | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const labels = { categories: categories ?? data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] };
  // Kept by the view, sorted within their groups (the groups keep their tree).
  const rows = visibleRows(shoppingRows(view.rows, grouping, labels, showEmpty || active !== null), collapsed);
  const columns = shown.length + 3;
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

  /**
   * Rows of the table, with a row to add one at the end of each category (or store) shown unfolded, and at the end
   * of the table when it has no group without category (or store).
   * @returns {ReactNode[]} Rows.
   */
  const body = () => {
    const out: ReactNode[] = [];
    let open: Extract<ShoppingRow<T>, { kind: 'group' }> | null = null;
    /**
     * Closes the open group with its row to add one.
     * @returns {void}
     */
    const close = () => {
      if (add && open && !collapsed.has(open.id ?? NO_GROUP) && active === null) out.push(addRow(open.id, open.depth + 1, open.name));
      open = null;
    };
    for (const row of rows) {
      if (row.kind === 'group') {
        close();
        open = row;
        out.push(
          <GroupRow
            key={`group:${row.id ?? NO_GROUP}`}
            row={row}
            columns={columns}
            over={active !== null && overGroup === row.id}
            collapsed={collapsed.has(row.id ?? NO_GROUP)}
            onToggle={() => toggle(row.id)}
            summary={summary}
          />,
        );
      } else out.push(<ItemRow key={row.item.id} row={row} shown={shown} over={active !== null && overGroup === row.groupId} grouping={grouping} categories={labels.categories} {...rowProps} />);
    }
    close();
    if (add && active === null && !rows.some((row) => row.kind === 'group' && row.id === null)) out.push(addRow(null, 1, grouping === 'category' ? 'Sans catégorie' : 'Sans magasin'));
    return out;
  };

  /**
   * Row adding one in a category (or store).
   * @param {string | null} groupId Category or store, null for none.
   * @param {number} depth Depth of its rows.
   * @param {string} groupName Its name.
   * @returns {JSX.Element} Row.
   */
  const addRow = (groupId: string | null, depth: number, groupName: string) =>
    add && (
      <AddShoppingRow
        key={`add:${groupId ?? NO_GROUP}`}
        {...add}
        place={{ categoryId: grouping === 'category' ? groupId : null, storeId: grouping === 'store' ? groupId : null }}
        depth={depth}
        columns={columns}
        groupName={groupName}
      />
    );

  if (items.length > 0 && view.rows.length === 0) return <NoMatch view={view} />;
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
          <Table ref={tableRef} verticalSpacing={2} aria-label={label} className={`${classes.table} ${tableClasses.table}`} style={{ width: tableWidth(shown, 68 + ACTIONS_WIDTH), minWidth: '100%' }}>
            <DataTableHeader
              columns={allColumns}
              shown={shown}
              layout={layout}
              onLayoutChange={setLayout}
              sorting={sorting}
              onSortingChange={setSorting}
              tableRef={tableRef}
              columnExtras={view.columnExtras}
              leadingCount={2}
              leading={
                <>
                  <Table.Th w={32} px={4} />
                  <Table.Th w={36} px={4} />
                </>
              }
              trailing={<Table.Th w={ACTIONS_WIDTH} />}
            />
            <Table.Tbody>{body()}</Table.Tbody>
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
