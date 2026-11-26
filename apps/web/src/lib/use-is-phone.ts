import { useMediaQuery } from '@mantine/hooks';
import breakpoints from '../styles/breakpoints.json';

/** Below the tablet breakpoint (Mantine's sm; `$tablet-breakpoint` in the CSS, from styles/breakpoints.json): a phone. */
export const PHONE_QUERY = `(max-width: ${parseFloat(breakpoints.tablet) - 0.01}em)`;

/**
 * Whether the window is as narrow as a phone (below the tablet breakpoint, the same as the CSS).
 * @returns {boolean} A phone.
 */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** Below the desktop breakpoint (`desktop` of styles/breakpoints.json): a phone or a tablet. */
export const BELOW_DESKTOP_QUERY = `(max-width: ${parseFloat(breakpoints.desktop) - 0.01}em)`;

/**
 * Whether the window is narrower than a desktop (below the desktop breakpoint): side by side columns become tabs.
 * @returns {boolean} Narrower than a desktop.
 */
export function useIsBelowDesktop(): boolean {
  return useMediaQuery(BELOW_DESKTOP_QUERY);
}
