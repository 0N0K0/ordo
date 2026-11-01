import { createTheme, PasswordInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { VisibilityToggleIcon } from './components/VisibilityToggleIcon';

export const theme = createTheme({
  components: {
    PasswordInput: PasswordInput.extend({
      defaultProps: { visibilityToggleIcon: VisibilityToggleIcon },
    }),
    // French day-first format ("20 octobre 2026") instead of Mantine's "October 20, 2026".
    DatePickerInput: DatePickerInput.extend({
      defaultProps: { valueFormat: 'D MMMM YYYY' },
    }),
  },
});

/** Default props of every Phosphor icon. */
export const iconDefaults = { size: '1.25em', weight: 'regular', mirrored: false } as const;
