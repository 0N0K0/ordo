/** Narrowest the navigation sidebar is: below, it is hidden entirely. */
const MIN_SIDEBAR_WIDTH = 200;
/** Narrowest the settings sidebar is, whatever the window. */
const MIN_SETTINGS_PIXELS = 480;

/**
 * Narrowest the settings sidebar is: a quarter of the window, and never under 480px.
 * @returns {number} Width in px.
 */
const settingsMinWidth = (): number => Math.round(Math.max(MIN_SETTINGS_PIXELS, window.innerWidth / 4));

/** Navigation sidebar, on the left: 280px by default, up to 480px and never more than 40% of the window. */
export const SIDEBAR_PANEL = {
  storageKey: 'ordo.sidebar.width',
  defaultWidth: 280,
  side: 'left',
  /**
   * Narrowest the navigation sidebar is.
   * @returns {number} Width in px.
   */
  minWidth: (): number => MIN_SIDEBAR_WIDTH,
  /**
   * Widest the navigation sidebar may be: 480px, and never more than 40% of the window (never under the minimum).
   * @returns {number} Width in px.
   */
  maxWidth: (): number => Math.max(MIN_SIDEBAR_WIDTH, Math.min(480, window.innerWidth * 0.4)),
  // At its minimum width, a double click gives it the width of its content.
  fitContent: true,
} as const;

/** Settings sidebar, on the right (it lies over the page): 640px by default, up to 1280px and 90% of the window. */
export const SETTINGS_PANEL = {
  storageKey: 'ordo.settings.width',
  defaultWidth: 640,
  side: 'right',
  minWidth: settingsMinWidth,
  /**
   * Widest the settings sidebar may be: 1280px, and never more than 90% of the window.
   * @returns {number} Width in px.
   */
  maxWidth: (): number => Math.max(settingsMinWidth(), Math.min(1280, window.innerWidth * 0.9)),
} as const;
