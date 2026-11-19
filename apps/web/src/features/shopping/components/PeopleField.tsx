import type { UseFormReturnType } from '@mantine/form';
import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { rowPeopleKeys, rowPeopleOf, usePeople } from '../lib/shopping-format';

/** Fields of a form holding the people an item is for. */
interface PeopleValues {
  memberIds: string[];
  relationIds: string[];
}

/**
 * People a product, an item of the stock or a sheet item is for, in its form: any contributor and any relation (a
 * relation linked to a contributor offered as the contributor), the error of the API under it.
 * @param {{ form: UseFormReturnType<V>, label: string, description?: string }} props Component props: form, label of the field, its description (optional).
 * @returns {JSX.Element} Field.
 */
export function PeopleField<V extends PeopleValues>({ form, label, description }: { form: UseFormReturnType<V>; label: string; description?: string }) {
  const people = usePeople();
  const values = form.getValues();
  return (
    <PeopleSelect
      label={label}
      description={description}
      placeholder="Personne en particulier"
      data={people.optionsFor(values.relationIds)}
      value={rowPeopleKeys(values)}
      // eslint-disable-next-line no-restricted-syntax -- PeopleField itself.
      onChange={(keys) => form.setValues(rowPeopleOf(keys) as Partial<V>)}
      error={form.errors.memberIds}
    />
  );
}
