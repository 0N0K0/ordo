import { NumberInput, type NumberInputProps } from '@mantine/core';
import { FRENCH_NUMBER_FORMAT } from '../../../components/inputs/number-format';

/**
 * « Effort » field of a task, the same everywhere: a positive number, two decimals, a decimal comma.
 * @param {NumberInputProps} props Props of the number field (value, change, blur…).
 * @returns {JSX.Element} Field.
 */
export function EffortInput(props: NumberInputProps) {
  return <NumberInput label="Effort" min={0} decimalScale={2} {...FRENCH_NUMBER_FORMAT} {...props} />;
}
