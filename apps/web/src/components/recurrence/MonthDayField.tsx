import { Checkbox, Group, NumberInput, type MantineSize } from '@mantine/core';
import { LAST_DAY } from '@ordo/shared';
import type { ReactNode } from 'react';

interface MonthDayFieldProps {
  /** Day number (1 to 31), or `LAST_DAY`. */
  value: number;
  /** Gives the day changed (a number typed, or the box ticked or not). */
  onChange: (day: number) => void;
  /** Day given when « Le dernier jour du mois » is unticked. */
  fallback: number;
  /** Called once the box is ticked or not, or the number left (a panel saved field by field saves then). Optional. */
  onCommit?: () => void;
  /** Label of the number field (none: `ariaLabel` only). Optional. */
  label?: string;
  /** Accessible name of the number field without label. Optional. */
  ariaLabel?: string;
  /** Text before the number (« le »). Optional. */
  prefix?: string;
  /** Size of the fields. Optional. Default = Mantine's. */
  size?: MantineSize;
  /** Width of the number field. Optional. */
  w?: number;
  /** Label of the box. Optional. Default = « Le dernier jour du mois » (a monthly « Ouverture »: « … du mois précédent »). */
  lastLabel?: string;
  /** Shown between the number and the box (the month of the day: « le dernier jour du mois [février] »). Optional. */
  month?: ReactNode;
}

/**
 * Day of the month of a repetition, of a duration or of an « Ouverture »: a number (1 to 31, the last day of a shorter
 * month), or the box « Le dernier jour du mois » (`LAST_DAY`: the 31st, 30th, 29th or 28th; the number hidden; unticked,
 * `fallback`). The same field everywhere a day of the month is chosen.
 * @param {MonthDayFieldProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function MonthDayField({ value, onChange, fallback, onCommit, label, ariaLabel, prefix, size, w, month, lastLabel = 'Le dernier jour du mois' }: MonthDayFieldProps) {
  const last = value === LAST_DAY;
  return (
    <Group gap="xs" align="flex-end" wrap="wrap">
      {!last && (
        // eslint-disable-next-line no-restricted-syntax -- MonthDayField itself.
        <NumberInput
          size={size}
          w={w}
          min={1}
          max={31}
          allowDecimal={false}
          prefix={prefix}
          label={label}
          aria-label={label ? undefined : ariaLabel}
          value={value}
          onChange={(day) => onChange(Math.min(31, Math.max(1, Number(day) || 1)))}
          onBlur={onCommit}
        />
      )}
      {month}
      <Checkbox
        size={size}
        label={lastLabel}
        checked={last}
        onChange={(event) => {
          onChange(event.currentTarget.checked ? LAST_DAY : fallback);
          onCommit?.();
        }}
      />
    </Group>
  );
}
