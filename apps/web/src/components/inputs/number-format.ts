import type { UseFormReturnType } from '@mantine/form';

/** Separators of a number typed in a field, the same everywhere: « 1 000,5 ». Spread into a NumberInput. */
// eslint-disable-next-line no-restricted-syntax -- FRENCH_NUMBER_FORMAT itself.
export const FRENCH_NUMBER_FORMAT = { decimalSeparator: ',', thousandSeparator: ' ' } as const;

/**
 * Number typed in an optional field: none when it is emptied or not a number yet (NumberInput gives a text then).
 * @param {string | number} value Value of the NumberInput.
 * @returns {number | null} Number, or null.
 */
// eslint-disable-next-line no-restricted-syntax -- optionalNumber itself.
export const optionalNumber = (value: string | number): number | null => (typeof value === 'number' ? value : null);

/**
 * Props of an optional NumberInput of a form: its value (empty for none), its error, and none saved when it is emptied.
 * @param {UseFormReturnType<V>} form Form.
 * @param {K} field Field (a number or null).
 * @returns {object} Props to spread into the NumberInput.
 */
export function optionalNumberProps<V extends Record<string, unknown>, K extends keyof V & string>(form: UseFormReturnType<V>, field: K) {
  return {
    ...form.getInputProps(field),
    value: (form.getValues()[field] as number | null | undefined) ?? '',
    onChange: (value: string | number) => form.setFieldValue(field, optionalNumber(value) as never),
  };
}
