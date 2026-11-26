import { DateTimePicker, type DateTimePickerProps } from '@mantine/dates';
import * as fmt from '../../lib/format';
import { parisTodayDays, pickerDay, pickerMoment, todayPresets } from './date-fields';

/** Props of `DateTimeField`. */
export interface DateTimeFieldProps extends Omit<DateTimePickerProps<'default'>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'presets' | 'highlightToday' | 'date'> {
  /** Day (YYYY-MM-DD); null: none. */
  day: string | null;
  /** Time of day (HH:mm); null: none yet (the field then says the day, its time to choose). */
  time: string | null;
  /** Called with the day and the time picked (both null once cleared). */
  onChange: (day: string | null, time: string | null) => void;
  /**
   * Earliest moment that can be picked, read in Paris and rounded up to the minute: the days before it greyed out, the
   * earlier times of its day refused by the time picker. In place of `minDate` (ignored when both are given).
   */
  minInstant?: Date | number;
}

/**
 * Field of a day and its time, in one picker, the same everywhere: Mantine's `DateTimePicker` (24 hours), today (in
 * Paris) highlighted in its calendar and « Aujourd'hui » beside it (today, at the time already chosen, not before the
 * earliest moment). The day and the time stay two values (`formDateTime` binds them to a form). A whole day (no time)
 * is a `DateField`.
 * @param {DateTimeFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function DateTimeField({ day, time, onChange, placeholder, defaultTimeValue, minInstant, minDate, ...props }: DateTimeFieldProps) {
  const value = day && time ? `${day} ${time}:00` : null;
  const min = minInstant === undefined ? minDate : pickerMoment(minInstant);
  return (
    <DateTimePicker
      highlightToday
      presets={todayPresets({ min, max: props.maxDate, time: time ?? defaultTimeValue ?? null })}
      value={value}
      defaultDate={day ?? undefined}
      defaultTimeValue={defaultTimeValue}
      placeholder={day && !time ? `${fmt.day(day)}, heure à choisir` : placeholder}
      onChange={(next) => (next ? onChange(pickerDay(next), next.split(' ')[1].slice(0, 5)) : onChange(null, null))}
      minDate={min}
      {...props}
      getDayProps={parisTodayDays(props.getDayProps)}
    />
  );
}
