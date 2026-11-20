import { Group, NumberInput, Select, Stack } from '@mantine/core';
import { monthOptions, positionOptions, weekdayOptions, type Recurrence, type RoutineOpens, type RoutineOpensMode } from '@ordo/shared';

interface OpensOnInputProps {
  /** Frequency of the rule it belongs to: a day of the month or of the year only for a monthly or yearly one. */
  frequency: Recurrence['frequency'];
  /** Null: from the first day of each occurrence. */
  value: RoutineOpens | null;
  onChange: (value: RoutineOpens | null) => void;
  error?: string;
}

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
  return [{ value: NONE, label: 'Dès son premier jour' }, ...(frequency === 'MONTHLY' || frequency === 'YEARLY' ? days : []), { value: 'BEFORE', label: 'Des jours avant l’échéance' }];
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
      return { mode, days: 1 };
  }
}

/**
 * « Ouverture »: day each occurrence can be done from, before its due day: a day number, a weekday of the month (the
 * 2nd Tuesday), the weekday of a week (of the month, or ISO week of the year), in its period (a monthly or yearly
 * rule), or some days before its due day; none: from its first day.
 * @param {OpensOnInputProps} props Component props.
 * @returns {JSX.Element} Input.
 */
export function OpensOnInput({ frequency, value, onChange, error }: OpensOnInputProps) {
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
   * Number of a select (its value as a number).
   * @param {string | null} next Value.
   * @returns {number} Number.
   */
  const number = (next: string | null) => Number(next ?? 1);
  const monthSelect = value && (value.mode === 'DAY' || value.mode === 'WEEKDAY') && yearly && (
    <Select label="Mois" data={monthOptions} value={String(value.month ?? 1)} onChange={(next) => change({ month: number(next) })} allowDeselect={false} />
  );
  const weekdaySelect = value && (value.mode === 'WEEKDAY' || value.mode === 'WEEK') && (
    <Select label="Jour" data={weekdayOptions} value={String(value.weekday)} onChange={(next) => change({ weekday: number(next) })} allowDeselect={false} />
  );
  return (
    <Stack gap="xs">
      <Select
        label="Ouverture"
        description="Facultatif : chaque occurrence est à faire dès ce jour, jusqu’à son échéance."
        data={options}
        value={mode}
        onChange={(next) => onChange(!next || next === NONE ? null : firstValue(next as RoutineOpensMode, frequency))}
        allowDeselect={false}
        error={error}
      />
      {value?.mode === 'DAY' && mode === 'DAY' && (
        <Group gap="sm" align="flex-start" grow>
          <NumberInput label="Jour" min={1} max={31} allowDecimal={false} value={value.day} onChange={(next) => change({ day: Math.min(31, Math.max(1, Number(next) || 1)) })} />
          {monthSelect}
        </Group>
      )}
      {value?.mode === 'WEEKDAY' && mode === 'WEEKDAY' && (
        <Group gap="sm" align="flex-start" grow>
          <Select label="Le" data={positionOptions} value={String(value.position)} onChange={(next) => change({ position: number(next) })} allowDeselect={false} />
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
          />
        </Group>
      )}
      {value?.mode === 'BEFORE' && (
        <NumberInput label="Jours avant l’échéance" min={1} max={366} allowDecimal={false} value={value.days} onChange={(next) => change({ days: Math.min(366, Math.max(1, Number(next) || 1)) })} />
      )}
    </Stack>
  );
}
