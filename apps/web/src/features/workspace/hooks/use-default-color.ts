import { useColorSwatches } from './use-color-swatches';

/**
 * Color of a setting created on the fly (from a select): the first of the swatches, as in the settings.
 * @returns {string} Color.
 */
export function useDefaultColor(): string {
  return useColorSwatches()[0];
}
