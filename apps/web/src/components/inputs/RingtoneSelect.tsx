import { Select, type SelectProps } from '@mantine/core';
import { isRingtone, RINGTONES, type RingtoneId } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import { previewRingtone } from '../../lib/alarm-sound';
import { IconAction } from '../actions/IconAction';

/** Choice of the ringtone of the settings. */
const SETTINGS_RINGTONE = '';

/** Ringtones of the bank. */
const BANK_OPTIONS = RINGTONES.map((ringtone) => ({ value: ringtone.id, label: ringtone.label }));

/** Ringtones an alarm can name: the one of the settings first. */
const RINGTONE_OPTIONS = [{ value: SETTINGS_RINGTONE, label: 'Celle des réglages' }, ...BANK_OPTIONS];

interface RingtoneSelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange' | 'allowDeselect' | 'leftSection'> {
  /** Ringtone chosen; none: the one of the settings of the user. */
  value: RingtoneId | null | undefined;
  onChange: (ringtone: RingtoneId | null) => void;
  /** « Celle des réglages » is offered first (the settings themselves choose among the bank only). Optional. Default = true. */
  withSettings?: boolean;
}

/**
 * Ringtone of what rings (a reminder, a dead time, a timer, a saved timer, the settings), the same everywhere:
 * « Celle des réglages » first, then the ringtones of the bank; « Écouter » (its play button, at its start) plays the
 * one chosen once (« Celle des réglages »: the ringtone of the settings).
 * @param {RingtoneSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function RingtoneSelect({ value, onChange, withSettings = true, size, ...props }: RingtoneSelectProps) {
  const chosen = isRingtone(value) ? value : null;
  const label = RINGTONE_OPTIONS.find((option) => option.value === (chosen ?? SETTINGS_RINGTONE))?.label;
  return (
    <Select
      {...props}
      size={size}
      data={withSettings ? RINGTONE_OPTIONS : BANK_OPTIONS}
      value={chosen ?? (withSettings ? SETTINGS_RINGTONE : null)}
      allowDeselect={false}
      onChange={(ringtone) => onChange(isRingtone(ringtone) ? ringtone : null)}
      leftSectionPointerEvents="all"
      leftSection={
        <IconAction label="Écouter" item={label} size={size === 'xs' ? 'sm' : 'md'} onClick={() => previewRingtone(chosen)}>
          <PlayIcon aria-hidden />
        </IconAction>
      }
    />
  );
}
