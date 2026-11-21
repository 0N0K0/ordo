import { Select, type SelectProps } from '@mantine/core';
import { isRingtone, RINGTONES, type RingtoneId } from '@ordo/shared';

/** Choice of the ringtone of the settings. */
const SETTINGS_RINGTONE = '';

/** Ringtones an alarm can name: the one of the settings first. */
const RINGTONE_OPTIONS = [{ value: SETTINGS_RINGTONE, label: 'Celle des réglages' }, ...RINGTONES.map((ringtone) => ({ value: ringtone.id, label: ringtone.label }))];

interface RingtoneSelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange' | 'allowDeselect'> {
  /** Ringtone chosen; none: the one of the settings of the user. */
  value: RingtoneId | null | undefined;
  onChange: (ringtone: RingtoneId | null) => void;
}

/**
 * Ringtone of what rings (a reminder, a dead time, a timer), the same everywhere: « Celle des
 * réglages » first, then the ringtones of the bank.
 * @param {RingtoneSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function RingtoneSelect({ value, onChange, ...props }: RingtoneSelectProps) {
  return <Select {...props} data={RINGTONE_OPTIONS} value={value ?? SETTINGS_RINGTONE} allowDeselect={false} onChange={(ringtone) => onChange(isRingtone(ringtone) ? ringtone : null)} />;
}
