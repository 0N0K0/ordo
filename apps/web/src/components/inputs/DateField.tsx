import { DatePickerInput, type DatePickerInputProps } from '@mantine/dates';
import { todayPresets } from './date-fields';

/** Props of `DateField`: those of a one-day `DatePickerInput`, its presets set by the field. */
export type DateFieldProps = Omit<DatePickerInputProps<'default'>, 'type' | 'presets' | 'highlightToday'>;

/**
 * Field of one day, the same everywhere: Mantine's `DatePickerInput`, today highlighted in its calendar, and
 * « Aujourd'hui » beside it (picks today, when it can be picked). Weeks start on Monday (`WeekDatesProvider`).
 * @param {DateFieldProps} props Props of `DatePickerInput`.
 * @returns {JSX.Element} Field.
 */
export function DateField(props: DateFieldProps) {
  return <DatePickerInput highlightToday presets={todayPresets({ min: props.minDate, max: props.maxDate })} {...props} />;
}
