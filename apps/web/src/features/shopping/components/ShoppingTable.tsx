import { Group, Text } from '@mantine/core';
import { shoppingItemSchema, type ShoppingItemInput } from '@ordo/shared';
import { useMemo, type ReactNode } from 'react';
import { AddShoppingRow, type ShoppingAdd } from './AddShoppingRow';
import { useShoppingData, type ShoppingCategory } from '../api';
import { CategoryCell, ConservationCell, ExpiryCell, PeopleCell, StoreCell, ToggleCell, UnitCell } from './shopping-cells';
import { applyDiff, bulkSaver, type BulkChange } from '../../../components/data-table/selection/bulk-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableCheck, EditableNumber, EditableText } from '../../../components/data-table/cells/EditableCells';
import { DataTable, type GroupTree, type RowMove } from '../../../components/data-table/table/DataTable';
import { groupsOfRow, inputOf, moveToGroup, NO_GROUP_NAME, placeInGroup, sheetSourceText, shoppingRows, usePeople, type ShoppingFields, type ShoppingGrouping } from '../lib/shopping-format';
import classes from './Shopping.module.css';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import type { DataView } from '../../../components/data-table/views/use-data-view';

/** State of the rows a click switches (missing, bought): its own cell before the fields, edited in bulk too. */
export interface ShoppingToggle<T> {
  /** Id of its cell in the bulk selection. */
  id: string;
  /** Name of its cell (« Manque », « Acheté »). */
  name: string;
  value: (row: T) => boolean;
  /** Accessible name of a row's toggle. */
  label: (row: T) => string;
  /** Tooltip of a row's toggle. */
  hint: (row: T) => string;
  icon: ReactNode;
  /** Color when on. */
  color: string;
  /** Switches some rows (one, or those of the bulk selection) on or off. */
  onChange: (rows: T[], on: boolean) => void;
}

interface ShoppingTableProps<T extends ShoppingFields> {
  /** Every product or item, in their order (to move them). */
  items: T[];
  grouping: ShoppingGrouping;
  /** Accessible name of the table. */
  label: string;
  /** Nothing can be changed (a closed or archived list). */
  readOnly?: boolean;
  /** A row that cannot be changed (an archived product), shown dimmed. Optional. */
  rowReadOnly?: (row: T) => boolean;
  /** Saves a row changed in place or moved to another category (or store). */
  onSave: (row: T, input: ShoppingItemInput) => void;
  /** State a click switches on a row (missing, or bought), before its fields; changed in bulk too. */
  toggle: ShoppingToggle<T>;
  /** Badge after the name. */
  badge?: (row: T) => ReactNode;
  /** Column after the link (last purchase…). */
  extra?: { title: string; render: (row: T) => ReactNode };
  /** Cells of the columns of their own (stock, delivery…), by column id. Optional. */
  extraCells?: (row: T) => Record<string, ReactNode>;
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
  /** Actions on the rows checked that the columns cannot do, in a bar under the table. Optional. */
  selectionActions?: (rows: T[], clear: () => void) => SelectionAction[];
  /** Rows checked, told. Optional. */
  selectionLabel?: (count: number) => string;
}

/**
 * Table of products or items, the data table of every table: grouped as the tree of their categories (or by store,
 * way of keeping, person), each field changed in place, a row moved to another group by drag and drop on its heading
 * or one of its rows (the empty groups show while dragging), a row adding one at the end of each group.
 * @param {ShoppingTableProps<T>} props Component props.
 * @returns {JSX.Element} Table.
 */
export function ShoppingTable<T extends ShoppingFields>({
  items,
  grouping,
  label,
  summary,
  categories,
  add,
  showEmpty = false,
  view,
  selectionActions,
  selectionLabel,
  readOnly: tableReadOnly = false,
  rowReadOnly,
  onSave,
  toggle,
  badge,
  extra,
  extraCells,
  actions,
  done,
}: ShoppingTableProps<T>) {
  const { data } = useShoppingData();
  const people = usePeople();
  const allCategories = useMemo(() => categories ?? data?.shoppingCategories ?? [], [categories, data]);
  // Groups of the grouping, as a tree (categories) or a list (stores, ways of keeping, people).
  const groupTree = useMemo((): GroupTree<T> => {
    const labels = { categories: allCategories, stores: data?.shoppingStores ?? [], storages: data?.shoppingStorages ?? [], people: people.byKey };
    const groups = shoppingRows([], grouping, labels, true).flatMap((row) =>
      row.kind === 'group' && row.id !== null ? [{ key: row.id, label: row.label, color: row.color, parentKey: row.parents.at(-1) ?? null }] : [],
    );
    return { groups, groupOf: (row) => groupsOfRow(row, grouping), noneLabel: NO_GROUP_NAME[grouping], showEmpty };
  }, [allCategories, data, people.byKey, grouping, showEmpty]);
  // A change in a cell saves its row, or every row of the bulk selection of its column.
  const saveCell = bulkSaver<T, Partial<ShoppingItemInput>>(view, (row, patch) => Object.keys(patch).length > 0 && onSave(row, { ...inputOf(row), ...patch }));
  // The toggle of a row, or of every row of its bulk selection (all at once).
  const saveToggle = (row: T, on: boolean) =>
    bulkSaver<T, boolean>(
      view,
      (target, value) => toggle.onChange([target], value),
      (targets, change) => toggle.onChange(targets, change(targets[0])),
    )(toggle.id)(row, on);

  /**
   * Moves a dropped row to the group it was dropped in (another category, store, way of keeping or person).
   * @param {RowMove} move Drop.
   * @returns {void}
   */
  const handleMove = (move: RowMove) => {
    if (move.groupKey === undefined) return;
    const row = items.find((item) => item.id === move.key);
    if (row && rowReadOnly?.(row)) return;
    const change = row ? moveToGroup(row, grouping, move.fromGroupKey || null, move.groupKey || null) : null;
    if (row && change) onSave(row, { ...inputOf(row), ...change });
  };

  /**
   * Cells of a product or an item, its fields changed in place.
   * @param {T} item Row.
   * @returns {Record<string, ReactNode>} Cells, by column.
   */
  const cells = (item: T): Record<string, ReactNode> => {
    const readOnly = tableReadOnly || Boolean(rowReadOnly?.(item));
    /**
     * Saves some fields of the row (or of its bulk selection).
     * @param {string} column Column.
     * @param {BulkChange<T, Partial<ShoppingItemInput>>} patch Changed fields.
     * @returns {void}
     */
    const save = (column: string, patch: BulkChange<T, Partial<ShoppingItemInput>>) => saveCell(column)(item, patch);
    const name = item.label;
    return {
      // Columns without an editor of their own: their text.
      ...Object.fromEntries(view.columns.filter((column) => column.text).map((column) => [column.id, column.text!(item)])),
      name: (
        <>
          <Group gap={4} wrap="nowrap">
            <EditableText value={name} label={`Label de ${name}`} schema={shoppingItemSchema.shape.label} strong readOnly={readOnly} onSave={(value) => value && save('name', { label: value })} />
            {badge?.(item)}
          </Group>
          {item.note && (
            <Text size="xs" c="dimmed" lineClamp={1} px={4} title={item.note}>
              {item.note}
            </Text>
          )}
        </>
      ),
      category: (
        <CategoryCell value={item.categoryId ?? null} categories={allCategories} label={`Catégorie de ${name}`} readOnly={readOnly} onSave={(categoryId) => save('category', { categoryId })} />
      ),
      store: <StoreCell value={item.storeId ?? null} stores={data?.shoppingStores ?? []} label={`Magasin de ${name}`} readOnly={readOnly} onSave={(storeId) => save('store', { storeId })} />,
      quantity: (
        <EditableNumber
          value={item.quantity ?? null}
          label={`Quantité de ${name}`}
          decimals={3}
          min={0}
          schema={shoppingItemSchema.shape.quantity}
          readOnly={readOnly}
          onSave={(quantity) => save('quantity', { quantity })}
        />
      ),
      unit: <UnitCell value={item.unit ?? null} label={`Unité de ${name}`} readOnly={readOnly} onSave={(unit) => save('unit', { unit })} />,
      unitPrice: (
        <EditableNumber
          amount
          value={item.unitPrice ?? null}
          label={`Prix unitaire estimé de ${name}`}
          min={0}
          schema={shoppingItemSchema.shape.unitPrice}
          readOnly={readOnly}
          onSave={(unitPrice) => save('unitPrice', { unitPrice })}
        />
      ),
      conservation: (
        <ConservationCell
          perishable={item.perishable}
          storageId={item.storageId ?? null}
          storages={data?.shoppingStorages ?? []}
          label={`Conservation de ${name}`}
          readOnly={readOnly}
          onSave={(conservation) => save('conservation', (target) => ({ ...conservation, expiresAt: conservation.perishable ? (target.expiresAt ?? null) : null }))}
        />
      ),
      expiresAt: (
        <ExpiryCell
          value={item.expiresAt ?? null}
          disabled={!item.perishable}
          label={`Date de péremption de ${name}`}
          readOnly={readOnly}
          onSave={(expiresAt) => save('expiresAt', (target) => (target.perishable ? { expiresAt } : {}))}
        />
      ),
      people: (
        <PeopleCell
          memberIds={item.memberIds}
          relationIds={item.relationIds}
          label={`Bénéficiaires de ${name}`}
          readOnly={readOnly}
          onSave={(chosen) =>
            save('people', (target) => ({ memberIds: applyDiff(target.memberIds, item.memberIds, chosen.memberIds), relationIds: applyDiff(target.relationIds, item.relationIds, chosen.relationIds) }))
          }
        />
      ),
      url: (
        <EditableText
          link
          value={item.url ?? null}
          label={`Lien vers ${name}`}
          placeholder="https://…"
          schema={shoppingItemSchema.shape.url}
          readOnly={readOnly}
          onSave={(url) => save('url', { url })}
        />
      ),
      // An item of a list (a product has none): not needed, bought if possible.
      optional: 'optional' in item && <EditableCheck value={Boolean(item.optional)} label={`${name} facultatif`} readOnly={readOnly} onSave={(optional) => save('optional', { optional })} />,
      // Sheets an item of a list comes from, with their share (products of the references have none).
      sheets: 'sheetSources' in item && Array.isArray(item.sheetSources) && (
        <StackedValues>
          {(item.sheetSources as { sheetId: string; name: string; quantity: number | null }[]).map((source) => (
            <Text key={source.sheetId} size="sm" truncate>
              {sheetSourceText(source)}
            </Text>
          ))}
        </StackedValues>
      ),
      extra: extra?.render(item),
      ...extraCells?.(item),
    };
  };

  return (
    <DataTable
      view={view}
      getKey={(item) => item.id}
      toolbar={false}
      framed
      verticalSpacing={2}
      aria-label={label}
      className={classes.table}
      groupTree={groupTree}
      groupSummary={summary}
      onMoveRow={tableReadOnly ? undefined : handleMove}
      readOnly={tableReadOnly ? () => true : rowReadOnly}
      isArchived={rowReadOnly}
      rowProps={(item) => ({ className: classes.itemRow, 'data-done': done?.(item) || undefined })}
      leading={{
        id: toggle.id,
        width: 36,
        header: null,
        cell: (item) => (
          <ToggleCell
            on={toggle.value(item)}
            label={toggle.label(item)}
            hint={toggle.hint(item)}
            icon={toggle.icon}
            color={toggle.color}
            readOnly={tableReadOnly || Boolean(rowReadOnly?.(item))}
            onSave={(on) => saveToggle(item, on)}
          />
        ),
      }}
      cells={cells}
      actions={(item) => (
        <Group gap={2} wrap="nowrap" justify="flex-end">
          {actions(item)}
        </Group>
      )}
      addRow={add && !tableReadOnly ? (group) => <AddShoppingRow {...add} place={placeInGroup(grouping, group?.key || null)} groupName={group?.label ?? NO_GROUP_NAME[grouping]} /> : undefined}
      selectionActions={selectionActions}
      selectionLabel={selectionLabel}
    />
  );
}
