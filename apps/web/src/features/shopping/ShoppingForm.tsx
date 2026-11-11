import { Autocomplete, Badge, Button, Checkbox, Group, NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { shoppingItemSchema, shoppingProductSchema, type ShoppingProductInput } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useShoppingData, useShoppingMutations, type ShoppingItem, type ShoppingProduct } from './api';
import { shoppingCategoryOptions, usePeople } from './shopping-format';

/** Units offered (any other can be typed). */
const UNITS = ['pièce', 'kg', 'g', 'L', 'cl', 'boîte', 'paquet', 'bouteille', 'sachet', 'lot', 'rouleau', 'carton'];

/**
 * Names of the people a product or an item is for, as small badges.
 * @param {{ memberIds: string[], relationIds: string[] }} props Component props.
 * @returns {JSX.Element | null} Badges.
 */
export function PeopleBadges({ memberIds, relationIds }: { memberIds: string[]; relationIds: string[] }) {
  const { members, relations } = usePeople();
  const names = [...memberIds.map((id) => members.get(id)), ...relationIds.map((id) => relations.get(id))].filter((name): name is string => Boolean(name));
  if (!names.length) return null;
  return (
    <Group gap={4}>
      {names.map((name) => (
        <Badge key={name} size="xs" variant="light" color="gray" tt="none">
          {name}
        </Badge>
      ))}
    </Group>
  );
}

type FormValues = Omit<ShoppingProductInput, 'quantity' | 'unitPrice' | 'url' | 'note' | 'unit'> & {
  quantity: number | null;
  unitPrice: number | null;
  url: string;
  note: string;
  unit: string;
  memberIds: string[];
  relationIds: string[];
};

export interface ShoppingFormProps {
  /** Product of the base list, or item of a list (edited when given). */
  target: { kind: 'product'; product?: ShoppingProduct } | { kind: 'item'; listId: string; item?: ShoppingItem };
  onDone: () => void;
}

/**
 * Product of the base list or item of a list: name, category, store, quantity and unit, unit price, link, note and
 * the people it is for; a product is also marked missing or not.
 * @param {ShoppingFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ShoppingForm({ target, onDone }: ShoppingFormProps) {
  const { data } = useShoppingData();
  const mutations = useShoppingMutations();
  const people = usePeople();
  const current = target.kind === 'product' ? target.product : target.item;
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
    const { missing: _missing, ...input } = values;
    if (target.item) mutations.updateItem.mutate({ id: target.item.id, input }, callbacks);
    else mutations.addItem.mutate({ listId: target.listId, input }, callbacks);
  });

  const values = form.getValues();
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Select label="Catégorie" placeholder="Aucune" clearable searchable data={shoppingCategoryOptions(data?.shoppingCategories ?? [])} {...form.getInputProps('categoryId')} />
          <Select
            label="Magasin"
            placeholder="Aucun"
            clearable
            searchable
            data={(data?.shoppingStores ?? []).map((item) => ({ value: item.id, label: item.name }))}
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
          <Autocomplete label="Unité" data={UNITS} {...form.getInputProps('unit')} />
          <NumberInput
            label="Prix unitaire estimé"
            min={0}
            decimalScale={2}
            decimalSeparator=","
            suffix=" €"
            allowNegative={false}
            {...form.getInputProps('unitPrice')}
            onChange={(value) => form.setFieldValue('unitPrice', typeof value === 'number' ? value : null)}
          />
        </SimpleGrid>
        <BatchMultiSelect
          label="Pour"
          description="Membres et relations concernés : la répartition d’un mouvement de trésorerie qui paie la liste."
          placeholder={values.memberIds.length + values.relationIds.length ? undefined : 'Personne en particulier'}
          data={people.options}
          searchable
          clearable
          value={[...values.memberIds.map((id) => `m:${id}`), ...values.relationIds.map((id) => `r:${id}`)]}
          onChange={(keys) =>
            form.setValues({ memberIds: keys.filter((key) => key.startsWith('m:')).map((key) => key.slice(2)), relationIds: keys.filter((key) => key.startsWith('r:')).map((key) => key.slice(2)) })
          }
        />
        <TextInput label="Lien vers le produit" placeholder="https://…" type="url" {...form.getInputProps('url')} />
        <Textarea label="Note" autosize minRows={1} {...form.getInputProps('note')} />
        {target.kind === 'product' && <Checkbox label="Manque" description="Il sera mis sur la prochaine liste générée." {...form.getInputProps('missing', { type: 'checkbox' })} />}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {current ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
