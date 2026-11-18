import { EmptyState } from '../../../components/feedback/EmptyState';
import { formCallbacks } from '../../../lib/form';
import { categoryPaths } from '../../../components/tree/category-tree';

import { Anchor, Badge, Checkbox, Group, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { FormActions } from '../../../components/dialogs/FormActions';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useShoppingData, useShoppingMutations, type ShoppingList } from '../api';
import { collator, countOf, plural, normalize } from '../../../lib/text';
import { unarchived } from '../../../lib/archive';

/**
 * Products of the base lists to add to a list: searched, filtered by base list or missing, checked then added in one go
 * (those already in the list are shown checked and locked).
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @param {ShoppingList} props.list List the products are added to.
 * @param {() => void} props.onDone Closes the picker.
 * @returns {JSX.Element} Picker.
 */
export function ProductPicker({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const { data } = useShoppingData();
  const { addProducts } = useShoppingMutations();
  const [baseListId, setBaseListId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The archived base lists and products are not offered.
  const baseLists = unarchived(data?.shoppingBaseLists ?? []);
  const offeredLists = new Set(baseLists.map((baseList) => baseList.id));
  const inList = new Set(list.items.map((item) => item.productId).filter(Boolean));
  const pathOf = categoryPaths(data?.shoppingCategories ?? []);
  const needle = normalize(search.trim());
  const products = unarchived(data?.shoppingProducts ?? [])
    .filter(
      (product) =>
        offeredLists.has(product.baseListId) && (!baseListId || product.baseListId === baseListId) && (!onlyMissing || product.missing) && (!needle || normalize(product.name).includes(needle)),
    )
    .sort((a, b) => collator.compare(a.name, b.name));
  const addable = products.filter((product) => !inList.has(product.id));
  const groups = baseLists.map((baseList) => ({ baseList, products: products.filter((product) => product.baseListId === baseList.id) })).filter((group) => group.products.length > 0);

  /**
   * Checks or unchecks a product.
   * @param {string} id Product id.
   * @param {boolean} checked Checked.
   * @returns {void}
   */
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="wrap" align="flex-end">
        <TextInput
          placeholder="Rechercher"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          aria-label="Rechercher un produit"
          data-autofocus
          style={{ flex: 1, minWidth: 160 }}
        />
        <Select
          aria-label="Référence"
          placeholder="Toutes les références"
          clearable
          data={baseLists.map((baseList) => ({ value: baseList.id, label: baseList.name }))}
          value={baseListId}
          onChange={setBaseListId}
          w={220}
        />
      </Group>
      <Group gap="md">
        <Checkbox size="xs" label="Manquants seulement" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.currentTarget.checked)} />
        {addable.length > 0 && (
          <Anchor component="button" type="button" size="xs" onClick={() => setSelected(new Set([...selected, ...addable.map((product) => product.id)]))}>
            Tout cocher
          </Anchor>
        )}
        {selected.size > 0 && (
          <Anchor component="button" type="button" size="xs" onClick={() => setSelected(new Set())}>
            Tout décocher
          </Anchor>
        )}
      </Group>
      <ScrollArea.Autosize mah="50vh" type="auto" offsetScrollbars>
        {groups.length === 0 ? (
          <EmptyState compact icon={<MagnifyingGlassIcon aria-hidden />} message={data?.shoppingProducts.length ? 'Aucun produit ne correspond.' : 'Les références sont vides.'} />
        ) : (
          <Stack gap="md">
            {groups.map(({ baseList, products: items }) => (
              <Stack key={baseList.id} gap={6}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {baseList.name}
                </Text>
                {items.map((product) => {
                  const present = inList.has(product.id);
                  const path = product.categoryId ? pathOf.get(product.categoryId) : undefined;
                  return (
                    <Checkbox
                      key={product.id}
                      checked={present || selected.has(product.id)}
                      disabled={present}
                      onChange={(event) => toggle(product.id, event.currentTarget.checked)}
                      label={
                        <Group gap={6} wrap="nowrap">
                          <Text size="sm">{product.name}</Text>
                          {product.missing && (
                            <Badge size="xs" variant="light" color="orange" tt="none">
                              manque
                            </Badge>
                          )}
                          {present && (
                            <Badge size="xs" variant="outline" color="gray" tt="none">
                              déjà dans la liste
                            </Badge>
                          )}
                        </Group>
                      }
                      description={path}
                    />
                  );
                })}
              </Stack>
            ))}
          </Stack>
        )}
      </ScrollArea.Autosize>
      <FormActions
        onCancel={onDone}
        submitLabel={`Ajouter (${selected.size})`}
        disabled={selected.size === 0}
        loading={addProducts.isPending}
        onSubmit={() =>
          addProducts.mutate(
            { listId: list.id, productIds: [...selected] },
            formCallbacks(null, (count) => `${countOf(count, 'produit')} ${plural(count, 'ajouté')}.`, onDone),
          )
        }
      />
    </Stack>
  );
}
