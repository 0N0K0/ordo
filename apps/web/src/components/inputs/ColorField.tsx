import { ColorInput, type ColorInputProps } from '@mantine/core';
import { useColorSwatches } from '../../lib/use-color-swatches';

/**
 * Color field of a form, the same everywhere: hex color, the palette of the theme in rows of 9.
 * @param {Omit<ColorInputProps, 'format' | 'swatches' | 'swatchesPerRow'>} props Field props (label: « Couleur » by default).
 * @returns {JSX.Element} Field.
 */
export function ColorField({ label = 'Couleur', ...props }: Omit<ColorInputProps, 'format' | 'swatches' | 'swatchesPerRow'>) {
  const swatches = useColorSwatches();
  return <ColorInput label={label} format="hex" swatches={swatches} swatchesPerRow={9} {...props} />;
}
