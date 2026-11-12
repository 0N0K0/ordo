import { ActionIcon, Anchor, Button, Checkbox, Group, Paper, SegmentedControl, Skeleton, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { BasketIcon, ListPlusIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList, type ShoppingProduct } from './api';
import { openNewList } from './open-new-list';
import { openShoppingForm } from './open-shopping-form';
import { categoriesForBaseList, money, type ShoppingGrouping } from './shopping-format';
import { ShoppingTable } from './ShoppingTable';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

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
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [search, setSearch] = useState('');
  const products = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).sort((a, b) => collator.compare(a.name, b.name));
  const missing = products.filter((product) => product.missing);
  const needle = search.trim().toLocaleLowerCase('fr');
  const shown = products.filter((product) => (!onlyMissing || product.missing) && (!needle || product.name.toLocaleLowerCase('fr').includes(needle)));
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={grouping}
          onChange={(value) => setGrouping(value as ShoppingGrouping)}
          data={[
            { value: 'category', label: 'Par catégorie' },
            { value: 'store', label: 'Par magasin' },
          ]}
          aria-label="Regrouper"
        />
        <TextInput
          size="xs"
          placeholder="Rechercher"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          aria-label="Rechercher un produit"
        />
        <Checkbox size="xs" label="Manquants seulement" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.currentTarget.checked)} />
        <Group gap="sm" ml="auto">
          <Button variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product', baseListId: baseList.id })}>
            Ajouter un produit
          </Button>
          <Button leftSection={<ListPlusIcon aria-hidden />} disabled={missing.length === 0} onClick={() => openNewList({ baseListIds: [baseList.id] })}>
            Générer une liste ({missing.length})
          </Button>
        </Group>
      </Group>

      {isPending ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      ) : shown.length === 0 ? (
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
          items={shown}
          grouping={grouping}
          categories={categoriesForBaseList(data?.shoppingCategories ?? [], baseList.id)}
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
            render: (product) =>
              product.lastPurchasedAt && (
                <Text size="xs" c="dimmed" title={product.lastPrice !== null ? `${money(product.lastPrice)} l’unité` : undefined}>
                  {dayFormat.format(new Date(product.lastPurchasedAt))}
                  {product.lastPrice !== null && ` · ${money(product.lastPrice)}`}
                </Text>
              ),
          }}
          actions={(product) => (
            <>
              <Tooltip label="Modifier (catégorie, liste type, note…)">
                <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${product.name}`} onClick={() => openShoppingForm({ kind: 'product', baseListId: product.baseListId, product })}>
                  <PencilSimpleIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Retirer">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Retirer ${product.name}`}
                  onClick={() => confirmDelete(product, () => mutations.deleteProduct.mutate({ id: product.id }, { onSuccess: () => notifySuccess('Produit retiré.'), onError }))}
                >
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </>
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
