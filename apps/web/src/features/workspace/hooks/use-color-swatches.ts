import { useMantineTheme } from '@mantine/core';

/**
 * Palette offered by color pickers: shade 6 of every Mantine color.
 * @returns {string[]} Hex colors.
 */
export function useColorSwatches(): string[] {
  const theme = useMantineTheme();
  return Object.entries(theme.colors)
    .filter(([name]) => name !== 'dark' && name !== 'gray')
    .map(([, shades]) => shades[6]);
}
