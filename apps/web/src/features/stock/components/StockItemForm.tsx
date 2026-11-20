import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useLocationSelect } from '../hooks/use-location-select';

import { Autocomplete, Checkbox, SimpleGrid, Stack } from '@mantine/core';
import { PeopleField } from '../../shopping/components/PeopleField';
import { DatePickerInput } from '@mantine/dates';
import { newStockItemSchema, type NewStockItemInput } from '@ordo/shared';

import { useAppForm, formCallbacks } from '../../../lib/form';

import { useShoppingData } from '../../shopping/api';
import { useStockMutations } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { QuantityInput } from '../../../components/inputs/QuantityInput';
import { ShoppingCategoryField, UnitField } from '../../shopping/components/ProductFields';
import { unarchived } from '../../../lib/archive';
import { optionalNumberProps } from '../../../components/inputs/number-format';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';

type Values = NewStockItemInput & Record<string, unknown>;

/**
 * New item of the stock: a reference (its category, unit and conservation proposed) or an item of its own, its place,
 * what it starts with (and the date of that lot), the people it is for and a description.
 * @param {{ locationId?: string | null, onDone: () => void }} props Place proposed, and what follows.
 * @returns {JSX.Element} Form.
 */
export function StockItemForm({ locationId = null, onDone }: { locationId?: string | null; onDone: () => void }) {
  const { data } = useShoppingData();
  const locationSelect = useLocationSelect();
  const { createItem } = useStockMutations();
  // The archived references, places and categories are not offered.
  const products = unarchived(data?.shoppingProducts ?? []);
  const byName = new Map(products.map((product) => [product.label, product]));
  const form = useAppForm<Values>({
    initialValues: { productId: null, label: '', categoryId: null, unit: null, locationId, note: null, perishable: false, memberIds: [], relationIds: [], quantity: null, expiresAt: null },
    schema: newStockItemSchema,
  });
  const values = form.getValues();
  const handleSubmit = form.onSubmit((input) => createItem.mutate(input, formCallbacks(form, 'Article ajouté au stock.', onDone)));
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
          <CreatableSelect label="Emplacement" placeholder="Aucun" clearable searchable {...locationSelect(values.locationId)} {...form.getInputProps('locationId')} />
          <ShoppingCategoryField {...form.getInputProps('categoryId')} value={values.categoryId ?? null} onChange={(categoryId) => form.setFieldValue('categoryId', categoryId)} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
          <QuantityInput label="Quantité" min={0} allowNegative={false} {...optionalNumberProps(form, 'quantity')} />
          <UnitField current={values.unit} {...form.getInputProps('unit')} value={values.unit} />
          <Checkbox mt="xl" label="Périssable" description="Par lots datés" {...form.getInputProps('perishable', { type: 'checkbox' })} />
        </SimpleGrid>
        {values.perishable && <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable {...form.getInputProps('expiresAt')} />}
        <PeopleField form={form} label="Bénéficiaires" />
        <MarkdownEditor label="Description" value={values.note ?? ''} onChange={(note) => form.setFieldValue('note', note || null)} suggestions={NO_SUGGESTIONS} minRows={2} error={form.errors.note as string | undefined} />
        <FormActions onCancel={onDone} submitLabel="Ajouter" loading={createItem.isPending} />
      </Stack>
    </form>
  );
}
