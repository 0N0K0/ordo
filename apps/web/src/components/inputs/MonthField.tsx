import { MonthPickerInput, type MonthPickerInputProps } from '@mantine/dates';
import { pickerDay, thisMonthPresets } from './date-fields';

/** Props of `MonthField`: those of a one-month `MonthPickerInput`, its presets set by the field. */
export type MonthFieldProps = Omit<MonthPickerInputProps<'default'>, 'type' | 'presets'>;

/**
 * Field of one month, the same everywhere: Mantine's `MonthPickerInput` with « Ce mois-ci » beside it (when the
 * current month can be picked).
 * @param {MonthFieldProps} props Props of `MonthPickerInput`.
 * @returns {JSX.Element} Field.
 */
export function MonthField(props: MonthFieldProps) {
  const { minDate, maxDate } = props;
  return <MonthPickerInput presets={thisMonthPresets({ min: minDate ? pickerDay(minDate) : null, max: maxDate ? pickerDay(maxDate) : null })} {...props} />;
}
