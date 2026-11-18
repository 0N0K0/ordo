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
        'tablet-breakpoint': '48em',
        // The desktop of the design system (lg: 9 columns, 9 × 96 + 8 × 16 + 2 × 64 = 1120px): wider page margins.
        'desktop-breakpoint': '70em',
      },
    },
  },
};
