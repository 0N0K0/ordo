import { formCallbacks } from '../../../lib/form';
import { Select, Stack } from '@mantine/core';
import { useState } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { useShoppingData, useShoppingMutations, type ShoppingBaseList } from '../api';
import { collator, countOf, plural } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { unarchived } from '../../../lib/archive';

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
  const products = unarchived(data?.shoppingProducts ?? [])
    .filter((product) => product.baseListId === baseList.id)
    .sort((a, b) => collator.compare(a.label, b.label));
  const targets = unarchived(data?.shoppingBaseLists ?? []).filter((list) => list.id !== baseList.id);
  const targetName = targets.find((list) => list.id === target)?.label;

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
      formCallbacks(null, (count) => `${countOf(count, 'produit')} ${plural(count, 'déplacé')} vers « ${targetName} ».`, onDone),
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <BatchMultiSelect
          label="Produits"
          description={`De « ${baseList.label} ».`}
          data={products.map((product) => ({ value: product.id, label: product.label }))}
          value={ids}
          onChange={setIds}
          searchable
          clearable
          required
        />
        <Select
          label="Vers la référence"
          description="Ils y passent après ses produits ; une catégorie qu’elle ne propose pas leur est retirée."
          placeholder={targets.length ? 'Choisir' : 'Aucune autre référence'}
          data={targets.map((list) => ({ value: list.id, label: list.label }))}
          value={target}
          onChange={setTarget}
          required
          data-autofocus
        />
        <FormActions onCancel={onDone} submitLabel="Déplacer" loading={moveProducts.isPending} disabled={!target || ids.length === 0} />
      </Stack>
    </form>
  );
}
