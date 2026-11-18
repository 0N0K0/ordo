import { round2 } from '@ordo/shared';
import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useState, type FocusEvent } from 'react';
import { currencySymbol } from '../../lib/format';
import { FRENCH_NUMBER_FORMAT } from './number-format';

/** Decimals an amount is typed and kept with (shown rounded to 2). */
const AMOUNT_DECIMALS = 4;

/**
 * Amount as shown out of the field: rounded to the cent.
 * @param {string | number | undefined} value Value of the field.
 * @returns {string | number | undefined} Value shown.
 */
function rounded(value: string | number | undefined): string | number | undefined {
  const amount = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof amount === 'number' && Number.isFinite(amount) ? round2(amount) : value;
}

interface AmountInputProps extends NumberInputProps {
  /** Currency (ISO code) whose symbol follows the amount, unless a `suffix` is given; null: none. Optional. Default = EUR. */
  currency?: string | null;
}

/**
 * Amount field: typed with up to 4 decimals (a unit price of 1,879 €), shown rounded to 2 out of the field
 * (« 1,88 € »), French separators, followed by the symbol of its currency.
 * @param {AmountInputProps} props NumberInput props, and the currency.
 * @returns {JSX.Element} Field.
 */
export function AmountInput({ value, onFocus, onBlur, currency = 'EUR', suffix, ...props }: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <NumberInput
      {...FRENCH_NUMBER_FORMAT}
      suffix={suffix ?? (currency ? ` ${currencySymbol(currency)}` : undefined)}
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
