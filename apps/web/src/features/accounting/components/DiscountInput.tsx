import { Group, SegmentedControl, type NumberInputProps } from '@mantine/core';
import type { DiscountType } from '@ordo/shared';
import { AmountInput } from '../../../components/inputs/AmountInput';
import * as fmt from '../../../lib/format';

/** Value and type of a discount (or a deposit): both null when there is none. */
export interface Discount {
  value: number | null;
  type: DiscountType | null;
}

interface DiscountInputProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'type'> {
  value: number | null;
  type: DiscountType | null;
  /** Currency of the document (the unit of an amount). */
  currency: string;
  /** Label of the choice between percentage and amount. */
  typeLabel: string;
  onChange: (discount: Discount) => void;
}

/**
 * Percentage or amount (in the currency of the document) of a discount or a deposit: a value of 0 removes it, a
 * percentage at first.
 * @param {DiscountInputProps} props Component props (and those of the amount field).
 * @returns {JSX.Element} Fields.
 */
export function DiscountInput({ value, type, currency, typeLabel, onChange, size, readOnly, ...props }: DiscountInputProps) {
  return (
    <Group gap={4} align="flex-end" wrap="nowrap">
      <AmountInput
        min={0}
        currency={null}
        size={size}
        readOnly={readOnly}
        {...props}
        value={value ?? ''}
        onChange={(next) => (typeof next === 'number' && next > 0 ? onChange({ value: next, type: type ?? 'PERCENT' }) : onChange({ value: null, type: null }))}
      />
      <SegmentedControl
        size={size}
        aria-label={typeLabel}
        readOnly={readOnly}
        data={[
          { value: 'PERCENT', label: '%' },
          { value: 'AMOUNT', label: fmt.currencySymbol(currency) },
        ]}
        value={type ?? 'PERCENT'}
        onChange={(next) => onChange({ value, type: next as DiscountType })}
      />
    </Group>
  );
}
