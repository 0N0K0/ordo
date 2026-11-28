import { Chip, Group, NumberInput, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { DateField } from '../inputs/DateField';
import {
  DEFAULT_RECURRENCE,
  dayOfMonthOf,
  isoWeekHasParity,
  weekdayOfDate,
  ruleValues,
  withRuleValues,
  type Recurrence,
  type RecurrenceFrequency,
  WEEKDAY_SHORT_LABELS,
  weekdayOptions,
  monthOptions,
  positionOptions,
  WEEK_PARITY_WORDS,
  weekPositionOptions,
  type WeekParity,
  repetitionLimits,
  repetitionLimitError,
  type Duration,
} from '@ordo/shared';
import { useState } from 'react';
import { MonthDayField } from './MonthDayField';
import { describeRecurrence } from './describe-recurrence';
import { plural } from '../../lib/text';

const FREQUENCIES: { value: RecurrenceFrequency | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'Ne se répète pas' },
  { value: 'DAILY', label: 'Tous les jours' },
  { value: 'WEEKLY', label: 'Toutes les semaines' },
  { value: 'MONTHLY', label: 'Tous les mois' },
  { value: 'YEARLY', label: 'Tous les ans' },
];

/**
 * Options of a choice of the weeks counted: all of them, or the even or odd ones only (weekly rules, monthly ones by
 * weekday).
 * @param {string} all Label of all the weeks.
 * @returns {{ value: string, label: string }[]} Options.
 */
const parityOptions = (all: string) => [
  { value: 'ALL', label: all },
  { value: 'EVEN', label: 'Semaines paires' },
  { value: 'ODD', label: 'Semaines impaires' },
];

/**
 * Parity chosen in a choice of `parityOptions`.
 * @param {string} value Option.
 * @returns {WeekParity | null} Parity, none for all the weeks.
 */
const parityOf = (value: string): WeekParity | null => (value === 'EVEN' || value === 'ODD' ? value : null);

/** Unit of the interval of each frequency: its singular and plural. */
const UNITS: Record<RecurrenceFrequency, [string, string]> = { DAILY: ['jour', 'jours'], WEEKLY: ['semaine', 'semaines'], MONTHLY: ['mois', 'mois'], YEARLY: ['an', 'ans'] };

interface RecurrenceEditorProps {
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
  /** First date the rule repeats from. */
  start: string;
  /** Dropdowns kept in place (inside a popover). */
  withinPortal?: boolean;
  /** Weekdays and even / odd weeks offered (weekly rules). Optional. Default = true. */
  weekly?: boolean;
  /** « Ne se répète pas » offered. Optional. Default = true. */
  allowNone?: boolean;
  /** The frequency is shown, not changed (the new rule of a series moved keeps its frequency). Optional. Default = false. */
  frequencyLocked?: boolean;
  /**
   * Called once a value is chosen (a frequency, a weekday, an end…) or a number is left: a panel saved field by field
   * saves the rule then, not on each key typed. Optional.
   */
  onCommit?: () => void;
  /**
   * Duration of each occurrence: the rules it allows only (the next occurrence after the end of the previous one,
   * `repetitionLimits`); a rule saved before that breaks them shows its error under its field once a field is left.
   * Optional. Default = a single day.
   */
  duration?: Duration | null;
  /** What it shows: everything, the rule without its « Fin », or its « Fin » only. Optional. Default = 'all'. */
  part?: 'all' | 'rule' | 'end';
}

/**
 * Rule of a repetition: frequency, interval, weekdays and even / odd weeks (every one, or one out of n), the day of
 * the month (by number, or nth weekday of the month or of its even / odd weeks) or of the year
 * (chosen, prefilled from the first date; or « Le dernier jour du mois », whatever its length), end (date or number),
 * with a readable summary (its exceptions are changed from its occurrences).
 * Each change is given at once (`onChange`); `onCommit` follows a choice at once, and a number once it is left.
 * With a `duration`, only the rules it allows are offered (`repetitionLimits`), and the error of a rule that breaks
 * them shows under its field once a field is left. `part` splits its « Fin » from the rest (placed apart).
 * @param {RecurrenceEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RecurrenceEditor({ value, onChange, start, withinPortal = true, weekly: weeklyAllowed = true, allowNone = true, frequencyLocked = false, onCommit: commit, duration, part = 'all' }: RecurrenceEditorProps) {
  const comboboxProps = { withinPortal };
  const rule = value;
  const limits = repetitionLimits(duration);
  // Its error once a field is left (validated on blur, then on every change).
  const [left, setLeft] = useState(false);
  const limitError = left ? repetitionLimitError(rule, duration) : null;
  /**
   * After a choice, or a number left: the error of the limits shown from then on, then committed.
   * @returns {void}
   */
  const onCommit = () => {
    setLeft(true);
    commit?.();
  };
  const weekly = weeklyAllowed;
  // One weekday only, its start's, when each occurrence lasts weeks or months (shown to fix a rule that has several).
  const weekdayChips = weekly && ((limits?.weekdays ?? true) || (rule?.weekdays.length ?? 0) > 1);
  const values = rule ? ruleValues(rule, start) : null;
  /**
   * Changes some fields of the rule.
   * @param {Partial<Recurrence>} changes Changes.
   * @returns {void}
   */
  const update = (changes: Partial<Recurrence>) => rule && onChange({ ...rule, ...changes });
  /**
   * Changes some fields of the rule from a choice: given, then committed.
   * @param {Partial<Recurrence>} changes Changes.
   * @returns {void}
   */
  const choose = (changes: Partial<Recurrence>) => {
    update(changes);
    onCommit?.();
  };
  const end = rule?.until ? 'UNTIL' : rule?.count ? 'COUNT' : 'NEVER';
  /**
   * Rank of the weekday of a monthly rule once its weeks are chosen (all, or the even or odd ones): that of the first
   * date when it is that weekday (in a week of that parity), so that it stays an occurrence; else the rank kept (a 4th
   * becoming the 3rd, a month having 3 even or odd weeks at most).
   * @param {WeekParity | null} parity Weeks chosen.
   * @returns {Recurrence['position']} Rank.
   */
  const rankFor = (parity: WeekParity | null): Recurrence['position'] => {
    if (!rule || !values) return null;
    if (weekdayOfDate(start) === values.weekday && (!parity || isoWeekHasParity(start, parity))) return ruleValues({ ...rule, weekdayParity: parity, position: null }, start).position;
    return parity && values.position === 4 ? 3 : values.position;
  };
  // Weekday of a monthly or yearly rule by week (« le 2e mardi »).
  const weekdaySelect = values && (
    <Select
      size="xs"
      w={130}
      aria-label="Jour de la semaine"
      data={weekdayOptions}
      value={String(values.weekday)}
      allowDeselect={false}
      comboboxProps={comboboxProps}
      onChange={(weekday) => weekday && choose({ ...values, weekday: Number(weekday) })}
    />
  );

  // « Fin » of the rule: never, a date, a number of times.
  const endFields = rule && (
    <Group gap="sm" align="flex-end" wrap="wrap">
      <Select
        label="Fin"
        w={200}
        data={[
          { value: 'NEVER', label: 'Jamais' },
          { value: 'UNTIL', label: 'À une date' },
          { value: 'COUNT', label: 'Après un nombre de fois' },
        ]}
        value={end}
        allowDeselect={false}
        comboboxProps={comboboxProps}
        onChange={(next) => choose(next === 'UNTIL' ? { until: start, count: null } : next === 'COUNT' ? { until: null, count: 10 } : { until: null, count: null })}
      />
      {end === 'UNTIL' && <DateField label="Jusqu’au" minDate={start} value={rule.until} onChange={(until) => until && choose({ until })} popoverProps={comboboxProps} />}
      {end === 'COUNT' && (
        <NumberInput label="Nombre de fois" min={1} max={9999} w={140} value={rule.count ?? 1} onChange={(count) => update({ count: typeof count === 'number' ? count : 1 })} onBlur={onCommit} />
      )}
    </Group>
  );
  if (part === 'end') return endFields;

  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label="Répétition"
          data={FREQUENCIES.filter((frequency) => (frequency.value === 'NONE' ? allowNone : !limits || limits.frequencies.includes(frequency.value) || frequency.value === rule?.frequency))}
          error={limitError?.field === 'frequency' ? limitError.message : undefined}
          value={rule?.frequency ?? 'NONE'}
          readOnly={frequencyLocked}
          allowDeselect={false}
          comboboxProps={comboboxProps}
          onChange={(frequency) => {
            onChange(
              frequency === 'NONE' || !frequency
                ? null
                : withRuleValues(
                    {
                      ...(rule ?? DEFAULT_RECURRENCE),
                      frequency: frequency as RecurrenceFrequency,
                      // One even or odd week out of n is weekly, an even or odd week of the month monthly.
                      parityInterval: frequency === 'WEEKLY' ? rule?.parityInterval : null,
                      parityShift: frequency === 'WEEKLY' ? rule?.parityShift : null,
                      weekdayParity: frequency === 'MONTHLY' ? rule?.weekdayParity : null,
                      // The week of the year is a yearly choice.
                      ...(frequency !== 'YEARLY' && rule?.monthlyMode === 'WEEK' ? { monthlyMode: 'DAY' as const } : {}),
                    },
                    start,
                  ),
            );
            onCommit?.();
          }}
        />
        {rule?.frequency === 'WEEKLY' && rule.weekParity && (
          // One week of that parity out of n (the interval is not used then).
          <NumberInput
            label="Toutes les"
            suffix={` ${plural(rule.parityInterval ?? 1, `semaine ${WEEK_PARITY_WORDS[rule.weekParity]}`, `semaines ${WEEK_PARITY_WORDS[rule.weekParity]}s`)}`}
            min={1}
            max={999}
            w={210}
            error={limitError?.field === 'interval' ? limitError.message : undefined}
            value={rule.parityInterval ?? 1}
            onChange={(every) => update({ parityInterval: typeof every === 'number' && every > 1 ? every : null })}
            onBlur={onCommit}
          />
        )}
        {rule && !(rule.frequency === 'WEEKLY' && rule.weekParity) && (
          <NumberInput
            label="Tous les"
            suffix={` ${plural(rule.interval, ...UNITS[rule.frequency])}`}
            min={limits?.minInterval[rule.frequency] ?? 1}
            // A rule saved below it keeps its value: its error says so.
            clampBehavior={limits ? 'none' : 'blur'}
            max={999}
            w={150}
            error={limitError?.field === 'interval' ? limitError.message : undefined}
            value={rule.interval}
            onChange={(interval) => update({ interval: typeof interval === 'number' ? Math.min(999, Math.max(1, Math.round(interval))) : 1 })}
            onBlur={onCommit}
          />
        )}
      </Group>

      {weekly && rule?.frequency === 'WEEKLY' && (
        <SegmentedControl
          size="xs"
          aria-label="Semaines"
          value={rule.weekParity ?? 'ALL'}
          // All the weeks: the number of even or odd weeks is dropped; another choice: the ISO weeks of that parity as they are.
          onChange={(value) => choose(parityOf(value) ? { weekParity: parityOf(value), parityShift: null } : { weekParity: null, parityInterval: null, parityShift: null })}
          data={parityOptions(rule.interval > 1 ? `Toutes les ${rule.interval} semaines` : 'Toutes les semaines')}
        />
      )}
      {weekdayChips && rule?.frequency === 'WEEKLY' && (
        <Chip.Group multiple value={rule.weekdays.map(String)} onChange={(days) => choose({ weekdays: days.map(Number).sort() })}>
          <Group gap={6}>
            {WEEKDAY_SHORT_LABELS.map((name, index) => (
              <Chip key={name} value={String(index + 1)} size="xs">
                {name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}
      {limitError?.field === 'weekdays' && (
        <Text size="xs" c="var(--mantine-color-error)">
          {limitError.message}
        </Text>
      )}
      {(rule?.frequency === 'MONTHLY' || rule?.frequency === 'YEARLY') && values && (
        <Stack gap="xs">
          <SegmentedControl
            size="xs"
            value={rule.monthlyMode}
            // A month repeats a day or a weekday: the week of the year is a yearly choice.
            // An even or odd week of the month goes with the weekday of the month only.
            onChange={(monthlyMode) => choose({ ...values, monthlyMode: monthlyMode as Recurrence['monthlyMode'], ...(monthlyMode === 'WEEKDAY' ? {} : { weekdayParity: null }) })}
            data={[
              { value: 'DAY', label: 'Un jour du mois' },
              { value: 'WEEKDAY', label: 'Un jour de semaine du mois' },
              ...(rule.frequency === 'YEARLY' ? [{ value: 'WEEK', label: 'Un jour d’une semaine' }] : []),
            ]}
          />
          <Group gap="xs" align="flex-end" wrap="wrap">
            {rule.monthlyMode === 'DAY' && (
              // Unticked, the last day gives way to the day of the first date.
              <MonthDayField
                size="xs"
                w={100}
                prefix="le "
                ariaLabel="Jour du mois"
                value={values.monthDay}
                fallback={dayOfMonthOf(start)}
                onChange={(monthDay) => update({ ...values, monthDay })}
                onCommit={onCommit}
              />
            )}
            {rule.monthlyMode === 'WEEKDAY' && (
              <>
                <Select
                  size="xs"
                  w={110}
                  aria-label="Rang"
                  data={rule.weekdayParity ? weekPositionOptions : positionOptions}
                  value={String(values.position)}
                  allowDeselect={false}
                  comboboxProps={comboboxProps}
                  onChange={(position) => position && choose({ ...values, position: Number(position) as Recurrence['position'] })}
                />
                {weekdaySelect}
                {rule.frequency === 'MONTHLY' && (
                  <SegmentedControl
                    size="xs"
                    aria-label="Semaines du mois"
                    value={rule.weekdayParity ?? 'ALL'}
                    onChange={(value) => choose({ ...values, weekdayParity: parityOf(value), position: rankFor(parityOf(value)) })}
                    data={parityOptions('Toutes les semaines')}
                  />
                )}
              </>
            )}
            {rule.frequency === 'YEARLY' && rule.monthlyMode !== 'WEEK' && (
              <Select
                size="xs"
                w={130}
                aria-label="Mois"
                data={monthOptions}
                value={String(values.month)}
                allowDeselect={false}
                comboboxProps={comboboxProps}
                onChange={(month) => month && choose({ ...values, month: Number(month) })}
              />
            )}
            {rule.monthlyMode === 'WEEK' && (
              <>
                {weekdaySelect}
                <NumberInput
                  size="xs"
                  w={130}
                  min={1}
                  max={53}
                  prefix="semaine "
                  aria-label="Semaine de l’année"
                  value={values.week}
                  onChange={(week) => update({ ...values, week: Math.min(53, Math.max(1, Number(week) || 1)) })}
                  onBlur={onCommit}
                />
              </>
            )}
          </Group>
        </Stack>
      )}

      {rule && (
        <>
          {part === 'all' && endFields}

          <Text size="sm" c="dimmed">
            {describeRecurrence(rule, start, weekly)}.
          </Text>
        </>
      )}
    </Stack>
  );
}
