import { Text, type TextProps } from '@mantine/core';
import { EditableNumber } from '../data-table/cells/EditableCells';
import * as fmt from '../../lib/format';
import { directionOf } from '@ordo/shared';
import { signedText } from './signed-text';

interface SignedAmountProps extends TextProps {
  /** Signed amount, in euros (or a signed quantity, with its `format`). */
  value: number;
  /** Text of the value without its sign. Optional. Default = an amount in euros. */
  format?: (value: number) => string;
}

/**
 * Signed amount of a movement, on one line: money in green with its « + », money out in red.
 * @param {SignedAmountProps} props Component props (and those of the text).
 * @returns {JSX.Element} Amount.
 */
export function SignedAmount({ value, format = fmt.money, ...props }: SignedAmountProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- SignedAmount itself.
    <Text span size="sm" ff="monospace" c={value < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }} {...props}>
      {signedText(value, format)}
    </Text>
  );
}

interface SignedAmountCellProps {
  /** Signed amount, in euros. */
  value: number;
  label: string;
  /** Saves the amount typed (never 0): its direction and its absolute value. */
  onSave: (change: { direction: 'IN' | 'OUT'; amount: number }) => void;
}

/**
 * Signed amount of a movement typed in place (a « - » for money out), in green or red as its sign.
 * @param {SignedAmountCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function SignedAmountCell({ value, label, onSave }: SignedAmountCellProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- SignedAmountCell itself.
    <Text span inherit c={value < 0 ? 'red' : 'green'}>
      <EditableNumber
        amount
        value={value}
        label={label}
        signed
        validate={(amount) => (amount === 0 ? 'Le montant ne peut pas être nul.' : null)}
        onSave={(amount) => amount !== null && onSave({ direction: directionOf(amount), amount: Math.abs(amount) })}
      />
    </Text>
  );
}
