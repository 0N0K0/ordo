import { plural, countOf } from '../../../lib/text';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { ArrowCounterClockwiseIcon, ClipboardTextIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { EditableCheck, EditableNumber, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';
import { openFormPanel } from '../../../components/panels/panels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { categoryTree } from '../../../components/tree/category-tree';
import * as fmt from '../../../lib/format';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useShoppingData } from '../../shopping/api';
import { shoppingCategoryOptions } from '../../shopping/lib/shopping-format';
import { useChecklist, useSheetMutations, type ChecklistItem, type SheetOwner } from '../api';
import { SheetLinksField } from './SheetLinksField';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { SheetPicker } from './SheetPicker';

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
  const [label, setLabel] = useState('');
  const categories = shopping?.shoppingCategories ?? [];
  const paths = new Map(categoryTree(categories).map((item) => [item.category.id, item.path]));
  const categoryName = (item: ChecklistItem) => (item.categoryId ? (paths.get(item.categoryId) ?? '') : '');
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
    {
      id: 'quantity',
      label: 'Quantité',
      size: 100,
      numeric: true,
      bulk: true,
      sortValue: (item) => item.quantity ?? null,
      text: (item) => (item.quantity === null || item.quantity === undefined ? '' : fmt.number(item.quantity, 3)),
      filter: { kind: 'number', value: (item) => item.quantity ?? null },
    },
    { id: 'unit', label: 'Unité', size: 90, bulk: true, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '' },
    {
      id: 'category',
      label: 'Catégorie',
      size: 160,
      bulk: true,
      sortValue: (item) => categoryName(item) || null,
      text: categoryName,
      filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: [...paths].map(([value, name]) => ({ value, label: name })) },
      groupable: true,
    },
    {
      id: 'consumable',
      label: 'Consommable',
      size: 120,
      bulk: true,
      hiddenByDefault: true,
      sortValue: (item) => (item.consumable ? 1 : 0),
      text: (item) => (item.consumable ? 'Consommable' : ''),
      filter: { kind: 'boolean', value: (item) => item.consumable },
      groupable: true,
    },
    { id: 'note', label: 'Description', size: 220, bulk: true, hiddenByDefault: true, sortValue: (item) => item.note ?? null, text: (item) => item.note ?? '' },
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
  const onError = { onError: onMutationError };

  /**
   * Saves a change of an item (its other fields kept).
   * @param {ChecklistItem} item Item.
   * @param {ItemChange} change Change.
   * @returns {void}
   */
  const saveItem = (item: ChecklistItem, change: ItemChange) => {
    if (change.checked !== undefined) return mutations.setChecked.mutate({ ids: [item.id], checked: change.checked }, onError);
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
      onError,
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
      <Group justify="space-between" gap="sm">
        <Text size="sm" c="dimmed">
          {done} / {list.items.length} {plural(done, 'fait')}
          {occurrenceDate ? ` · ${fmt.dayLong(occurrenceDate)}` : ''}
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<PlusIcon aria-hidden />}
            onClick={() =>
              openFormPanel('Ajouter une fiche', (close) => <SheetPicker onAdd={(sheetId, multiplier) => mutations.addToChecklist.mutateAsync({ id: list.id, sheetId, multiplier })} onDone={close} />)
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
                onConfirm: () => mutations.resetChecklist.mutate(list.id, { onSuccess: () => notifySuccess('Liste refaite.'), ...onError }),
              })
            }
          >
            Refaire depuis les fiches
          </Button>
        </Group>
      </Group>
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
        rowProps={(item) => ({ style: item.checkedAt ? { opacity: 0.6 } : undefined })}
        cells={(item) => ({
          done: <EditableCheck value={Boolean(item.checkedAt)} label={`${item.label} fait`} onSave={(checked) => bulk('done')(item, { checked })} />,
          label: <EditableText value={item.label} label={`Libellé de ${item.label}`} onSave={(next) => next && bulk('label')(item, { label: next })} />,
          quantity: <EditableNumber value={item.quantity ?? null} label={`Quantité de ${item.label}`} decimals={3} nullable onSave={(quantity) => bulk('quantity')(item, { quantity })} />,
          unit: <EditableText value={item.unit ?? null} label={`Unité de ${item.label}`} nullable onSave={(unit) => bulk('unit')(item, { unit })} />,
          category: (
            <EditableSelect
              value={item.categoryId ?? null}
              label={`Catégorie de ${item.label}`}
              nullable
              {...treeSelectProps(shoppingCategoryOptions(categories))}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
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
          <RowActions name={item.label} items={[{ label: 'Retirer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => mutations.removeChecklistItem.mutate(item.id, onError) }]} />
        )}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const name = label.trim();
          if (!name) return;
          mutations.addChecklistItem.mutate(
            { listId: list.id, input: { productId: null, label: name, categoryId: null, quantity: null, unit: null, note: null, consumable: false } },
            { onSuccess: () => setLabel(''), ...onError },
          );
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <TextInput size="xs" style={{ flex: 1 }} aria-label="Ajouter un élément" placeholder="Ajouter un élément (Entrée)" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <Button type="submit" size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} disabled={!label.trim()}>
            Ajouter
          </Button>
        </Group>
      </form>
      <SheetLinksField owner={owner} />
    </Stack>
  );
}
