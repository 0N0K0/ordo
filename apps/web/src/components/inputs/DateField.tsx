import { DatePickerInput, type DatePickerInputProps } from '@mantine/dates';
import { excludedDays, parisTodayDays, todayPresets } from './date-fields';

/** Props of `DateField`: those of a one-day `DatePickerInput`, its presets set by the field. */
export type DateFieldProps = Omit<DatePickerInputProps<'default'>, 'type' | 'presets' | 'highlightToday'> & {
  /** Days greyed in its calendar, still choosable (`excludedDays`: days its « Horaires » exclude). Optional. */
  excludedDay?: (day: string) => boolean;
};

/**
 * Field of one day, the same everywhere: Mantine's `DatePickerInput`, today (in Paris) highlighted in its calendar, and
 * « Aujourd'hui » beside it (picks today, when it can be picked), the days `excludedDay` tells greyed. Weeks start on
 * Monday (`WeekDatesProvider`).
 * @param {DateFieldProps} props Props of `DatePickerInput`.
 * @returns {JSX.Element} Field.
 */
export function DateField({ excludedDay, ...props }: DateFieldProps) {
  return <DatePickerInput highlightToday presets={todayPresets({ min: props.minDate, max: props.maxDate })} {...props} getDayProps={parisTodayDays(excludedDays(excludedDay, props.getDayProps))} />;
}
