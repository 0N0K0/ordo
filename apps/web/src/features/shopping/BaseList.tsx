import { ActionIcon, Anchor, Button, Checkbox, ColorSwatch, Group, Paper, SegmentedControl, Skeleton, Stack, Table, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { shoppingCost } from '@ordo/shared';
import { ArrowSquareOutIcon, BasketIcon, ListPlusIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useShoppingData, useShoppingMutations, type ShoppingProduct } from './api';
import { openNewList } from './open-new-list';
import { openShoppingForm } from './open-shopping-form';
import { groupShopping, money, quantityText, type ShoppingGrouping } from './shopping-format';
import { PeopleBadges } from './ShoppingForm';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Asks for confirmation before removing a product from the base list.
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
        <Text size="sm">« {product.name} » sera retiré de la liste de base, avec son historique d’achat. Les listes déjà faites le gardent. Cette action est irréversible.</Text>
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
 * Base list: the products usually bought, grouped by category (in the order of the aisles) or by store, each
 * marked missing or not; the missing ones make a new list.
 * @returns {JSX.Element} Base list.
 */
export function BaseList() {
  const { data, isPending } = useShoppingData();
  const mutations = useShoppingMutations();
  const [grouping, setGrouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.baseGrouping', defaultValue: 'category' });
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [search, setSearch] = useState('');
  const products = data?.shoppingProducts ?? [];
  const missing = products.filter((product) => product.missing);
  const needle = search.trim().toLocaleLowerCase('fr');
  const shown = products.filter((product) => (!onlyMissing || product.missing) && (!needle || product.name.toLocaleLowerCase('fr').includes(needle)));
  const groups = groupShopping(shown, grouping, { categories: data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] });

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={grouping}
          onChange={(value) => setGrouping(value as ShoppingGrouping)}
          data={[
            { value: 'category', label: 'Par rayon' },
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
          <Button variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product' })}>
            Ajouter un produit
          </Button>
          <Button leftSection={<ListPlusIcon aria-hidden />} disabled={missing.length === 0} onClick={() => openNewList({ fromMissing: true, missingCount: missing.length })}>
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
      ) : groups.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <BasketIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {products.length ? 'Aucun produit ne correspond.' : 'La liste de base est vide : ajoutez-y ce que vous achetez d’habitude.'}
            </Text>
            {!products.length && (
              <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'product' })}>
                Ajouter un produit
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        groups.map((group) => (
          <Paper key={group.id ?? 'none'} withBorder radius="md" component="section" className={classes.group}>
            <Group gap="xs" px="md" py="xs">
              {group.color && <ColorSwatch color={group.color} size={12} />}
              <Title order={2} size="h5">
                {group.name}
              </Title>
              <Text size="xs" c="dimmed">
                {group.items.filter((product) => product.missing).length} manquant(s) sur {group.items.length}
              </Text>
            </Group>
            <div className={classes.scroller}>
              <Table verticalSpacing={4} highlightOnHover miw={720}>
                <Table.Tbody>
                  {group.items.map((product) => {
                    const cost = shoppingCost(product);
                    return (
                      <Table.Tr key={product.id}>
                        <Table.Td w={40}>
                          <Checkbox
                            aria-label={`${product.name} manque`}
                            checked={product.missing}
                            onChange={(event) => mutations.setMissing.mutate({ ids: [product.id], missing: event.currentTarget.checked }, { onError: (error) => notifyError(error.message) })}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm" fw={product.missing ? 600 : undefined}>
                              {product.name}
                            </Text>
                            {product.url && (
                              <Tooltip label={product.url}>
                                <ActionIcon
                                  component="a"
                                  href={product.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="sm"
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`Ouvrir la page de ${product.name}`}
                                >
                                  <ArrowSquareOutIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                          {product.note && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {product.note}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td className={classes.nowrap}>{quantityText(product)}</Table.Td>
                        <Table.Td>
                          <PeopleBadges memberIds={product.memberIds} relationIds={product.relationIds} />
                        </Table.Td>
                        <Table.Td ta="right" ff="monospace" className={classes.nowrap}>
                          {cost !== null ? money(cost) : null}
                        </Table.Td>
                        <Table.Td>
                          {product.lastPurchasedAt && (
                            <Text size="xs" c="dimmed" className={classes.nowrap}>
                              Acheté le {dayFormat.format(new Date(product.lastPurchasedAt))}
                              {product.lastPrice !== null && ` · ${money(product.lastPrice)}`}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td w={80}>
                          <Group gap={2} wrap="nowrap" justify="flex-end">
                            <Tooltip label="Modifier">
                              <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${product.name}`} onClick={() => openShoppingForm({ kind: 'product', product })}>
                                <PencilSimpleIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Retirer">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Retirer ${product.name}`}
                                onClick={() =>
                                  confirmDelete(product, () =>
                                    mutations.deleteProduct.mutate({ id: product.id }, { onSuccess: () => notifySuccess('Produit retiré.'), onError: (error) => notifyError(error.message) }),
                                  )
                                }
                              >
                                <TrashIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        ))
      )}
      {missing.length > 0 && (
        <Text size="xs" c="dimmed">
          Cocher un produit comme acheté sur une liste le retire des manquants.{' '}
          <Anchor component="button" type="button" size="xs" onClick={() => mutations.setMissing.mutate({ ids: missing.map((product) => product.id), missing: false })}>
            Tout décocher
          </Anchor>
        </Text>
      )}
    </Stack>
  );
}
