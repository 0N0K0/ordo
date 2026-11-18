// Breakpoints of the app, shared with the code (lib/use-is-phone.ts): one value each.
const breakpoints = require('./src/styles/breakpoints.json');

/**
 * Last width below a breakpoint, for a max-width query: « 48em » gives « 47.99em ».
 * @param {string} breakpoint Breakpoint, in em.
 * @returns {string} Width, in em.
 */
const below = (breakpoint) => `${parseFloat(breakpoint) - 0.01}em`;

module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
        // The tablet starts there (Mantine's sm, 768px); below, a phone. The same as useIsPhone (lib/use-is-phone.ts).
        'tablet-breakpoint': breakpoints.tablet,
        // The desktop of the design system (lg: 9 columns, 9 × 96 + 8 × 16 + 2 × 64 = 1120px): wider page margins.
        'desktop-breakpoint': breakpoints.desktop,
        // The sm columns of the design system (4 × 96 + 3 × 16 + 2 × 16 = 464px): below, the narrowest phones.
        'grid-sm-max': below(breakpoints.gridSm),
        // The md height of the design system (45 vertical steps of 24px = 1080px): a loose density in height.
        'height-md-breakpoint': breakpoints.heightMd,
      },
    },
  },
};
