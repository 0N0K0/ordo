import { plural, countOf } from '../../../lib/text';
import { Badge, Button, Group, Text } from '@mantine/core';
import { rowPeopleKeys, rowPeopleOf, shoppingCategoryOptions, usePeople } from '../../shopping/lib/shopping-format';
import { ArchiveIcon, MinusIcon, PlusIcon, TrashIcon, WarningIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { EditableCheck, EditableMultiSelect, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { openFormPanel } from '../../../components/panels/panels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { categoryTree } from '../../../components/tree/category-tree';
import { localToday } from '../../../lib/dates';
import { addDays, mapById, round2 } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useShoppingData } from '../../shopping/api';
import { useStockItems, useStockLocations, useStockMutations, type StockItem } from '../api';
import { LotsTable } from './LotsTable';
import { MovementsTable } from './MovementsTable';
import { StockCountForm } from './StockCountForm';
import { StockItemForm } from './StockItemForm';
import { StockMoveForm } from './StockMoveForm';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { locationOptions, locationPaths, nextExpiry, stockItemInput } from '../lib/stock-format';

type Change = Partial<Parameters<typeof stockItemInput>[1]>;

/** Days before its date a lot is « soon » expired. */
const SOON = 3;

/**
 * Items of the stock in a table like every other (grouped, filtered, sorted by any column; each field changed in
 * place and in bulk): their quantity (that of their lots, unfolded under them), what is used up, added, lost by hand,
 * their history; an inventory made from it.
 * @returns {JSX.Element} Table.
 */
export function StockTable() {
  const { data: items } = useStockItems();
  const { data: locations } = useStockLocations();
  const { data: shopping } = useShoppingData();
  const people = usePeople();
  const mutations = useStockMutations();
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const today = localToday();
  const soon = addDays(today, SOON);
  const places = locationPaths(locations ?? []);
  const categories = shopping?.shoppingCategories ?? [];
  const categoryPaths = new Map(categoryTree(categories).map((item) => [item.category.id, item.path]));
  const products = mapById(shopping?.shoppingProducts ?? []);
  const comments = useCommentCounts(
    'STOCK_ITEM',
    (items ?? []).map((item) => item.id),
  );
  const whom = (item: StockItem) => [...item.memberIds.map((id) => people.members.get(id) ?? ''), ...item.relationIds.map((id) => people.relations.get(id) ?? '')].filter(Boolean);
  const value = (item: StockItem) => {
    const price = item.productId ? products.get(item.productId)?.lastPrice : null;
    return price === null || price === undefined ? null : round2(price * item.quantity);
  };
  const columns: DataColumn<StockItem>[] = [
    { id: 'label', label: 'Article', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    {
      id: 'location',
      label: 'Emplacement',
      size: 170,
      bulk: true,
      sortValue: (item) => (item.locationId ? (places.get(item.locationId) ?? '') : null),
      text: (item) => (item.locationId ? (places.get(item.locationId) ?? '') : ''),
      filter: { kind: 'choice', value: (item) => item.locationId ?? null, options: locationOptions(locations ?? []) },
      groupable: true,
    },
    {
      id: 'category',
      label: 'Catégorie',
      size: 170,
      bulk: true,
      sortValue: (item) => (item.categoryId ? (categoryPaths.get(item.categoryId) ?? '') : null),
      text: (item) => (item.categoryId ? (categoryPaths.get(item.categoryId) ?? '') : ''),
      filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: shoppingCategoryOptions(categories) },
      groupable: true,
    },
    {
      id: 'quantity',
      label: 'Quantité',
      size: 110,
      numeric: true,
      sortValue: (item) => item.quantity,
      text: (item) => fmt.number(item.quantity, 3),
      filter: { kind: 'number', value: (item) => item.quantity },
    },
    { id: 'unit', label: 'Unité', size: 90, bulk: true, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '', groupable: true },
    {
      id: 'expiry',
      label: 'Péremption',
      size: 150,
      sortValue: nextExpiry,
      text: (item) => (nextExpiry(item) ? fmt.day(nextExpiry(item)!) : ''),
      filter: { kind: 'date', value: nextExpiry },
      groupable: true,
    },
    {
      id: 'lots',
      label: 'Lots',
      size: 170,
      hiddenByDefault: true,
      text: (item) => item.lots.map((lot) => `${fmt.number(lot.quantity, 3)}${lot.expiresAt ? ` · ${fmt.day(String(lot.expiresAt))}` : ''}`).join(', '),
      filter: { kind: 'number', value: (item) => item.lots.length },
    },
    {
      id: 'people',
      label: 'Bénéficiaires',
      size: 170,
      bulk: true,
      sortValue: (item) => whom(item).join(', ') || null,
      text: (item) => whom(item).join(', '),
      filter: { kind: 'choices', value: (item) => rowPeopleKeys(item), options: people.options.flatMap((group) => group.items) },
      groupable: true,
    },
    {
      id: 'perishable',
      label: 'Périssable',
      size: 110,
      bulk: true,
      hiddenByDefault: true,
      sortValue: (item) => (item.perishable ? 1 : 0),
      text: (item) => (item.perishable ? 'Périssable' : ''),
      filter: { kind: 'boolean', value: (item) => item.perishable },
      groupable: true,
    },
    {
      id: 'consumable',
      label: 'Consommable',
      size: 120,
      hiddenByDefault: true,
      sortValue: (item) => (item.consumable ? 1 : 0),
      text: (item) => (item.consumable ? 'Consommable' : ''),
      filter: { kind: 'boolean', value: (item) => item.consumable },
      groupable: true,
    },
    {
      id: 'reference',
      label: 'Référence',
      size: 160,
      hiddenByDefault: true,
      sortValue: (item) => (item.productId ? (products.get(item.productId)?.name ?? '') : null),
      text: (item) => (item.productId ? (products.get(item.productId)?.name ?? '') : ''),
      filter: { kind: 'boolean', value: (item) => Boolean(item.productId) },
      groupable: true,
    },
    {
      id: 'value',
      label: 'Valeur',
      size: 110,
      numeric: true,
      hiddenByDefault: true,
      sortValue: value,
      formatTotal: fmt.money,
      text: (item) => (value(item) === null ? '' : fmt.money(value(item)!)),
      filter: { kind: 'number', value },
    },
    { id: 'note', label: 'Description', size: 220, bulk: true, hiddenByDefault: true, sortValue: (item) => item.note ?? null, text: (item) => item.note ?? '' },
    {
      id: 'updatedAt',
      label: 'Modifié le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (item) => String(item.updatedAt),
      text: (item) => fmt.day(new Date(item.updatedAt)),
      filter: { kind: 'date', value: (item) => String(item.updatedAt).slice(0, 10) },
    },
    commentColumn<StockItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
  const view = useDataView({ tableKey: 'stock', getKey: (item) => item.id, columns, rows: items ?? [], title: 'Inventaire' });
  const onError = { onError: onMutationError };
  const bulk = bulkSaver<StockItem, Change>(view, (item, change) => Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: stockItemInput(item, change) }, onError));
  const toggle = (id: string) =>
    setUnfolded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['article', 'articles'], false)}
      selectionActions={(rows, clear) => [
        deleteRowsAction(rows, {
          title: 'Supprimer les articles',
          risks: `${countOf(rows.length, 'article')} seront supprimés du stock avec leurs lots et leur historique. Cette action est irréversible.`,
          remove: (item) => mutations.deleteItem.mutateAsync(item.id),
          done: `${countOf(rows.length, 'article')} ${plural(rows.length, 'supprimé')}.`,
          clear,
        }),
      ]}
      verticalSpacing="xs"
      bar={{
        searchLabel: 'Rechercher (article, description)',
        actions: (
          <Group gap="sm">
            <ActionButton
              priority="secondary"
              icon={<ListChecksIcon aria-hidden />}
              onClick={() => openFormPanel('Faire l’inventaire', (close) => <StockCountForm onDone={close} />, 'lg')}
              disabled={!items?.length}
            >
              Faire l’inventaire
            </ActionButton>
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openFormPanel('Nouvel article', (close) => <StockItemForm onDone={close} />)}>
              Nouvel article
            </ActionButton>
          </Group>
        ),
      }}
      empty={
        <EmptyState
          icon={<ArchiveIcon aria-hidden />}
          message="Rien en stock : ajoutez des articles (le contenu du garage, du congélateur…), ou cochez « suivie en stock » sur des références : leurs achats y arrivent."
        />
      }
      getKey={(item) => item.id}
      details={(item) => (unfolded.has(item.id) ? <LotsTable item={item} /> : null)}
      cells={(item) => {
        const first = nextExpiry(item);
        return {
          label: (
            <Group gap={4} wrap="nowrap">
              <EditableText value={item.label} label={`Libellé de ${item.label}`} strong onSave={(label) => label && bulk('label')(item, { label })} />
              {item.lots.length > 1 && (
                <Button variant="subtle" color="gray" size="compact-xs" aria-expanded={unfolded.has(item.id)} onClick={() => toggle(item.id)}>
                  lots ({item.lots.length})
                </Button>
              )}
            </Group>
          ),
          location: (
            <EditableSelect
              value={item.locationId ?? null}
              label={`Emplacement de ${item.label}`}
              nullable
              {...treeSelectProps(locationOptions(locations ?? []))}
              onSave={(locationId) => bulk('location')(item, { locationId })}
            />
          ),
          category: (
            <EditableSelect
              value={item.categoryId ?? null}
              label={`Catégorie de ${item.label}`}
              nullable
              {...treeSelectProps(shoppingCategoryOptions(categories))}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: (
            <Text span size="sm" ff="monospace" c={item.quantity <= 0 ? 'dimmed' : undefined}>
              {fmt.number(item.quantity, 3)}
            </Text>
          ),
          unit: <EditableText value={item.unit ?? null} label={`Unité de ${item.label}`} nullable onSave={(unit) => bulk('unit')(item, { unit })} />,
          expiry: first && (
            <Badge size="sm" variant="light" tt="none" color={first < today ? 'red' : first <= soon ? 'orange' : 'gray'} leftSection={first <= soon ? <WarningIcon aria-hidden /> : undefined}>
              {fmt.day(first)}
            </Badge>
          ),
          lots: (
            <StackedValues>
              {item.lots.map((lot) => (
                <Text key={lot.id} size="sm">
                  {fmt.number(lot.quantity, 3)}
                  {lot.expiresAt && (
                    <Text span size="sm" c="dimmed">
                      {' '}
                      · {fmt.day(String(lot.expiresAt))}
                    </Text>
                  )}
                </Text>
              ))}
            </StackedValues>
          ),
          people: (
            <EditableMultiSelect
              value={rowPeopleKeys(item)}
              label={`Bénéficiaires de ${item.label}`}
              data={people.options}
              onSave={(keys) =>
                bulk('people')(item, (target) => {
                  const before = rowPeopleKeys(item);
                  const mine = rowPeopleKeys(target);
                  const next = applyDiff(mine, before, keys);
                  return rowPeopleOf(next);
                })
              }
            />
          ),
          perishable: <EditableCheck value={item.perishable} label={`${item.label} périssable`} onSave={(perishable) => bulk('perishable')(item, { perishable })} />,
          note: <EditableText value={item.note ?? null} label={`Description de ${item.label}`} nullable onSave={(note) => bulk('note')(item, { note })} />,
        };
      }}
      actions={(item) => (
        <RowActions
          name={item.label}
          primary={{
            label: 'Retirer 1',
            icon: <MinusIcon aria-hidden />,
            onClick: () => mutations.move.mutate({ itemId: item.id, kind: 'CONSUMPTION', quantity: 1, lotId: null, expiresAt: null, note: null }, onError),
          }}
          items={[
            { label: 'Consommer, ajouter, perdre…', icon: <PlusIcon aria-hidden />, onClick: () => openFormPanel(item.label, (close) => <StockMoveForm item={item} onDone={close} />) },
            { label: 'Historique', icon: <ClockCounterClockwiseIcon aria-hidden />, onClick: () => openFormPanel(`Historique · ${item.label}`, () => <MovementsTable itemId={item.id} />, 'lg') },
            {
              label: 'Supprimer',
              icon: <TrashIcon aria-hidden />,
              danger: true,
              onClick: () =>
                confirmDestructive({
                  title: 'Supprimer l’article',
                  risks: `« ${item.label} », ses lots et son historique seront supprimés définitivement du stock.`,
                  onConfirm: () => mutations.deleteItem.mutate(item.id, { onSuccess: () => notifySuccess('Article supprimé.'), ...onError }),
                }),
            },
          ]}
        />
      )}
    />
  );
}
