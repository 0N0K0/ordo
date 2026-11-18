import { Text, type TextProps } from '@mantine/core';
import * as fmt from '../../lib/format';

interface SignedAmountProps extends TextProps {
  /** Signed amount, in euros. */
  value: number;
}

/**
 * Signed amount of a movement, on one line: money in green with its « + », money out in red.
 * @param {SignedAmountProps} props Component props (and those of the text).
 * @returns {JSX.Element} Amount.
 */
export function SignedAmount({ value, ...props }: SignedAmountProps) {
  return (
    <Text span size="sm" ff="monospace" c={value < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }} {...props}>
      {value > 0 ? '+' : ''}
      {fmt.money(value)}
    </Text>
  );
}
