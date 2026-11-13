import { Anchor, Button, Checkbox, Group, Paper, Skeleton, Stack, Switch, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { BasketIcon, ListPlusIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { DataViewBar } from '../../components/data-table/DataViewBar';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { localDay } from '../../lib/dates';
import { RowActions } from '../../components/data-table/RowActions';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList, type ShoppingProduct } from './api';
import { openNewList } from './open-new-list';
import { openShoppingForm } from './open-shopping-form';
import { blankInput, categoriesForBaseList, money, usePeople, type ShoppingGrouping } from './shopping-format';
import { GroupingControl } from './GroupingControl';
import { itemColumns } from './shopping-columns';
import { ShoppingTable } from './ShoppingTable';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

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
  const modalId = `delete-shopping-product-${product.id}`;
  modals.open({
    modalId,
    title: 'Retirer le produit',
    children: (
      <Stack gap="md">
        <Text size="sm">« {product.name} » sera retiré de la liste type, avec son historique d’achat. Les listes déjà faites le gardent. Cette action est irréversible.</Text>
        <DestructiveActions
          loading={false}
          onCancel={() => modals.close(modalId)}
          onConfirm={() => {
            modals.close(modalId);
            onConfirm();
          }}
        />
      </Stack>
    ),
  });
}

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
  const products = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).sort((a, b) => collator.compare(a.name, b.name));
  const missing = products.filter((product) => product.missing);
  const categories = categoriesForBaseList(data?.shoppingCategories ?? [], baseList.id);
  const columns = itemColumns<ShoppingProduct>(grouping, { categories, stores: data?.shoppingStores ?? [], members: people.members, relations: people.relations }, [
    {
      id: 'extra',
      label: 'Dernier achat',
      size: 120,
      sortValue: (product) => product.lastPurchasedAt ?? null,
      text: (product) => (product.lastPurchasedAt ? `${dayFormat.format(new Date(product.lastPurchasedAt))}${product.lastPrice !== null ? ` · ${money(product.lastPrice)}` : ''}` : ''),
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
  ]);
  const view = useDataView({ tableKey: 'shopping-base-list', columns, rows: products, title: baseList.name, first: BASE_LIST_VIEWS });
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Stack gap="md">
      <DataViewBar
        view={view}
        searchLabel="Rechercher un produit"
        manualText="Sans tri : les produits par nom, dans leurs catégories."
        actions={
          <Group gap="sm" wrap="nowrap">
            <Button variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product', baseListId: baseList.id })}>
              Ajouter un produit
            </Button>
            <Button leftSection={<ListPlusIcon aria-hidden />} disabled={missing.length === 0} onClick={() => openNewList({ baseListIds: [baseList.id] })}>
              Générer une liste ({missing.length})
            </Button>
          </Group>
        }
        displayOptions={
          <>
            <GroupingControl value={grouping} onChange={setGrouping} />
            <Switch label={grouping === 'category' ? 'Catégories vides' : 'Magasins vides'} checked={showEmpty} onChange={(event) => setShowEmpty(event.currentTarget.checked)} />
          </>
        }
      />

      {isPending ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      ) : products.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <BasketIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {products.length ? 'Aucun produit ne correspond.' : `« ${baseList.name} » est vide : ajoutez-y ce que vous achetez d’habitude.`}
            </Text>
            {!products.length && (
              <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product', baseListId: baseList.id })}>
                Ajouter un produit
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <ShoppingTable
          view={view}
          items={products}
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
          check={(product) => (
            <Tooltip label="Manque : sera sur la prochaine liste générée">
              <Checkbox
                aria-label={`${product.name} manque`}
                checked={product.missing}
                onChange={(event) => mutations.setMissing.mutate({ ids: [product.id], missing: event.currentTarget.checked }, { onError })}
              />
            </Tooltip>
          )}
          summary={(items) => `${items.filter((product) => product.missing).length} manquant(s) sur ${items.length}`}
          extra={{
            title: 'Dernier achat',
            render: (product: ShoppingProduct) =>
              product.lastPurchasedAt && (
                <Text size="xs" c="dimmed" title={product.lastPrice !== null ? `${money(product.lastPrice)} l’unité` : undefined}>
                  {dayFormat.format(new Date(product.lastPurchasedAt))}
                  {product.lastPrice !== null && ` · ${money(product.lastPrice)}`}
                </Text>
              ),
          }}
          actions={(product) => (
            <RowActions
              name={product.name}
              primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openShoppingForm({ kind: 'product', baseListId: product.baseListId, product }) }}
              items={[
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
