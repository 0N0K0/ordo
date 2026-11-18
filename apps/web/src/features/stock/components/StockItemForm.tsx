import { categoryOptions } from '../../../components/tree/category-tree';
import { Autocomplete, Checkbox, Select, SimpleGrid, Stack, Textarea } from '@mantine/core';
import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { rowPeopleKeys, rowPeopleOf, usePeople } from '../../shopping/lib/shopping-format';
import { DatePickerInput } from '@mantine/dates';
import { newStockItemSchema, type NewStockItemInput } from '@ordo/shared';

import { treeSelectProps } from '../../../components/tree/tree-select';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { useShoppingData } from '../../shopping/api';
import { useStockLocations, useStockMutations } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { QuantityInput } from '../../../components/inputs/QuantityInput';

type Values = NewStockItemInput & Record<string, unknown>;

/**
 * New item of the stock: a reference (its category, unit and conservation proposed) or an item of its own, its place,
 * what it starts with (and the date of that lot), the people it is for and a description.
 * @param {{ locationId?: string | null, onDone: () => void }} props Place proposed, and what follows.
 * @returns {JSX.Element} Form.
 */
export function StockItemForm({ locationId = null, onDone }: { locationId?: string | null; onDone: () => void }) {
  const { data } = useShoppingData();
  const { data: locations } = useStockLocations();
  const { createItem } = useStockMutations();
  const people = usePeople();
  const products = data?.shoppingProducts ?? [];
  const byName = new Map(products.map((product) => [product.name, product]));
  const form = useAppForm<Values>({
    initialValues: { productId: null, label: '', categoryId: null, unit: null, locationId, note: null, perishable: false, memberIds: [], relationIds: [], quantity: null, expiresAt: null },
    schema: newStockItemSchema,
  });
  const values = form.getValues();
  const handleSubmit = form.onSubmit((input) =>
    createItem.mutate(input, { onSuccess: () => (notifySuccess('Article ajouté au stock.'), onDone()), onError: (error: Error) => showFormError(form, error) }),
  );
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <Autocomplete
          label="Article"
          required
          data-autofocus
          placeholder="Une référence, ou un autre article"
          data={[...byName.keys()]}
          value={values.label}
          onChange={(label) => {
            const product = byName.get(label);
            // A reference: its category, unit, conservation and default place.
            if (product)
              form.setValues({
                productId: product.id,
                label,
                categoryId: product.categoryId ?? null,
                unit: product.unit ?? null,
                perishable: product.perishable,
                locationId: values.locationId ?? product.stockLocationId ?? null,
              });
            else form.setValues({ productId: null, label });
          }}
          error={form.errors.label}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Select label="Emplacement" placeholder="Aucun" clearable searchable {...treeSelectProps(categoryOptions(locations ?? []))} {...form.getInputProps('locationId')} />
          <Select label="Catégorie" placeholder="Aucune" clearable searchable {...treeSelectProps(categoryOptions(data?.shoppingCategories ?? []))} {...form.getInputProps('categoryId')} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <QuantityInput
            label="Quantité"
            min={0}
            allowNegative={false}
            {...form.getInputProps('quantity')}
            onChange={(value) => form.setFieldValue('quantity', typeof value === 'number' ? value : null)}
          />
          <Autocomplete label="Unité" data={(data?.shoppingUnits ?? []).map((unit) => unit.name)} value={values.unit ?? ''} onChange={(unit) => form.setFieldValue('unit', unit || null)} />
          <Checkbox mt="xl" label="Périssable" description="Par lots datés" {...form.getInputProps('perishable', { type: 'checkbox' })} />
        </SimpleGrid>
        {values.perishable && <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />}
        <PeopleSelect label="Bénéficiaires" placeholder="Personne en particulier" data={people.options} value={rowPeopleKeys(values)} onChange={(keys) => form.setValues(rowPeopleOf(keys))} />
        <Textarea label="Description" autosize minRows={2} maxRows={6} value={values.note ?? ''} onChange={(event) => form.setFieldValue('note', event.currentTarget.value || null)} />
        <FormActions onCancel={onDone} submitLabel="Ajouter" loading={createItem.isPending} />
      </Stack>
    </form>
  );
}
