import { createTheme, PasswordInput } from '@mantine/core';
import { DatePickerInput, DateTimePicker, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { PICKER_FORMATS } from './lib/format';
import { VisibilityToggleIcon } from './components/VisibilityToggleIcon';

export const theme = createTheme({
  components: {
    PasswordInput: PasswordInput.extend({
      defaultProps: { visibilityToggleIcon: VisibilityToggleIcon },
    }),
    // The readable forms of the app (lib/format) instead of Mantine's "October 20, 2026".
    DatePickerInput: DatePickerInput.extend({ defaultProps: { valueFormat: PICKER_FORMATS.day } }),
    DateTimePicker: DateTimePicker.extend({ defaultProps: { valueFormat: PICKER_FORMATS.dateTime } }),
    MonthPickerInput: MonthPickerInput.extend({ defaultProps: { valueFormat: PICKER_FORMATS.month } }),
    YearPickerInput: YearPickerInput.extend({ defaultProps: { valueFormat: PICKER_FORMATS.year } }),
  },
});

/** Default props of every Phosphor icon. */
export const iconDefaults = { size: '1.25em', weight: 'regular', mirrored: false } as const;
