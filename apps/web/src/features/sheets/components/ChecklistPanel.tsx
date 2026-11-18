import { SectionHeader } from '../../../components/page/SectionHeader';
import { plural, countOf } from '../../../lib/text';
import { Button, Stack, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon, ClipboardTextIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { EditableCheck, EditableNumber, EditableText } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';
import { openFormPanel } from '../../../components/panels/panels';

import * as fmt from '../../../lib/format';
import { ON_ERROR } from '../../../lib/notify';
import { useShoppingData } from '../../shopping/api';
import { useChecklist, useSheetMutations, type ChecklistItem, type SheetOwner } from '../api';
import { SheetLinksField } from './SheetLinksField';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { SheetPicker } from './SheetPicker';
import { AddRowField } from '../../../components/data-table/cells/AddRowField';
import { itemGroupFields } from '../lib/sheet-format';
import { checklistItemSchema } from '@ordo/shared';

import { CategoryCell, UnitCell } from '../../shopping/components/shopping-cells';

type ItemChange = { label?: string; categoryId?: string | null; quantity?: number | null; unit?: string | null; note?: string | null; consumable?: boolean; checked?: boolean };

/**
 * Checklist of a routine or an event occurrence, or of a task: made of its sheets when first opened, then ticked and
 * changed freely (items added, changed, removed; sheets added); made again from its sheets on demand.
 * @param {{ owner: SheetOwner, occurrenceDate?: string | null }} props Owner, and the occurrence (routine, event).
 * @returns {JSX.Element} Panel.
 */
export function ChecklistPanel({ owner, occurrenceDate = null }: { owner: SheetOwner; occurrenceDate?: string | null }) {
  const { data: list, isPending } = useChecklist({ ...owner, occurrenceDate });
  const { data: shopping } = useShoppingData();
  const mutations = useSheetMutations();
  const categories = shopping?.shoppingCategories ?? [];
  const columns: DataColumn<ChecklistItem>[] = [
    {
      id: 'done',
      label: 'Fait',
      size: 70,
      bulk: true,
      sortValue: (item) => (item.checkedAt ? 1 : 0),
      text: (item) => (item.checkedAt ? 'Fait' : ''),
      filter: { kind: 'boolean', value: (item) => Boolean(item.checkedAt) },
    },
    { id: 'label', label: 'Élément', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    quantityColumn<ChecklistItem>(),
    unitColumn<ChecklistItem>(),
    categoryColumn<ChecklistItem>(categories, { size: 160 }),
    consumableColumn<ChecklistItem>({ hiddenByDefault: true }),
    noteColumn<ChecklistItem>({ hiddenByDefault: true }),
    {
      id: 'sources',
      label: 'Fiches',
      size: 170,
      text: (item) => item.sources.map((source) => source.name).join(', '),
      filter: {
        kind: 'choices',
        value: (item) => item.sources.map((source) => source.sheetId),
        options: [...new Map((list?.items ?? []).flatMap((item) => item.sources.map((source) => [source.sheetId, source.name] as const)))].map(([value, name]) => ({ value, label: name })),
      },
      groupable: true,
    },
  ];
  const view = useDataView({ tableKey: 'checklist', getKey: (item) => item.id, columns, rows: list?.items ?? [], title: 'Liste à cocher' });

  /**
   * Saves a change of an item (its other fields kept).
   * @param {ChecklistItem} item Item.
   * @param {ItemChange} change Change.
   * @returns {void}
   */
  const saveItem = (item: ChecklistItem, change: ItemChange) => {
    if (change.checked !== undefined) return mutations.setChecked.mutate({ ids: [item.id], checked: change.checked }, ON_ERROR);
    if (!Object.keys(change).length) return;
    mutations.updateChecklistItem.mutate(
      {
        id: item.id,
        input: {
          productId: item.productId ?? null,
          label: item.label,
          categoryId: item.categoryId ?? null,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          note: item.note ?? null,
          consumable: item.consumable,
          ...change,
        },
      },
      ON_ERROR,
    );
  };
  const bulk = bulkSaver<ChecklistItem, ItemChange>(view, saveItem);

  if (isPending) return <TableSkeleton rows={4} />;
  if (!list)
    return (
      <Stack gap="md">
        <EmptyState compact icon={<ClipboardTextIcon aria-hidden />} message="Aucune fiche : ajoutez-en pour faire la liste à cocher." />
        <SheetLinksField owner={owner} />
      </Stack>
    );
  const done = list.items.filter((item) => item.checkedAt).length;

  return (
    <Stack gap="md">
      <SectionHeader
        description={
          <>
            {done} / {list.items.length} {plural(done, 'fait')}
            {occurrenceDate ? ` · ${fmt.dayLong(occurrenceDate)}` : ''}
          </>
        }
        actions={
          <>
            <Button
              size="xs"
              variant="default"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() =>
                openFormPanel('Ajouter une fiche', (close) => (
                  <SheetPicker onAdd={(sheetId, multiplier) => mutations.addToChecklist.mutateAsync({ id: list.id, sheetId, multiplier })} onDone={close} />
                ))
              }
            >
              Ajouter une fiche
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<ArrowCounterClockwiseIcon aria-hidden />}
              onClick={() =>
                confirmDestructive({
                  title: 'Refaire la liste',
                  risks: 'La liste sera refaite à partir des fiches : ce qui est coché, ajouté ou modifié dans cette liste sera perdu.',
                  run: () => mutations.resetChecklist.mutateAsync(list.id),
                  done: 'Liste refaite.',
                })
              }
            >
              Refaire depuis les fiches
            </Button>
          </>
        }
      />
      <DataTable
        view={view}
        verticalSpacing={4}
        selectionLabel={(count) => selectedLabel(count, ['élément', 'éléments'], false)}
        selectionActions={(rows, clear) => [
          deleteRowsAction(rows, {
            label: 'Retirer',
            title: 'Retirer les éléments',
            risks: `${countOf(rows.length, 'élément')} seront retirés de la liste à cocher.`,
            remove: (item) => mutations.removeChecklistItem.mutateAsync(item.id),
            done: `${countOf(rows.length, 'élément')} ${plural(rows.length, 'retiré')}.`,
            clear,
          }),
        ]}
        bar={{ searchLabel: 'Rechercher (élément, description)' }}
        getKey={(item) => item.id}
        isDone={(item) => Boolean(item.checkedAt)}
        cells={(item) => ({
          done: <EditableCheck value={Boolean(item.checkedAt)} label={`${item.label} fait`} onSave={(checked) => bulk('done')(item, { checked })} />,
          label: <EditableText value={item.label} label={`Libellé de ${item.label}`} onSave={(next) => next && bulk('label')(item, { label: next })} />,
          quantity: <EditableNumber value={item.quantity ?? null} label={`Quantité de ${item.label}`} decimals={3} nullable onSave={(quantity) => bulk('quantity')(item, { quantity })} />,
          unit: <UnitCell value={item.unit ?? null} label={`Unité de ${item.label}`} onSave={(unit) => bulk('unit')(item, { unit })} />,
          category: <CategoryCell value={item.categoryId ?? null} categories={categories} label={`Catégorie de ${item.label}`} onSave={(categoryId) => bulk('category')(item, { categoryId })} />,
          note: <EditableText value={item.note ?? null} label={`Description de ${item.label}`} nullable onSave={(note) => bulk('note')(item, { note })} />,
          // Ticked, a consumable item that is a reference is taken from the stock.
          consumable: <EditableCheck value={item.consumable} label={`${item.label} consommable`} onSave={(consumable) => bulk('consumable')(item, { consumable })} />,
          sources: (
            <StackedValues>
              {item.sources.map((source) => (
                <Text key={source.sheetId} size="sm" truncate>
                  {source.name}
                </Text>
              ))}
            </StackedValues>
          ),
        })}
        actions={(item) => (
          <RowActions name={item.label} items={[{ label: 'Retirer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => mutations.removeChecklistItem.mutate(item.id, ON_ERROR) }]} />
        )}
        addRow={(group) => {
          // In a group, the item takes its value (its category, unit…); none where it cannot be given.
          const fields = group && view.groupColumn ? itemGroupFields(view.groupColumn.id, group.key) : {};
          return (
            fields && (
              <AddRowField
                label="Ajouter un élément"
                where={`dans ${group?.label ?? 'la liste'}`}
                schema={checklistItemSchema.shape.label}
                onCreate={(name) =>
                  mutations.addChecklistItem.mutateAsync({
                    listId: list.id,
                    input: { productId: null, label: name, categoryId: null, quantity: null, unit: null, note: null, consumable: false, ...fields },
                  })
                }
              />
            )
          );
        }}
      />
      <SheetLinksField owner={owner} />
    </Stack>
  );
}
