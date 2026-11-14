import { Button, Group, Select, Stack } from '@mantine/core';
import { useState } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList } from './api';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

interface MoveProductsFormProps {
  /** Base list the products leave. */
  baseList: ShoppingBaseList;
  /** Products chosen at first. */
  productIds: string[];
  onDone: () => void;
}

/**
 * Moves one or more products of a base list to another one, after its own products; a category the target list does
 * not offer is left out.
 * @param {MoveProductsFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MoveProductsForm({ baseList, productIds, onDone }: MoveProductsFormProps) {
  const { data } = useShoppingData();
  const { moveProducts } = useShoppingMutations();
  const [ids, setIds] = useState(productIds);
  const [target, setTarget] = useState<string | null>(null);
  const products = (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseList.id).sort((a, b) => collator.compare(a.name, b.name));
  const targets = (data?.shoppingBaseLists ?? []).filter((list) => list.id !== baseList.id);
  const targetName = targets.find((list) => list.id === target)?.name;

  /**
   * Moves the chosen products.
   * @param {React.FormEvent} event Submit event.
   * @returns {void}
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || ids.length === 0) return;
    moveProducts.mutate(
      { ids, baseListId: target },
      {
        onSuccess: (count) => {
          notifySuccess(`${count} produit${count > 1 ? 's' : ''} déplacé${count > 1 ? 's' : ''} vers « ${targetName} ».`);
          onDone();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <BatchMultiSelect
          label="Produits"
          description={`De « ${baseList.name} ».`}
          data={products.map((product) => ({ value: product.id, label: product.name }))}
          value={ids}
          onChange={setIds}
          searchable
          clearable
          required
        />
        <Select
          label="Vers la liste type"
          description="Ils y passent après ses produits ; une catégorie qu’elle ne propose pas leur est retirée."
          placeholder={targets.length ? 'Choisir' : 'Aucune autre liste type'}
          data={targets.map((list) => ({ value: list.id, label: list.name }))}
          value={target}
          onChange={setTarget}
          required
          data-autofocus
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={moveProducts.isPending} disabled={!target || ids.length === 0}>
            Déplacer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
