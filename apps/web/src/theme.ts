import { createTheme, PasswordInput } from '@mantine/core';
import { VisibilityToggleIcon } from './components/VisibilityToggleIcon';

export const theme = createTheme({
  components: {
    PasswordInput: PasswordInput.extend({
      defaultProps: { visibilityToggleIcon: VisibilityToggleIcon },
    }),
  },
});

/** Default props of every Phosphor icon. */
export const iconDefaults = { size: '1.25em', weight: 'regular', mirrored: false } as const;
