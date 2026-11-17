import { Autocomplete, Checkbox, NumberInput, Select, SimpleGrid, Stack, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { newStockItemSchema, type NewStockItemInput } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useShoppingData } from '../shopping/api';
import { shoppingCategoryOptions, usePeople } from '../shopping/shopping-format';
import { useStockLocations, useStockMutations } from './api';
import { locationOptions } from './stock-format';
import { FormActions } from '../../components/dialogs/FormActions';

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
          <Select label="Emplacement" placeholder="Aucun" clearable searchable {...treeSelectProps(locationOptions(locations ?? []))} {...form.getInputProps('locationId')} />
          <Select label="Catégorie" placeholder="Aucune" clearable searchable {...treeSelectProps(shoppingCategoryOptions(data?.shoppingCategories ?? []))} {...form.getInputProps('categoryId')} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <NumberInput
            label="Quantité"
            min={0}
            decimalScale={3}
            decimalSeparator=","
            allowNegative={false}
            {...form.getInputProps('quantity')}
            onChange={(value) => form.setFieldValue('quantity', typeof value === 'number' ? value : null)}
          />
          <Autocomplete label="Unité" data={(data?.shoppingUnits ?? []).map((unit) => unit.name)} value={values.unit ?? ''} onChange={(unit) => form.setFieldValue('unit', unit || null)} />
          <Checkbox mt="xl" label="Périssable" description="Par lots datés" {...form.getInputProps('perishable', { type: 'checkbox' })} />
        </SimpleGrid>
        {values.perishable && <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />}
        <BatchMultiSelect
          label="Bénéficiaires"
          placeholder={values.memberIds.length + values.relationIds.length ? undefined : 'Personne en particulier'}
          data={people.options}
          searchable
          clearable
          value={[...values.memberIds.map((id) => `m:${id}`), ...values.relationIds.map((id) => `r:${id}`)]}
          onChange={(keys) =>
            form.setValues({ memberIds: keys.filter((key) => key.startsWith('m:')).map((key) => key.slice(2)), relationIds: keys.filter((key) => key.startsWith('r:')).map((key) => key.slice(2)) })
          }
        />
        <Textarea label="Description" autosize minRows={2} maxRows={6} value={values.note ?? ''} onChange={(event) => form.setFieldValue('note', event.currentTarget.value || null)} />
        <FormActions onCancel={onDone} submitLabel="Ajouter" loading={createItem.isPending} />
      </Stack>
    </form>
  );
}
