import { Group, NumberInput, Select, Stack } from '@mantine/core';
import { MonthDayField } from '../../../components/recurrence/MonthDayField';
import { monthOptions, OPENS_UNITS, positionOptions, weekdayOptions, type OpensUnit, type Recurrence, type RoutineOpens, type RoutineOpensMode } from '@ordo/shared';
import { plural } from '../../../lib/text';

interface OpensOnInputProps {
  /** Frequency of the rule it belongs to: a day of the month or of the year only for a monthly or yearly one. */
  frequency: Recurrence['frequency'];
  /** Null: from the first day of each occurrence. */
  value: RoutineOpens | null;
  onChange: (value: RoutineOpens | null) => void;
  /** Called once a value is chosen or a number is left (a panel saved field by field saves then). Optional. */
  onCommit?: () => void;
  error?: string;
}

/** Words of each unit of an « Ouverture » before the due day, by how many. */
const UNIT_LABELS: Record<OpensUnit, (count: number) => string> = {
  DAYS: (count) => plural(count, 'jour', 'jours'),
  WEEKS: (count) => plural(count, 'semaine', 'semaines'),
  MONTHS: () => 'mois',
};

/** No « Ouverture ». */
const NONE = 'NONE';

/**
 * Modes of « Ouverture » a frequency offers: a day of the period for a monthly or yearly one, days before always.
 * @param {Recurrence['frequency']} frequency Frequency.
 * @returns {{ value: string, label: string }[]} Options.
 */
function modeOptions(frequency: Recurrence['frequency']): { value: string; label: string }[] {
  const period = frequency === 'YEARLY' ? 'de l’année' : 'du mois';
  const days = [
    { value: 'DAY', label: `Un jour ${period}` },
    { value: 'WEEKDAY', label: `Un jour de semaine ${frequency === 'YEARLY' ? 'd’un mois' : 'du mois'}` },
    { value: 'WEEK', label: `Un jour d’une semaine ${period}` },
  ];
  return [{ value: NONE, label: 'Dès son premier jour' }, ...(frequency === 'MONTHLY' || frequency === 'YEARLY' ? days : []), { value: 'BEFORE', label: 'Avant l’échéance' }];
}

/**
 * First value of a mode (the 1st, the first Monday, the Monday of the first week, a day before).
 * @param {RoutineOpensMode} mode Mode.
 * @param {Recurrence['frequency']} frequency Frequency.
 * @returns {RoutineOpens} Value.
 */
function firstValue(mode: RoutineOpensMode, frequency: Recurrence['frequency']): RoutineOpens {
  const month = frequency === 'YEARLY' ? 1 : null;
  switch (mode) {
    case 'DAY':
      return { mode, day: 1, month };
    case 'WEEKDAY':
      return { mode, position: 1, weekday: 1, month };
    case 'WEEK':
      return { mode, week: 1, weekday: 1 };
    case 'BEFORE':
      return { mode, days: 1, unit: 'DAYS' };
  }
}

/**
 * « Ouverture »: day each occurrence can be done from, before its due day: a day number (or the last day of the month,
 * `MonthDayField`), a weekday of the month (the
 * 2nd Tuesday), the weekday of a week (of the month, or ISO week of the year), in its period (a monthly or yearly
 * rule), or some days, weeks or months before its due day; none: from its first day. Each change is given at once; `onCommit` follows a
 * choice at once, and a number once it is left.
 * @param {OpensOnInputProps} props Component props.
 * @returns {JSX.Element} Input.
 */
export function OpensOnInput({ frequency, value, onChange, onCommit, error }: OpensOnInputProps) {
  const options = modeOptions(frequency);
  const mode = value && options.some((option) => option.value === value.mode) ? value.mode : NONE;
  const yearly = frequency === 'YEARLY';
  /**
   * Changes some values of the current mode.
   * @param {Partial<RoutineOpens>} changes Changes.
   * @returns {void}
   */
  const change = (changes: Partial<RoutineOpens>) => value && onChange({ ...value, ...changes } as RoutineOpens);
  /**
   * Changes some values of the current mode from a choice: given, then committed.
   * @param {Partial<RoutineOpens>} changes Changes.
   * @returns {void}
   */
  const choose = (changes: Partial<RoutineOpens>) => {
    change(changes);
    onCommit?.();
  };
  /**
   * Number of a select (its value as a number).
   * @param {string | null} next Value.
   * @returns {number} Number.
   */
  const number = (next: string | null) => Number(next ?? 1);
  const monthSelect = value && (value.mode === 'DAY' || value.mode === 'WEEKDAY') && yearly && (
    <Select label="Mois" data={monthOptions} value={String(value.month ?? 1)} onChange={(next) => choose({ month: number(next) })} allowDeselect={false} />
  );
  const weekdaySelect = value && (value.mode === 'WEEKDAY' || value.mode === 'WEEK') && (
    <Select label="Jour" data={weekdayOptions} value={String(value.weekday)} onChange={(next) => choose({ weekday: number(next) })} allowDeselect={false} />
  );
  return (
    <Stack gap="xs">
      <Select
        label="Ouverture"
        description="Facultatif : chaque occurrence est à faire dès ce jour, jusqu’à son échéance."
        data={options}
        value={mode}
        onChange={(next) => {
          onChange(!next || next === NONE ? null : firstValue(next as RoutineOpensMode, frequency));
          onCommit?.();
        }}
        allowDeselect={false}
        error={error}
      />
      {value?.mode === 'DAY' && mode === 'DAY' && (
        // Monthly, the last day is always that of the month before the due day's.
        <MonthDayField
          label="Jour"
          value={value.day}
          fallback={1}
          onChange={(day) => change({ day })}
          onCommit={onCommit}
          month={monthSelect}
          lastLabel={yearly ? undefined : 'Le dernier jour du mois précédent'}
        />
      )}
      {value?.mode === 'WEEKDAY' && mode === 'WEEKDAY' && (
        <Group gap="sm" align="flex-start" grow>
          <Select label="Le" data={positionOptions} value={String(value.position)} onChange={(next) => choose({ position: number(next) })} allowDeselect={false} />
          {weekdaySelect}
          {monthSelect}
        </Group>
      )}
      {value?.mode === 'WEEK' && mode === 'WEEK' && (
        <Group gap="sm" align="flex-start" grow>
          {weekdaySelect}
          <NumberInput
            label={yearly ? 'Semaine de l’année' : 'Semaine du mois'}
            min={1}
            max={yearly ? 53 : 6}
            allowDecimal={false}
            value={value.week}
            onChange={(next) => change({ week: Math.min(yearly ? 53 : 6, Math.max(1, Number(next) || 1)) })}
            onBlur={onCommit}
          />
        </Group>
      )}
      {value?.mode === 'BEFORE' && (
        <Group gap="sm" align="flex-end" wrap="nowrap">
          <NumberInput label="Avant l’échéance" w={110} min={1} max={366} allowDecimal={false} value={value.days} onChange={(next) => change({ days: Math.min(366, Math.max(1, Number(next) || 1)) })} onBlur={onCommit} />
          <Select
            aria-label="Unité de l’ouverture"
            w={140}
            data={OPENS_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit](value.days) }))}
            value={value.unit ?? 'DAYS'}
            onChange={(unit) => unit && choose({ unit: unit as OpensUnit })}
            allowDeselect={false}
          />
        </Group>
      )}
    </Stack>
  );
}
