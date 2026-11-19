import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';
import { DatePickerInput } from '@mantine/dates';
import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { rowPeopleKeys, rowPeopleOf, sheetSourceText, usePeople } from '../lib/shopping-format';
import { listSelectProps } from '../../../components/items/item-look';
import { Anchor, Checkbox, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router';
import { shoppingItemSchema, shoppingProductSchema, type ShoppingProductInput } from '@ordo/shared';

import { useAppForm, formCallbacks } from '../../../lib/form';

import { useShoppingData, useShoppingMutations, type ShoppingItem, type ShoppingProduct } from '../api';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useStorageItems, useStoreItems } from '../hooks/use-settings-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';
import { QuantityInput } from '../../../components/inputs/QuantityInput';
import { ShoppingCategoryField, UnitField } from './ProductFields';
import { plural } from '../../../lib/text';
import { PAGES } from '../../../app/pages';
import { useActiveWorkspace } from '../../workspaces/api';
import { relationNoun } from '../../../components/people/people-options';
import { optionalNumberProps } from '../../../components/inputs/number-format';

type FormValues = Omit<ShoppingProductInput, 'quantity' | 'unitPrice' | 'url' | 'note' | 'unit' | 'perishable' | 'storageId' | 'expiresAt'> & {
  perishable: boolean;
  storageId: string | null;
  expiresAt: string | null;
  quantity: number | null;
  unitPrice: number | null;
  url: string;
  note: string;
  unit: string | null;
  memberIds: string[];
  relationIds: string[];
};

export interface ShoppingFormProps {
  /** Product of a base list, or item of a list (edited when given). */
  target: { kind: 'product'; baseListId: string; product?: ShoppingProduct } | { kind: 'item'; listId: string; item?: ShoppingItem };
  onDone: () => void;
}

/**
 * Product of a base list or item of a list: name, category, store, quantity and unit, unit price, link, description and
 * the people it is for; a product is also marked missing or not.
 * @param {ShoppingFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ShoppingForm({ target, onDone }: ShoppingFormProps) {
  const { data } = useShoppingData();
  const mutations = useShoppingMutations();
  const stores = useStoreItems();
  const storages = useStorageItems();
  const { context } = useTaskContext();
  const current = target.kind === 'product' ? target.product : target.item;
  const people = usePeople();
  const { perso } = useActiveWorkspace();
  const form = useAppForm<FormValues>({
    initialValues: {
      label: current?.label ?? '',
      categoryId: current?.categoryId ?? null,
      storeId: current?.storeId ?? null,
      url: current?.url ?? '',
      note: current?.note ?? '',
      quantity: current?.quantity ?? null,
      unit: current?.unit ?? null,
      unitPrice: current?.unitPrice ?? null,
      memberIds: current?.memberIds ?? [],
      relationIds: current?.relationIds ?? [],
      perishable: current?.perishable ?? false,
      storageId: current?.storageId ?? null,
      expiresAt: current?.expiresAt ?? null,
      baseListId: target.kind === 'product' ? (target.product?.baseListId ?? target.baseListId) : '',
      // A new product is usually added because it is missing.
      missing: target.kind === 'product' ? (target.product?.missing ?? true) : false,
    },
    schema: target.kind === 'product' ? shoppingProductSchema : shoppingItemSchema,
  });
  const pending = mutations.createProduct.isPending || mutations.updateProduct.isPending || mutations.addItem.isPending || mutations.updateItem.isPending;

  const handleSubmit = form.onSubmit((values) => {
    const callbacks = formCallbacks(form, current ? 'Modifié.' : 'Ajouté.', onDone);
    if (target.kind === 'product') {
      if (target.product) mutations.updateProduct.mutate({ id: target.product.id, input: values }, callbacks);
      else mutations.createProduct.mutate(values, callbacks);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { missing: _missing, baseListId: _baseListId, ...input } = values;
    if (target.item) mutations.updateItem.mutate({ id: target.item.id, input }, callbacks);
    else mutations.addItem.mutate({ listId: target.listId, input }, callbacks);
  });

  const values = form.getValues();
  return (
    <Stack gap="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <TextInput label="Label" required data-autofocus {...form.getInputProps('label')} />
          {target.kind === 'item' && target.item && target.item.sheetSources.length > 0 && (
            <Text size="xs" c="dimmed">
              Vient {plural(target.item.sheetSources.length, 'de la fiche', 'des fiches')}{' '}
              <Anchor component={Link} to={PAGES.sheets.path} size="xs">
                {target.item.sheetSources.map(sheetSourceText).join(', ')}
              </Anchor>
              .
            </Text>
          )}
          {target.kind === 'product' && (
            <Select
              label="Référence"
              required
              allowDeselect={false}
              {...listSelectProps(data?.shoppingBaseLists ?? [], undefined, target.kind === 'product' ? target.product?.baseListId : null)}
              {...form.getInputProps('baseListId')}
            />
          )}
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <ShoppingCategoryField
              current={current?.categoryId}
              baseListId={target.kind === 'product' ? values.baseListId : null}
              {...form.getInputProps('categoryId')}
              value={values.categoryId ?? null}
              onChange={(categoryId) => form.setFieldValue('categoryId', categoryId)}
            />
            <CreatableSelect
              label="Magasin"
              placeholder="Aucun"
              clearable
              searchable
              onCreate={itemCreator('Nouveau magasin', stores)}
              {...listSelectProps(data?.shoppingStores ?? [], undefined, current?.storeId)}
              {...form.getInputProps('storeId')}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <QuantityInput label="Quantité" min={0} allowNegative={false} {...optionalNumberProps(form, 'quantity')} />
            <UnitField current={current?.unit} {...form.getInputProps('unit')} value={values.unit} />
            <AmountInput label="Prix unitaire estimé" min={0} allowNegative={false} {...optionalNumberProps(form, 'unitPrice')} />
          </SimpleGrid>
          <Checkbox label="Périssable" description="À conserver d’une certaine façon, jusqu’à une date de péremption." {...form.getInputProps('perishable', { type: 'checkbox' })} />
          {values.perishable && (
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <CreatableSelect
                label="Mode de conservation"
                placeholder="Aucun"
                clearable
                searchable
                onCreate={itemCreator('Nouveau mode de conservation', storages)}
                {...listSelectProps(data?.shoppingStorages ?? [], undefined, current?.storageId)}
                {...form.getInputProps('storageId')}
              />
              <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />
            </SimpleGrid>
          )}
          <PeopleSelect
            label="Bénéficiaire"
            description={`Contributeurs et ${relationNoun(perso, true).toLowerCase()} concernés : la répartition d’un mouvement de trésorerie qui paie la liste.`}
            placeholder="Personne en particulier"
            data={people.options}
            value={rowPeopleKeys(values)}
            onChange={(keys) => form.setValues(rowPeopleOf(keys))}
          />
          <TextInput label="Lien vers le produit" placeholder="https://…" type="url" {...form.getInputProps('url')} />
          <MarkdownEditor
            label="Description"
            value={form.values.note}
            onChange={(note) => form.setFieldValue('note', note)}
            suggestions={context?.suggestionsFor(null) ?? NO_SUGGESTIONS}
            minRows={2}
          />
          {target.kind === 'product' && <Checkbox label="Manque" description="Il sera mis sur la prochaine liste générée." {...form.getInputProps('missing', { type: 'checkbox' })} />}
          <FormActions onCancel={onDone} submitLabel={current ? 'Enregistrer' : 'Ajouter'} loading={pending} />
        </Stack>
      </form>
      {target.kind === 'product' && target.product && <Comments target="SHOPPING_PRODUCT" id={target.product.id} readOnly={target.product.archived} />}
      {target.kind === 'item' && target.item && <Comments target="SHOPPING_ITEM" id={target.item.id} />}
    </Stack>
  );
}
