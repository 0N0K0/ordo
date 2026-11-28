import { Group, NumberInput, Select } from '@mantine/core';
import { monthOptions, ONE_DAY, type Duration, type DurationUnit } from '@ordo/shared';
import { plural } from '../../lib/text';
import { MonthDayField } from './MonthDayField';

const UNIT_LABELS: Record<DurationUnit, string> = {
  DAYS: 'Pendant des jours',
  WEEKS: 'Pendant des semaines (jusqu’au dimanche)',
  MONTHS: 'Pendant des mois (jusqu’à la fin du mois)',
  TO_DAY: 'Jusqu’à un jour (du mois, d’un mois)',
  TO_WEEK: 'Jusqu’à une semaine de l’année',
  TO_MONTH: 'Jusqu’à la fin d’un mois',
};

interface DurationFieldsProps {
  value: Duration;
  onChange: (value: Duration) => void;
  /** Ways offered to make an occurrence last; a single day is always one. */
  units: readonly DurationUnit[];
  /** Dropdowns kept in place (inside a popover). Optional. Default = true. */
  withinPortal?: boolean;
  /** Called once a value is chosen or a number is left (a panel saved field by field saves then). Optional. */
  onCommit?: () => void;
}

/**
 * How long each occurrence lasts from its first day: a day, days, weeks, months, or up to a day (of a month; or its
 * last day, « Le dernier jour du mois »: `MonthDayField`), a week
 * of the year or the end of a month (all-day events and slots, a routine done once over a weekend…). Each change is
 * given at once; `onCommit` follows a choice at once, and a number once it is left.
 * @param {DurationFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function DurationFields({ value, onChange, units, withinPortal = true, onCommit }: DurationFieldsProps) {
  const comboboxProps = { withinPortal };
  /**
   * Gives a value chosen, then commits it.
   * @param {Duration} next Duration.
   * @returns {void}
   */
  const choose = (next: Duration) => {
    onChange(next);
    onCommit?.();
  };
  return (
    <Group gap="xs" align="flex-end" wrap="wrap">
      <Select
        size="xs"
        w={290}
        label="Durée"
        data={units.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }))}
        value={value.unit}
        allowDeselect={false}
        comboboxProps={comboboxProps}
        onChange={(unit) => unit && choose({ ...ONE_DAY, unit: unit as DurationUnit, day: unit === 'TO_DAY' ? 1 : null, week: unit === 'TO_WEEK' ? 1 : null, month: unit === 'TO_MONTH' ? 1 : null })}
      />
      {(value.unit === 'DAYS' || value.unit === 'WEEKS' || value.unit === 'MONTHS') && (
        <NumberInput
          size="xs"
          w={130}
          min={1}
          max={366}
          suffix={` ${value.unit === 'DAYS' ? plural(value.count, 'jour') : value.unit === 'WEEKS' ? plural(value.count, 'semaine') : 'mois'}`}
          aria-label="Combien"
          value={value.count}
          onChange={(count) => onChange({ ...value, count: Math.min(366, Math.max(1, Number(count) || 1)) })}
          onBlur={onCommit}
        />
      )}
      {value.unit === 'TO_DAY' && (
          <MonthDayField
            size="xs"
            w={100}
            prefix="le "
            ariaLabel="Dernier jour"
            value={value.day ?? 1}
            fallback={1}
            onChange={(day) => onChange({ ...value, day })}
            onCommit={onCommit}
            month={
              <Select
                size="xs"
                w={150}
                aria-label="Mois du dernier jour"
                placeholder="du même mois"
                clearable
                data={monthOptions}
                value={value.month ? String(value.month) : null}
                comboboxProps={comboboxProps}
                onChange={(month) => choose({ ...value, month: month ? Number(month) : null })}
              />
            }
          />
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
          onBlur={onCommit}
        />
      )}
      {value.unit === 'TO_MONTH' && (
        <Select
          size="xs"
          w={150}
          aria-label="Dernier mois"
          data={monthOptions}
          value={String(value.month ?? 1)}
          allowDeselect={false}
          comboboxProps={comboboxProps}
          onChange={(month) => month && choose({ ...value, month: Number(month) })}
        />
      )}
    </Group>
  );
}
