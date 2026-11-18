import { plural, countOf } from '../../../lib/text';
import { Badge, Button, Group, Text } from '@mantine/core';
import { rowPeopleKeys, rowPeopleOf, usePeople } from '../../shopping/lib/shopping-format';
import { ArchiveIcon, ArrowCounterClockwiseIcon, MinusIcon, PlusIcon, TrashIcon, WarningIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { EditableCheck, EditableMultiSelect, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { openFormPanel } from '../../../components/panels/panels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { categoryOptions, categoryPaths } from '../../../components/tree/category-tree';
import { localToday } from '../../../lib/dates';
import { addDays, mapById, round2 } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useShoppingData } from '../../shopping/api';
import { stockKey, useStockItems, useStockLocations, useStockMutations, type StockItem } from '../api';
import { LotsTable } from './LotsTable';
import { MovementsTable } from './MovementsTable';
import { StockCountForm } from './StockCountForm';
import { StockItemForm } from './StockItemForm';
import { StockMoveForm } from './StockMoveForm';
import { archiveRowsAction, deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { nextExpiry, stockItemInput } from '../lib/stock-format';
import { archiveWithUndo, unarchivedOffered, useSetArchived, visibleItems } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { CategoryCell, UnitCell } from '../../shopping/components/shopping-cells';

type Change = Partial<Parameters<typeof stockItemInput>[1]>;

/** Days before its date a lot is « soon » expired. */
const SOON = 3;

/**
 * Items of the stock in a table like every other (grouped, filtered, sorted by any column; each field changed in
 * place and in bulk): their quantity (that of their lots, unfolded under them), what is used up, added, lost by hand,
 * their history; an inventory made from it. The archived items are hidden until « Afficher les archivés », read only.
 * @returns {JSX.Element} Table.
 */
export function StockTable() {
  const { data: items } = useStockItems();
  const { data: locations } = useStockLocations();
  const { data: shopping } = useShoppingData();
  const people = usePeople();
  const mutations = useStockMutations();
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const setArchived = useSetArchived('STOCK_ITEM', [stockKey]);
  const [showArchived, setShowArchived] = useState(false);
  const rows = visibleItems(items ?? [], showArchived);
  const today = localToday();
  const soon = addDays(today, SOON);
  const places = categoryPaths(locations ?? []);
  const categories = shopping?.shoppingCategories ?? [];
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
      filter: { kind: 'choice', value: (item) => item.locationId ?? null, options: withArchived(categoryOptions(locations ?? []), locations ?? []) },
      groupable: true,
    },
    categoryColumn<StockItem>(categories),
    quantityColumn<StockItem>({ size: 110, bulk: false }),
    unitColumn<StockItem>({ groupable: true }),
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
      text: (item) => item.lots.map((lot) => `${fmt.number(lot.quantity, 3)}${lot.expiresAt ? ` · ${fmt.day(lot.expiresAt)}` : ''}`).join(', '),
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
    consumableColumn<StockItem>({ bulk: false, hiddenByDefault: true }),
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
    noteColumn<StockItem>({ hiddenByDefault: true }),
    {
      id: 'updatedAt',
      label: 'Modifié le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (item) => item.updatedAt,
      text: (item) => fmt.day(item.updatedAt),
      filter: { kind: 'date', value: (item) => item.updatedAt.slice(0, 10) },
    },
    commentColumn<StockItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
  const view = useDataView({ tableKey: 'stock', getKey: (item) => item.id, columns, rows: [...rows], title: 'Inventaire' });
  const onError = { onError: onMutationError };
  // The archived items are left as they are.
  const bulk = bulkSaver<StockItem, Change>(
    view,
    (item, change) => !item.archived && Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: stockItemInput(item, change) }, onError),
  );
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
      isArchived={(item) => item.archived}
      readOnly={(item) => item.archived}
      selectionActions={(rows, clear) => [
        archiveRowsAction({
          archived: rows.every((item) => item.archived),
          apply: (archived) => setArchived.mutateAsync({ ids: rows.map((item) => item.id), archived }),
          label: countOf(rows.length, 'article'),
          count: rows.length,
          clear,
        }),
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
            <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={(items ?? []).filter((item) => item.archived).length} />
            <ActionButton
              priority="secondary"
              icon={<ListChecksIcon aria-hidden />}
              onClick={() => openFormPanel('Faire l’inventaire', (close) => <StockCountForm onDone={close} />, 'lg')}
              disabled={!rows.some((item) => !item.archived)}
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
      details={(item) => (unfolded.has(item.id) ? <LotsTable item={item} readOnly={item.archived} /> : null)}
      cells={(item) => {
        const first = nextExpiry(item);
        const readOnly = item.archived;
        return {
          label: (
            <Group gap={4} wrap="nowrap">
              <EditableText value={item.label} label={`Libellé de ${item.label}`} strong readOnly={readOnly} onSave={(label) => label && bulk('label')(item, { label })} />
              {item.archived && <ArchivedBadge size="xs" />}
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
              readOnly={readOnly}
              {...treeSelectProps(categoryOptions(locations ?? [], undefined, unarchivedOffered(locations ?? [], item.locationId)))}
              onSave={(locationId) => bulk('location')(item, { locationId })}
            />
          ),
          category: (
            <CategoryCell
              value={item.categoryId ?? null}
              categories={categories}
              label={`Catégorie de ${item.label}`}
              readOnly={readOnly}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: (
            <Text span size="sm" ff="monospace" c={item.quantity <= 0 ? 'dimmed' : undefined}>
              {fmt.number(item.quantity, 3)}
            </Text>
          ),
          unit: <UnitCell value={item.unit ?? null} label={`Unité de ${item.label}`} readOnly={readOnly} onSave={(unit) => bulk('unit')(item, { unit })} />,
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
                      · {fmt.day(lot.expiresAt)}
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
              readOnly={readOnly}
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
          perishable: <EditableCheck value={item.perishable} label={`${item.label} périssable`} readOnly={readOnly} onSave={(perishable) => bulk('perishable')(item, { perishable })} />,
          note: <EditableText value={item.note ?? null} label={`Description de ${item.label}`} nullable readOnly={readOnly} onSave={(note) => bulk('note')(item, { note })} />,
        };
      }}
      actions={(item) => (
        <RowActions
          name={item.label}
          primary={
            !item.archived && {
              label: 'Retirer 1',
              icon: <MinusIcon aria-hidden />,
              onClick: () => mutations.move.mutate({ itemId: item.id, kind: 'CONSUMPTION', quantity: 1, lotId: null, expiresAt: null, note: null }, onError),
            }
          }
          items={[
            // Archived: read only.
            !item.archived && {
              label: 'Consommer, ajouter, perdre…',
              icon: <PlusIcon aria-hidden />,
              onClick: () => openFormPanel(item.label, (close) => <StockMoveForm item={item} onDone={close} />),
            },
            { label: 'Historique', icon: <ClockCounterClockwiseIcon aria-hidden />, onClick: () => openFormPanel(`Historique · ${item.label}`, () => <MovementsTable itemId={item.id} />, 'lg') },
            {
              label: item.archived ? 'Restaurer' : 'Archiver',
              icon: item.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
              onClick: () => void archiveWithUndo(setArchived, { ids: [item.id], archived: !item.archived, label: `Article « ${item.label} »` }),
            },
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
