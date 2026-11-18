import { NumberInput, type NumberInputProps } from '@mantine/core';
import { CarIcon } from '@phosphor-icons/react';

/**
 * Travel time of an event or a routine, the same field everywhere: minutes, by 5, a day at most.
 * @param {NumberInputProps & { way: 'before' | 'after' }} props Way (« Trajet aller » or « retour ») and field props.
 * @returns {JSX.Element} Field.
 */
export function TravelField({ way, ...props }: NumberInputProps & { way: 'before' | 'after' }) {
  return <NumberInput label={way === 'before' ? 'Trajet aller' : 'Trajet retour'} leftSection={<CarIcon aria-hidden />} suffix=" min" min={0} max={24 * 60} step={5} allowDecimal={false} {...props} />;
}
