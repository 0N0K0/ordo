import { TimePicker, type TimePickerProps } from '@mantine/dates';

/**
 * Time of day field, always in 24-hour format ("HH:MM"), whatever the language of the browser (a native time input
 * would show AM / PM in an English one).
 * @param {TimePickerProps} props Props of Mantine's TimePicker (value and onChange: "HH:MM", empty when cleared).
 * @returns {JSX.Element} Field.
 */
export function TimeField(props: TimePickerProps) {
  return <TimePicker format="24h" hoursInputLabel="Heures" minutesInputLabel="Minutes" {...props} />;
}
