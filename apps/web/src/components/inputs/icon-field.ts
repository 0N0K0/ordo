import type { UseFormReturnType } from '@mantine/form';
import type { IconValue } from './IconField';

/**
 * Binding of `IconField` to two fields of a form: the file chosen and whether the current icon is removed (a file sent
 * with the values; in a panel saved field by field, both saved together as soon as they change).
 * @param {UseFormReturnType<V>} form Form.
 * @param {keyof V & string} file Field of the file chosen (`File | null`).
 * @param {keyof V & string} remove Field of the removal (`boolean`).
 * @returns {{ value: IconValue, onChange: (value: IconValue) => void }} Value and change of the field.
 */
export function formIconProps<V extends Record<string, unknown>>(
  form: UseFormReturnType<V>,
  file: keyof V & string,
  remove: keyof V & string,
): { value: IconValue; onChange: (value: IconValue) => void } {
  const values = form.getValues();
  return {
    value: { file: (values[file] as File | null) ?? null, remove: Boolean(values[remove]) },
    onChange: (icon) => form.setValues({ [file]: icon.file, [remove]: icon.remove } as Partial<V>),
  };
}
