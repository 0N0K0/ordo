import { locationSelectProps } from '../hooks/use-location-select';
import { Badge, Group, Text } from '@mantine/core';
import { rowPeopleKeys, rowPeopleOf, usePeople } from '../../shopping/lib/shopping-format';
import { ArchiveIcon, MinusIcon, PlusIcon, WarningIcon, ClockCounterClockwiseIcon, ListChecksIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { WARNING_YES_NEUTRAL_NO_ICONS, withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { EditableCheck, EditableMultiSelect, EditableSelect, EditableText, EditableMarkdown } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { openFormPanel } from '../../../components/panels/panels';

import { categoryOptions, categoryPaths } from '../../../components/tree/category-tree';
import { localDay, localToday } from '../../../lib/dates';
import { addDays, mapById, round2 } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { ON_ERROR } from '../../../lib/notify';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useShoppingData } from '../../shopping/api';
import { stockKey, useStockItems, useStockLocations, useStockMutations, type StockItem } from '../api';
import { LotsTable } from './LotsTable';
import { MovementsTable } from './MovementsTable';
import { StockCountForm } from './StockCountForm';
import { StockItemForm } from './StockItemForm';
import { StockMoveForm } from './StockMoveForm';
import { archiveItemsAction, deleteItemsAction, rowLabel, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { nextExpiry, stockItemInput } from '../lib/stock-format';
import { archiveEntry, useSetArchived, useArchivedToggle, unarchived } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { CategoryCell, UnitCell } from '../../shopping/components/shopping-cells';
import { FoldHeading } from '../../../components/actions/FoldHeading';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';

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
  const { shown: rows, toggle: archivedToggle } = useArchivedToggle(items ?? []);
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
    { id: 'label', required: true, label: 'Article', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
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
    quantityColumn<StockItem>({ size: 110, bulk: false, required: true }),
    unitColumn<StockItem>({ groupable: true }),
    {
      id: 'expiry',
      label: 'Date de péremption',
      size: 150,
      sortValue: nextExpiry,
      text: (item) => (nextExpiry(item) ? fmt.day(nextExpiry(item)!) : ''),
      filter: { kind: 'date', value: nextExpiry },
      groupable: true,
    },
    {
      id: 'lots',
      required: true,
      label: 'Lots',
      size: 170,
      hiddenByDefault: true,
      text: (item) => item.lots.map((lot) => `${fmt.quantity({ quantity: lot.quantity })}${lot.expiresAt ? ` · ${fmt.day(lot.expiresAt)}` : ''}`).join(', '),
      filter: { kind: 'number', value: (item) => item.lots.length },
    },
    {
      id: 'people',
      label: 'Bénéficiaires',
      size: 170,
      bulk: true,
      sortValue: (item) => whom(item).join(', ') || null,
      text: (item) => whom(item).join(', '),
      filter: {
        kind: 'choices',
        value: (item) => rowPeopleKeys(item),
        options: withArchived(
          people.options.flatMap((group) => group.items),
          people.archived,
        ),
      },
      groupable: true,
    },
    booleanColumn<StockItem>({ id: 'perishable', label: 'Périssable', size: 110, bulk: true, hiddenByDefault: true, groupable: true, groupLabels: { yes: 'Périssable', no: 'Durable' }, icons: WARNING_YES_NEUTRAL_NO_ICONS, value: (item) => item.perishable }),
    consumableColumn<StockItem>({ bulk: false, hiddenByDefault: true }),
    {
      id: 'reference',
      label: 'Référence',
      size: 160,
      hiddenByDefault: true,
      sortValue: (item) => (item.productId ? (products.get(item.productId)?.label ?? '') : null),
      text: (item) => (item.productId ? (products.get(item.productId)?.label ?? '') : ''),
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
      required: true,
      label: 'Modifié le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (item) => item.updatedAt,
      text: (item) => fmt.day(item.updatedAt),
      filter: { kind: 'date', value: (item) => localDay(item.updatedAt) },
    },
    commentColumn<StockItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
  const view = useDataView({ tableKey: 'stock', getKey: (item) => item.id, columns, rows: [...rows], title: 'Inventaire' });
  // The archived items are left as they are.
  const cellLabelOf = bulkCellLabels(view, (item) => item.label);
  const bulk = bulkSaver<StockItem, Change>(
    view,
    (item, change) => !item.archived && Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: stockItemInput(item, change) }, ON_ERROR),
  );
  const toggle = (id: string) =>
    setUnfolded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /**
   * « Supprimer » of articles, on a row as on a selection.
   * @param {StockItem[]} rows Articles.
   * @param {() => void} [clear] Clears the selection once done. Optional.
   * @returns {SelectionAction} Action.
   */
  const deleteItems = (rows: StockItem[], clear?: () => void) =>
    deleteItemsAction(rows, {
      noun: 'article',
      the: 'l’article',
      label: rowLabel,
      risks: (subject, one) => `${subject} ${one ? 'sera supprimé' : 'seront supprimés'} définitivement du stock, avec ${one ? 'ses' : 'leurs'} lots et ${one ? 'son' : 'leur'} historique.`,
      remove: (item) => mutations.deleteItem.mutateAsync(item.id),
      clear,
    });

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['article', 'articles'], false)}
      isArchived={(item) => item.archived}
      readOnly={(item) => item.archived}
      selectionActions={(rows, clear) => [archiveItemsAction(rows, setArchived, { noun: 'article', clear }), deleteItems(rows, clear)]}
      verticalSpacing="xs"
      bar={{
        searchLabel: 'Rechercher (article, description)',
        actions: (
          <Group gap="sm">
            <ShowArchivedSwitch {...archivedToggle} />
            <ActionButton
              priority="secondary"
              icon={<ListChecksIcon aria-hidden />}
              onClick={() => openFormPanel('Faire l’inventaire', (close) => <StockCountForm onDone={close} />, 'lg')}
              disabled={unarchived(rows).length === 0}
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
              <EditableText value={item.label} label={cellLabelOf('label', item, 'Libellé')} strong readOnly={readOnly} onSave={(label) => label && bulk('label')(item, { label })} />
              {item.archived && <ArchivedBadge size="xs" />}
              {item.lots.length > 1 && (
                <FoldHeading inline expanded={unfolded.has(item.id)} onToggle={() => toggle(item.id)} count={item.lots.length} about={`les lots de « ${item.label} »`}>
                  lots
                </FoldHeading>
              )}
            </Group>
          ),
          location: (
            <EditableSelect
              value={item.locationId ?? null}
              label={cellLabelOf('location', item, 'Emplacement')}
              nullable
              readOnly={readOnly}
              {...locationSelectProps(locations ?? [], item.locationId)}
              onSave={(locationId) => bulk('location')(item, { locationId })}
            />
          ),
          category: (
            <CategoryCell
              value={item.categoryId ?? null}
              categories={categories}
              label={cellLabelOf('category', item, 'Catégorie')}
              readOnly={readOnly}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: (
            <Text span size="sm" ff="monospace" c={item.quantity <= 0 ? 'dimmed' : undefined}>
              {fmt.quantity({ quantity: item.quantity })}
            </Text>
          ),
          unit: <UnitCell value={item.unit ?? null} label={cellLabelOf('unit', item, 'Unité')} readOnly={readOnly} onSave={(unit) => bulk('unit')(item, { unit })} />,
          expiry: first && (
            <Badge size="sm" variant="light" color={first < today ? 'red' : first <= soon ? 'orange' : 'gray'} leftSection={first <= soon ? <WarningIcon aria-hidden /> : undefined}>
              {fmt.day(first)}
            </Badge>
          ),
          lots: (
            <StackedValues>
              {item.lots.map((lot) => (
                <Text key={lot.id} size="sm">
                  {fmt.quantity({ quantity: lot.quantity })}
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
              label={cellLabelOf('people', item, 'Bénéficiaires')}
              data={people.optionsFor(item.relationIds)}
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
          perishable: (
            <EditableCheck value={item.perishable} label={cellLabelOf('perishable', item, 'Périssable')} readOnly={readOnly} onSave={(perishable) => bulk('perishable')(item, { perishable })} />
          ),
          note: <EditableMarkdown value={item.note ?? null} label={cellLabelOf('note', item, 'Description')} readOnly={readOnly} onSave={(note) => bulk('note')(item, { note })} />,
        };
      }}
      actions={(item) => (
        <RowActions
          name={item.label}
          primary={
            !item.archived && {
              label: 'Retirer 1',
              icon: <MinusIcon aria-hidden />,
              onClick: () => mutations.move.mutate({ itemId: item.id, kind: 'CONSUMPTION', quantity: 1, lotId: null, expiresAt: null, note: null }, ON_ERROR),
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
            archiveEntry({ archived: item.archived, type: 'Article', label: item.label }, setArchived, item.id),
            rowMenuEntry(deleteItems([item])),
          ]}
        />
      )}
    />
  );
}
