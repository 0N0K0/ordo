import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Anchor, Button, Group, Stack, Switch, Text } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { ArrowsLeftRightIcon, BasketIcon, ListPlusIcon, PencilSimpleIcon, PlusIcon, ShoppingCartSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { openMoveProducts } from '../lib/open-move-products';
import { DataViewBar } from '../../../components/data-table/toolbar/DataViewBar';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { localDay } from '../../../lib/dates';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList, type ShoppingProduct } from '../api';
import { openNewList } from '../lib/open-new-list';
import { openShoppingForm } from '../lib/open-shopping-form';
import { blankInput, EMPTY_GROUPS_LABEL, categoriesForBaseList, usePeople, type ShoppingGrouping } from '../lib/shopping-format';
import { GroupingControl } from './GroupingControl';
import { itemColumns } from '../lib/shopping-columns';
import { ShoppingTable, type ShoppingToggle } from './ShoppingTable';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableCheck, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps } from '../../../components/tree/tree-select';
import type { ProductStockInput } from '@ordo/shared';
import { useStockLocations, useStockMutations } from '../../stock/api';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { locationOptions, locationPaths } from '../../stock/lib/stock-format';
import { collator } from '../../../lib/text';

/** Views made the first time a base list is shown: every product, the missing ones. */
const BASE_LIST_VIEWS: FirstTableView[] = [
  { name: 'Tous' },
  { name: 'Manquants', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'missing', field: 'missing', operator: 'isTrue', value: null }] } } },
];

/**
 * Asks for confirmation before removing a product from its base list.
 * @param {ShoppingProduct} product Product.
 * @param {() => void} onConfirm Removal.
 * @returns {void}
 */
function confirmDelete(product: ShoppingProduct, onConfirm: () => void): void {
  confirmDestructive({
    title: 'Retirer le produit',
    risks: (
      <>
        <Text size="sm">« {product.name} » sera retiré de la référence, avec son historique d’achat. Les listes déjà faites le gardent. Cette action est irréversible.</Text>
      </>
    ),
    confirmLabel: 'Retirer',
    onConfirm: () => {
      onConfirm();
    },
  });
}

/**
 * « Manque » toggle of the references: a cart, orange when the product is missing (on the next list made).
 * @param {(ids: string[], missing: boolean) => void} save Marks products missing or not.
 * @returns {ShoppingToggle<ShoppingProduct>} Toggle.
 */
const MISSING_TOGGLE = (save: (ids: string[], missing: boolean) => void): ShoppingToggle<ShoppingProduct> => ({
  id: 'missing',
  name: 'Manque',
  value: (product) => product.missing,
  label: (product) => `${product.name} manque`,
  hint: (product) => (product.missing ? 'Manque : sera sur la prochaine liste générée (cliquer : ne manque plus)' : 'Ne manque pas (cliquer : manque)'),
  icon: <ShoppingCartSimpleIcon aria-hidden />,
  color: 'orange',
  onChange: (products, missing) =>
    save(
      products.map((product) => product.id),
      missing,
    ),
});

/**
 * A base list: its products as the tree of their categories (or by store), each marked missing or not and changed
 * in place, moved to another category by drag and drop; the missing ones make a new list.
 * @param {{ baseList: ShoppingBaseList }} props Component props.
 * @returns {JSX.Element} Base list.
 */
export function BaseList({ baseList }: { baseList: ShoppingBaseList }) {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const [grouping, setGrouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.baseGrouping', defaultValue: 'category' });
  const [showEmpty, setShowEmpty] = useLocalStorage({ key: 'ordo.shopping.showEmptyCategories', defaultValue: false });
  const people = usePeople();
  const { data: locations } = useStockLocations();
  const stockMutations = useStockMutations();
  const places = locationPaths(locations ?? []);
  const products = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).sort((a, b) => collator.compare(a.name, b.name));
  const missing = products.filter((product) => product.missing);
  const categories = categoriesForBaseList(data?.shoppingCategories ?? [], baseList.id);
  const productComments = useCommentCounts(
    'SHOPPING_PRODUCT',
    products.map((product) => product.id),
  );
  const columns = itemColumns<ShoppingProduct>(
    grouping,
    { categories, stores: data?.shoppingStores ?? [], storages: data?.shoppingStorages ?? [], members: people.members, relations: people.relations },
    [
      commentColumn<ShoppingProduct>(
        productComments,
        (product) => product.id,
        (product) => product.note,
      ),
      {
        id: 'extra',
        label: 'Dernier achat',
        size: 120,
        sortValue: (product) => product.lastPurchasedAt ?? null,
        text: (product) => (product.lastPurchasedAt ? `${fmt.day(new Date(product.lastPurchasedAt))}${product.lastPrice !== null ? ` · ${fmt.money(product.lastPrice)}` : ''}` : ''),
        filter: { kind: 'date', value: (product) => (product.lastPurchasedAt ? localDay(new Date(product.lastPurchasedAt)) : null) },
      },
      {
        id: 'missing',
        label: 'Manque',
        size: 90,
        hiddenByDefault: true,
        sortValue: (product) => (product.missing ? 1 : 0),
        text: (product) => (product.missing ? 'Manque' : ''),
        filter: { kind: 'boolean', value: (product) => product.missing },
      },
      {
        id: 'stockTracked',
        label: 'Suivie en stock',
        size: 130,
        bulk: true,
        hiddenByDefault: true,
        sortValue: (product) => (product.stockTracked ? 1 : 0),
        text: (product) => (product.stockTracked ? 'Suivie' : ''),
        filter: { kind: 'boolean', value: (product) => product.stockTracked },
        groupable: true,
      },
      {
        id: 'consumable',
        label: 'Consommable',
        size: 120,
        bulk: true,
        hiddenByDefault: true,
        sortValue: (product) => (product.consumable ? 1 : 0),
        text: (product) => (product.consumable ? 'Consommable' : ''),
        filter: { kind: 'boolean', value: (product) => product.consumable },
        groupable: true,
      },
      {
        id: 'autoStock',
        label: 'Ajout auto au stock',
        size: 150,
        bulk: true,
        hiddenByDefault: true,
        sortValue: (product) => (product.autoStock ? 1 : 0),
        text: (product) => (product.autoStock ? 'Automatique' : ''),
        filter: { kind: 'boolean', value: (product) => product.autoStock },
        groupable: true,
      },
      {
        id: 'stockLocation',
        label: 'Emplacement en stock',
        size: 170,
        bulk: true,
        hiddenByDefault: true,
        sortValue: (product) => (product.stockLocationId ? (places.get(product.stockLocationId) ?? '') : null),
        text: (product) => (product.stockLocationId ? (places.get(product.stockLocationId) ?? '') : ''),
        filter: { kind: 'choice', value: (product) => product.stockLocationId ?? null, options: [...places].map(([value, label]) => ({ value, label })) },
        groupable: true,
      },
    ],
  );
  const view = useDataView({
    tableKey: 'shopping-base-list',
    getKey: (item) => item.id,
    columns,
    rows: products,
    title: baseList.name,
    first: BASE_LIST_VIEWS,
    bulkColumns: [{ id: 'missing', label: 'Manque' }],
  });
  const onError = onMutationError;
  // Stock settings of the references, changed in place (and in bulk).
  const stockBulk = bulkSaver<ShoppingProduct, Partial<ProductStockInput>>(view, (product, change) =>
    stockMutations.setProductStock.mutate(
      {
        id: product.id,
        input: { stockTracked: product.stockTracked, consumable: product.consumable, autoStock: product.autoStock, stockLocationId: product.stockLocationId ?? null, ...change },
      },
      { onError },
    ),
  );

  return (
    <Stack gap="md">
      <DataViewBar
        view={view}
        searchLabel="Rechercher un produit"
        manualText="Sans tri : les produits par nom, dans leurs catégories."
        actions={
          <Group gap="sm" wrap="nowrap">
            <ActionButton
              priority="secondary"
              icon={<ArrowsLeftRightIcon aria-hidden />}
              disabled={products.length === 0 || (data?.shoppingBaseLists.length ?? 0) < 2}
              onClick={() => openMoveProducts(baseList)}
            >
              Déplacer des produits
            </ActionButton>
            <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product', baseListId: baseList.id })}>
              Nouveau produit
            </ActionButton>
            <Button leftSection={<ListPlusIcon aria-hidden />} disabled={missing.length === 0} onClick={() => openNewList({ baseListIds: [baseList.id] })}>
              Générer une liste ({missing.length})
            </Button>
          </Group>
        }
        displayOptions={
          <>
            <GroupingControl value={grouping} onChange={setGrouping} />
            <Switch label={EMPTY_GROUPS_LABEL[grouping]} checked={showEmpty} onChange={(event) => setShowEmpty(event.currentTarget.checked)} />
          </>
        }
      />

      {isPending ? (
        <TableSkeleton rows={4} />
      ) : products.length === 0 ? (
        <EmptyState icon={<BasketIcon aria-hidden />} message={<>{products.length ? 'Aucun produit ne correspond.' : `« ${baseList.name} » est vide : ajoutez-y ce que vous achetez d’habitude.`}</>} />
      ) : (
        <ShoppingTable
          view={view}
          items={products}
          selectionLabel={(count) => selectedLabel(count, ['produit', 'produits'], false)}
          selectionActions={(rows, clear) => [
            {
              label: 'Déplacer vers une autre référence…',
              icon: <ArrowsLeftRightIcon aria-hidden />,
              onClick: () =>
                openMoveProducts(
                  baseList,
                  rows.map((product) => product.id),
                ),
            },
            deleteRowsAction(rows, {
              label: 'Retirer',
              title: 'Retirer les produits',
              risks: `${rows.length} produit(s) seront retirés de « ${baseList.name} » ; les listes déjà faites les gardent.`,
              remove: (product) => mutations.deleteProduct.mutateAsync({ id: product.id }),
              done: `${rows.length} produit(s) retiré(s).`,
              clear,
            }),
          ]}
          grouping={grouping}
          showEmpty={showEmpty}
          categories={categories}
          add={{
            label: 'Ajouter un produit',
            // A product added is usually missing.
            onCreate: (name, place) => mutations.createProduct.mutateAsync({ ...blankInput(name, place), baseListId: baseList.id, missing: true }),
          }}
          label={`Produits de ${baseList.name}`}
          onSave={(product, input) => mutations.updateProduct.mutate({ id: product.id, input: { ...input, baseListId: product.baseListId, missing: product.missing } }, { onError })}
          toggle={MISSING_TOGGLE((ids, missing) => mutations.setMissing.mutate({ ids, missing }, { onError }))}
          summary={(items) => `${items.filter((product) => product.missing).length} manquant(s) sur ${items.length}`}
          extraCells={(product) => ({
            stockTracked: <EditableCheck value={product.stockTracked} label={`${product.name} suivie en stock`} onSave={(stockTracked) => stockBulk('stockTracked')(product, { stockTracked })} />,
            consumable: <EditableCheck value={product.consumable} label={`${product.name} consommable`} onSave={(consumable) => stockBulk('consumable')(product, { consumable })} />,
            autoStock: (
              <EditableCheck
                value={product.autoStock}
                label={`${product.name} ajoutée au stock une fois achetée`}
                readOnly={!product.stockTracked}
                onSave={(autoStock) => stockBulk('autoStock')(product, (target) => (target.stockTracked ? { autoStock } : {}))}
              />
            ),
            stockLocation: (
              <EditableSelect
                value={product.stockLocationId ?? null}
                label={`Emplacement en stock de ${product.name}`}
                nullable
                {...treeSelectProps(locationOptions(locations ?? []))}
                onSave={(stockLocationId) => stockBulk('stockLocation')(product, { stockLocationId })}
              />
            ),
          })}
          extra={{
            title: 'Dernier achat',
            render: (product: ShoppingProduct) =>
              product.lastPurchasedAt && (
                <Text size="xs" c="dimmed" title={product.lastPrice !== null ? `${fmt.money(product.lastPrice)} l’unité` : undefined}>
                  {fmt.day(new Date(product.lastPurchasedAt))}
                  {product.lastPrice !== null && ` · ${fmt.money(product.lastPrice)}`}
                </Text>
              ),
          }}
          actions={(product) => (
            <RowActions
              name={product.name}
              primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openShoppingForm({ kind: 'product', baseListId: product.baseListId, product }) }}
              items={[
                ...((data?.shoppingBaseLists.length ?? 0) > 1
                  ? [{ label: 'Déplacer vers une autre référence…', icon: <ArrowsLeftRightIcon aria-hidden />, onClick: () => openMoveProducts(baseList, [product.id]) }]
                  : []),
                {
                  label: 'Retirer',
                  icon: <TrashIcon aria-hidden />,
                  danger: true,
                  onClick: () => confirmDelete(product, () => mutations.deleteProduct.mutate({ id: product.id }, { onSuccess: () => notifySuccess('Produit retiré.'), onError })),
                },
              ]}
            />
          )}
        />
      )}
      {missing.length > 0 && (
        <Text size="xs" c="dimmed">
          Cocher un produit comme acheté sur une liste le retire des manquants.{' '}
          <Anchor component="button" type="button" size="xs" onClick={() => mutations.setMissing.mutate({ ids: missing.map((product) => product.id), missing: false }, { onError })}>
            Tout décocher
          </Anchor>
        </Text>
      )}
    </Stack>
  );
}
