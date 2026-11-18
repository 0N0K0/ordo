import { NumberInput, type NumberInputProps } from '@mantine/core';

interface QuantityInputProps extends NumberInputProps {
  /** Unit shown after the quantity. Optional. */
  unit?: string | null;
}

/**
 * Quantity field (stock, shopping, invoicing): up to 3 decimals, French separator, its unit after it.
 * @param {QuantityInputProps} props Component props (and those of the number field).
 * @returns {JSX.Element} Field.
 */
export function QuantityInput({ unit, ...props }: QuantityInputProps) {
  return <NumberInput decimalScale={3} decimalSeparator="," suffix={unit ? ` ${unit}` : undefined} {...props} />;
}
