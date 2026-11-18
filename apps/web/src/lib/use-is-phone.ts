import { useMediaQuery } from '@mantine/hooks';

/** Below the tablet breakpoint (48em, Mantine's sm; `$tablet-breakpoint` in the CSS): a phone. */
export const PHONE_QUERY = '(max-width: 47.99em)';

/**
 * Whether the window is as narrow as a phone (below the tablet breakpoint, the same as the CSS).
 * @returns {boolean} A phone.
 */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
