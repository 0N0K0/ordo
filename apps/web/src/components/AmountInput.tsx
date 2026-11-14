import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useState, type FocusEvent } from 'react';

/** Decimals an amount is typed and kept with (shown rounded to 2). */
export const AMOUNT_DECIMALS = 4;

/**
 * Amount as shown out of the field: rounded to the cent.
 * @param {string | number | undefined} value Value of the field.
 * @returns {string | number | undefined} Value shown.
 */
function rounded(value: string | number | undefined): string | number | undefined {
  const amount = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount * 100) / 100 : value;
}

/**
 * Amount field: typed with up to 4 decimals (a unit price of 1,879 €), shown rounded to 2 out of the field
 * (« 1,88 € »), French separators.
 * @param {NumberInputProps} props NumberInput props (suffix « € » or the currency included by the caller).
 * @returns {JSX.Element} Field.
 */
export function AmountInput({ value, onFocus, onBlur, ...props }: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <NumberInput
      decimalSeparator=","
      thousandSeparator=" "
      {...props}
      decimalScale={focused ? AMOUNT_DECIMALS : 2}
      fixedDecimalScale={!focused && value !== '' && value !== undefined && value !== null}
      value={focused ? value : rounded(value)}
      onFocus={(event: FocusEvent<HTMLInputElement>) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event: FocusEvent<HTMLInputElement>) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}
