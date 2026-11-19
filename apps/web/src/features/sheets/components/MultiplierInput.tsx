import { NumberInput, type NumberInputProps } from '@mantine/core';
import { FRENCH_NUMBER_FORMAT } from '../../../components/inputs/number-format';

/**
 * How many times a sheet is used (« × 2 »): from 0,25 to 999, up to 2 decimals.
 * @param {NumberInputProps} props Number field props.
 * @returns {JSX.Element} Field.
 */
export function MultiplierInput(props: NumberInputProps) {
  return <NumberInput min={0.25} max={999} decimalScale={2} {...FRENCH_NUMBER_FORMAT} prefix="× " {...props} />;
}
