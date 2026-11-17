import { DatePickerInput } from '@mantine/dates';
import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { categoriesForBaseList, listTasks, rowPeopleKeys, rowPeopleOf, shoppingCategoryOptions, unitOptions, usePeople } from '../lib/shopping-format';
import { listSelectProps } from '../../../components/settings/item-look';
import { Anchor, Checkbox, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router';
import { shoppingItemSchema, shoppingProductSchema, type ShoppingProductInput } from '@ordo/shared';

import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingItem, type ShoppingProduct } from '../api';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';
import { FormActions } from '../../../components/dialogs/FormActions';

type FormValues = Omit<ShoppingProductInput, 'quantity' | 'unitPrice' | 'url' | 'note' | 'unit' | 'perishable' | 'storageId' | 'expiresAt'> & {
  perishable: boolean;
  storageId: string | null;
  expiresAt: string | null;
  quantity: number | null;
  unitPrice: number | null;
  url: string;
  note: string;
  unit: string;
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
  const color = useDefaultColor();
  const { context } = useTaskContext();
  const current = target.kind === 'product' ? target.product : target.item;
  // Item of a list of projects: their contributors are the members offered.
  const { data: lists } = useShoppingLists();
  const list = target.kind === 'item' ? lists?.find((item) => item.id === target.listId) : undefined;
  const projectIds = list ? [...new Set(listTasks(list, context).flatMap((task) => (task.projectId ? [task.projectId] : [])))] : [];
  const people = usePeople(projectIds, current?.memberIds ?? []);
  const form = useAppForm<FormValues>({
    initialValues: {
      name: current?.name ?? '',
      categoryId: current?.categoryId ?? null,
      storeId: current?.storeId ?? null,
      url: current?.url ?? '',
      note: current?.note ?? '',
      quantity: current?.quantity ?? null,
      unit: current?.unit ?? '',
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
    const callbacks = {
      onSuccess: () => {
        notifySuccess(current ? 'Modifié.' : 'Ajouté.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
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
          <TextInput label="Label" required data-autofocus {...form.getInputProps('name')} />
          {target.kind === 'item' && target.item && target.item.sheetSources.length > 0 && (
            <Text size="xs" c="dimmed">
              Vient {target.item.sheetSources.length > 1 ? 'des fiches' : 'de la fiche'}{' '}
              <Anchor component={Link} to="/sheets" size="xs">
                {target.item.sheetSources.map((source) => `${source.name}${source.quantity !== null ? ` (${String(source.quantity).replace('.', ',')})` : ''}`).join(', ')}
              </Anchor>
              .
            </Text>
          )}
          {target.kind === 'product' && <Select label="Référence" required allowDeselect={false} {...listSelectProps(data?.shoppingBaseLists ?? [])} {...form.getInputProps('baseListId')} />}
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <CreatableSelect
              label="Catégorie"
              placeholder="Aucune"
              clearable
              searchable
              onCreate={(name) => mutations.createCategory.mutateAsync({ name, color, parentId: null })}
              {...treeSelectProps(
                shoppingCategoryOptions(target.kind === 'product' && values.baseListId ? categoriesForBaseList(data?.shoppingCategories ?? [], values.baseListId) : (data?.shoppingCategories ?? [])),
              )}
              {...form.getInputProps('categoryId')}
            />
            <CreatableSelect
              label="Magasin"
              placeholder="Aucun"
              clearable
              searchable
              onCreate={(name) => mutations.createStore.mutateAsync({ name, color })}
              {...listSelectProps(data?.shoppingStores ?? [])}
              {...form.getInputProps('storeId')}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <NumberInput
              label="Quantité"
              min={0}
              decimalScale={3}
              decimalSeparator=","
              allowNegative={false}
              {...form.getInputProps('quantity')}
              onChange={(value) => form.setFieldValue('quantity', typeof value === 'number' ? value : null)}
            />
            <CreatableSelect
              label="Unité"
              description="Tapez une unité absente pour l’ajouter aux paramètres des achats."
              placeholder="Aucune"
              // A unit is kept by its name.
              onCreate={async (name) => {
                await mutations.createUnit.mutateAsync({ name, color });
                return name;
              }}
              data={unitOptions(data?.shoppingUnits ?? [], current?.unit)}
              searchable
              clearable
              {...form.getInputProps('unit')}
            />
            <AmountInput
              label="Prix unitaire estimé"
              min={0}
              suffix=" €"
              allowNegative={false}
              {...form.getInputProps('unitPrice')}
              onChange={(value) => form.setFieldValue('unitPrice', typeof value === 'number' ? value : null)}
            />
          </SimpleGrid>
          <Checkbox label="Périssable" description="À conserver d’une certaine façon, jusqu’à une date de péremption." {...form.getInputProps('perishable', { type: 'checkbox' })} />
          {values.perishable && (
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <CreatableSelect
                label="Mode de conservation"
                placeholder="Aucun"
                clearable
                searchable
                onCreate={(name) => mutations.createStorage.mutateAsync({ name, color })}
                {...listSelectProps(data?.shoppingStorages ?? [])}
                {...form.getInputProps('storageId')}
              />
              <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />
            </SimpleGrid>
          )}
          <PeopleSelect
            label="Bénéficiaire"
            description="Membres et relations concernés : la répartition d’un mouvement de trésorerie qui paie la liste."
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
            suggestions={context?.suggestionsFor(null) ?? { projectId: null, tasks: [], contributors: [] }}
            minRows={2}
          />
          {target.kind === 'product' && <Checkbox label="Manque" description="Il sera mis sur la prochaine liste générée." {...form.getInputProps('missing', { type: 'checkbox' })} />}
          <FormActions onCancel={onDone} submitLabel={current ? 'Enregistrer' : 'Ajouter'} loading={pending} />
        </Stack>
      </form>
      {target.kind === 'product' && target.product && <Comments target="SHOPPING_PRODUCT" id={target.product.id} />}
      {target.kind === 'item' && target.item && <Comments target="SHOPPING_ITEM" id={target.item.id} />}
    </Stack>
  );
}
