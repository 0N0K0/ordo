import type { MultiSelectProps } from '@mantine/core';
import { BatchMultiSelect } from './BatchMultiSelect';

interface RemindersSelectProps extends Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> {
  /** Reminders offered, in minutes before. */
  presets: readonly { value: number; label: string }[];
  /** Reminders chosen, in minutes before. */
  value: readonly number[];
  /** Reminders chosen, from the soonest to the latest. */
  onChange: (reminders: number[]) => void;
  /** Placeholder when there is none. Optional. Default = none. */
  emptyLabel?: string;
}

/**
 * Reminders (or alerts) before a moment, chosen among presets.
 * @param {RemindersSelectProps} props Component props (and those of the multi-select).
 * @returns {JSX.Element} Multi-select.
 */
export function RemindersSelect({ presets, value, onChange, emptyLabel, ...props }: RemindersSelectProps) {
  return (
    <BatchMultiSelect
      placeholder={value.length ? undefined : emptyLabel}
      {...props}
      data={presets.map((preset) => ({ value: String(preset.value), label: preset.label }))}
      value={value.map(String)}
      onChange={(reminders) => onChange(reminders.map(Number).sort((a, b) => a - b))}
    />
  );
}
