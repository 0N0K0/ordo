import { NumberInput, type NumberInputProps } from '@mantine/core';
import { FRENCH_NUMBER_FORMAT } from './number-format';

interface QuantityInputProps extends NumberInputProps {
  /** Unit shown after the quantity. Optional. */
  unit?: string | null;
}

/**
 * Quantity field (stock, shopping, invoicing): up to 3 decimals, French separators (« 1 000,5 »), its unit after it.
 * @param {QuantityInputProps} props Component props (and those of the number field).
 * @returns {JSX.Element} Field.
 */
export function QuantityInput({ unit, ...props }: QuantityInputProps) {
  return <NumberInput decimalScale={3} {...FRENCH_NUMBER_FORMAT} suffix={unit ? ` ${unit}` : undefined} {...props} />;
}
