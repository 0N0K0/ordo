import { Group, NumberInput, Select } from '@mantine/core';
import { ONE_DAY, type Duration, type DurationUnit } from '@ordo/shared';
import { MONTHS } from './describe-recurrence';

const UNIT_LABELS: Record<DurationUnit, string> = {
  DAYS: 'Pendant des jours',
  WEEKS: 'Pendant des semaines (jusqu’au dimanche)',
  MONTHS: 'Pendant des mois (jusqu’à la fin du mois)',
  TO_DAY: 'Jusqu’à un jour (du mois, d’un mois)',
  TO_WEEK: 'Jusqu’à une semaine de l’année',
  TO_MONTH: 'Jusqu’à la fin d’un mois',
};
const MONTH_OPTIONS = MONTHS.map((name, index) => ({ value: String(index + 1), label: name }));

interface DurationFieldsProps {
  value: Duration;
  onChange: (value: Duration) => void;
  /** Ways offered to make an occurrence last; a single day is always one. */
  units: readonly DurationUnit[];
  /** Dropdowns kept in place (inside a popover). Optional. Default = true. */
  withinPortal?: boolean;
}

/**
 * How long each occurrence lasts from its first day: a day, days, weeks, months, or up to a day (of a month), a week
 * of the year or the end of a month (all-day events and slots, a routine done once over a weekend…).
 * @param {DurationFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function DurationFields({ value, onChange, units, withinPortal = true }: DurationFieldsProps) {
  const comboboxProps = { withinPortal };
  return (
    <Group gap="xs" align="flex-end" wrap="wrap">
      <Select
        size="xs"
        w={290}
        label="Chaque fois"
        data={units.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }))}
        value={value.unit}
        allowDeselect={false}
        comboboxProps={comboboxProps}
        onChange={(unit) => unit && onChange({ ...ONE_DAY, unit: unit as DurationUnit, day: unit === 'TO_DAY' ? 1 : null, week: unit === 'TO_WEEK' ? 1 : null, month: unit === 'TO_MONTH' ? 1 : null })}
      />
      {(value.unit === 'DAYS' || value.unit === 'WEEKS' || value.unit === 'MONTHS') && (
        <NumberInput
          size="xs"
          w={130}
          min={1}
          max={366}
          suffix={value.unit === 'DAYS' ? ' jour(s)' : value.unit === 'WEEKS' ? ' semaine(s)' : ' mois'}
          aria-label="Combien"
          value={value.count}
          onChange={(count) => onChange({ ...value, count: Math.min(366, Math.max(1, Number(count) || 1)) })}
        />
      )}
      {value.unit === 'TO_DAY' && (
        <>
          <NumberInput
            size="xs"
            w={100}
            min={1}
            max={31}
            prefix="le "
            aria-label="Dernier jour"
            value={value.day ?? 1}
            onChange={(day) => onChange({ ...value, day: Math.min(31, Math.max(1, Number(day) || 1)) })}
          />
          <Select
            size="xs"
            w={150}
            aria-label="Mois du dernier jour"
            placeholder="du même mois"
            clearable
            data={MONTH_OPTIONS}
            value={value.month ? String(value.month) : null}
            comboboxProps={comboboxProps}
            onChange={(month) => onChange({ ...value, month: month ? Number(month) : null })}
          />
        </>
      )}
      {value.unit === 'TO_WEEK' && (
        <NumberInput
          size="xs"
          w={130}
          min={1}
          max={53}
          prefix="semaine "
          aria-label="Dernière semaine"
          value={value.week ?? 1}
          onChange={(week) => onChange({ ...value, week: Math.min(53, Math.max(1, Number(week) || 1)) })}
        />
      )}
      {value.unit === 'TO_MONTH' && (
        <Select
          size="xs"
          w={150}
          aria-label="Dernier mois"
          data={MONTH_OPTIONS}
          value={String(value.month ?? 1)}
          allowDeselect={false}
          comboboxProps={comboboxProps}
          onChange={(month) => month && onChange({ ...value, month: Number(month) })}
        />
      )}
    </Group>
  );
}
