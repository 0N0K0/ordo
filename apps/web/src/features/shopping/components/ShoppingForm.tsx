import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';
import { DatePickerInput } from '@mantine/dates';
import { PeopleField } from './PeopleField';
import { sheetSourceText } from '../lib/shopping-format';
import { itemSelectProps } from '../../../components/items/item-look';
import { Anchor, Checkbox, Fieldset, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router';
import { shoppingItemSchema, shoppingProductSchema, type ShoppingProductInput } from '@ordo/shared';

import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { useCachedItem } from '../../../lib/mutation';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { shoppingKey, useShoppingData, useShoppingMutations, type ShoppingItem, type ShoppingList, type ShoppingProduct } from '../api';
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
  /**
   * Product of a base list, or item of a list (edited when given); `readOnly`: the item of a closed or archived list,
   * opened read only (a product of a base list stays editable).
   */
  target: { kind: 'product'; baseListId: string; product?: ShoppingProduct } | { kind: 'item'; listId: string; item?: ShoppingItem; readOnly?: boolean };
  onDone: () => void;
}

/** Fields of a product or an item saved on leaving them, in its panel (decision D22): texts and numbers. */
const ON_BLUR = ['label', 'url', 'note', 'quantity', 'unitPrice'] as const;

/**
 * Values of the form of a product or an item, as it is (a new one: empty, a product « Manque »).
 * @param {ShoppingFormProps['target']} target Product or item.
 * @param {ShoppingProduct | ShoppingItem} [current] Product or item edited, as the cache holds it. Optional.
 * @returns {FormValues} Values.
 */
const shoppingFormValues = (target: ShoppingFormProps['target'], current?: ShoppingProduct | ShoppingItem): FormValues => ({
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
  baseListId: target.kind === 'product' ? ((current as ShoppingProduct | undefined)?.baseListId ?? target.baseListId) : '',
  // A new product is usually added because it is missing.
  missing: target.kind === 'product' ? ((current as ShoppingProduct | undefined)?.missing ?? true) : false,
});

/**
 * Input of an item of a list from the values of the form (without the fields of a product).
 * @param {FormValues} values Values.
 * @returns {Omit<FormValues, 'missing' | 'baseListId'>} Input.
 */
const itemInput = (values: FormValues): Omit<FormValues, 'missing' | 'baseListId'> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { missing: _missing, baseListId: _baseListId, ...input } = values;
  return input;
};

/**
 * Product of a base list or item of a list: name, category, store, quantity and unit, unit price, link, description and
 * the people it is for; a product is also marked missing or not. A new one is a form with « Ajouter »; an existing one,
 * its panel, saves each field as soon as it changes (texts and numbers on leaving them, decision D22, `useFieldSave`),
 * the one of the cache followed. An archived product, an item of a closed or archived list are read only.
 * @param {ShoppingFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ShoppingForm({ target, onDone }: ShoppingFormProps) {
  const { data } = useShoppingData();
  const mutations = useShoppingMutations();
  const stores = useStoreItems();
  const storages = useStorageItems();
  const { context } = useTaskContext();
  const edited = target.kind === 'product' ? target.product : target.item;
  const { perso } = useActiveWorkspace();
  const schema = target.kind === 'product' ? shoppingProductSchema : shoppingItemSchema;
  const base = useAppForm<FormValues>({
    initialValues: shoppingFormValues(target, edited),
    schema,
  });
  // The product or item of the cache, followed (a cell, another tab).
  const cachedListItem = useCachedItem(
    [...shoppingKey, 'lists'],
    (lists: ShoppingList[]) => lists.flatMap((list) => list.items),
    (item: ShoppingItem) => target.kind === 'item' && item.id === target.item?.id,
  );
  const current =
    target.kind === 'product' ? target.product && (data?.shoppingProducts.find((product) => product.id === target.product?.id) ?? target.product) : target.item && (cachedListItem ?? target.item);

  /**
   * Saves an existing product or item whole, given its values as saved.
   * @param {Partial<FormValues>} _changes Fields changed.
   * @param {FormValues} values Values.
   * @returns {Promise<unknown>} Saved.
   */
  const save = async (_changes: Partial<FormValues>, values: FormValues): Promise<unknown> => {
    if (target.kind === 'product')
      return mutations.updateProduct.mutateAsync({
        id: target.product!.id,
        input: values,
      });
    return mutations.updateItem.mutateAsync({ id: target.item!.id, input: itemInput(values) });
  };
  // An archived product (elsewhere too, the panel open), an item of a closed or archived list: read only (its comments too).
  const readOnly = target.kind === 'product' ? Boolean((current as ShoppingProduct | undefined)?.archived) : Boolean(target.readOnly);
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: edited ? save : null,
    schema,
    saved: current && shoppingFormValues(target, current),
    onBlur: ON_BLUR,
    readOnly,
  });
  const pending = mutations.createProduct.isPending || mutations.addItem.isPending;

  // A new product or item only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => {
    const callbacks = formCallbacks(form, 'Ajouté.', onDone);
    if (target.kind === 'product') {
      mutations.createProduct.mutate(values, callbacks);
      return;
    }
    mutations.addItem.mutate({ listId: target.listId, input: itemInput(values) }, callbacks);
  });

  const values = form.getValues();
  return (
    <Stack gap="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
          <Stack gap="md">
            {edited && !readOnly && <SaveStatus saving={saving} />}
            <TextInput label="Label" required data-autofocus={edited ? undefined : true} {...form.getInputProps('label')} />
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
                {...itemSelectProps(data?.shoppingBaseLists ?? [], values.baseListId, undefined, target.kind === 'product' ? target.product?.baseListId : null)}
                {...form.getInputProps('baseListId')}
              />
            )}
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <ShoppingCategoryField
                current={edited?.categoryId}
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
                {...itemSelectProps(data?.shoppingStores ?? [], values.storeId, undefined, edited?.storeId)}
                {...form.getInputProps('storeId')}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, xs: 3 }}>
              <QuantityInput label="Quantité" min={0} allowNegative={false} {...optionalNumberProps(form, 'quantity')} />
              <UnitField current={edited?.unit} {...form.getInputProps('unit')} value={values.unit} />
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
                  {...itemSelectProps(data?.shoppingStorages ?? [], values.storageId, undefined, edited?.storageId)}
                  {...form.getInputProps('storageId')}
                />
                <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />
              </SimpleGrid>
            )}
            <PeopleField
              form={form}
              label="Bénéficiaires"
              description={`Contributeurs et ${relationNoun(perso, true).toLowerCase()} concernés : la répartition d’un mouvement de trésorerie qui paie la liste.`}
            />
            <TextInput label="Lien vers le produit" placeholder="https://…" type="url" {...form.getInputProps('url')} />
            <MarkdownEditor label="Description" {...fieldProps('note')} suggestions={context?.suggestionsFor(null) ?? NO_SUGGESTIONS} minRows={2} />
            {target.kind === 'product' && <Checkbox label="Manque" description="Il sera mis sur la prochaine liste générée." {...form.getInputProps('missing', { type: 'checkbox' })} />}
            {!edited && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={pending} />}
          </Stack>
        </Fieldset>
      </form>
      {target.kind === 'product' && target.product && <Comments target="SHOPPING_PRODUCT" id={target.product.id} readOnly={readOnly} />}
      {target.kind === 'item' && target.item && <Comments target="SHOPPING_ITEM" id={target.item.id} readOnly={readOnly} />}
    </Stack>
  );
}
