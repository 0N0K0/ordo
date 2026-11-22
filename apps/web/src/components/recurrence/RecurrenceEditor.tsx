import { LabeledField } from '../inputs/LabeledField';
import { AddItemButton } from '../actions/AddItemButton';
import { Chip, Group, NumberInput, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { DateField } from '../inputs/DateField';
import { PeriodField } from '../inputs/PeriodField';
import { DEFAULT_RECURRENCE, ruleValues, withRuleValues, type Recurrence, type RecurrenceFrequency, WEEKDAY_SHORT_LABELS, weekdayOptions, monthOptions, positionOptions } from '@ordo/shared';
import { PauseIcon } from '@phosphor-icons/react';
import { DeletedDates } from './DeletedDates';
import { describeRecurrence } from './describe-recurrence';
import { RemoveButton } from '../actions/RemoveButton';
import { plural } from '../../lib/text';

const FREQUENCIES: { value: RecurrenceFrequency | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'Ne se répète pas' },
  { value: 'DAILY', label: 'Tous les jours' },
  { value: 'WEEKLY', label: 'Toutes les semaines' },
  { value: 'MONTHLY', label: 'Tous les mois' },
  { value: 'YEARLY', label: 'Tous les ans' },
];

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
}

/**
 * Rule of a repetition: frequency, interval, weekdays and even / odd weeks, the day of the month or of the year
 * (chosen, prefilled from the first date), end (date or number), paused periods and deleted dates, with a readable summary.
 * @param {RecurrenceEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RecurrenceEditor({ value, onChange, start, withinPortal = true, weekly = true, allowNone = true }: RecurrenceEditorProps) {
  const comboboxProps = { withinPortal };
  const rule = value;
  const values = rule ? ruleValues(rule, start) : null;
  /**
   * Changes some fields of the rule.
   * @param {Partial<Recurrence>} changes Changes.
   * @returns {void}
   */
  const update = (changes: Partial<Recurrence>) => rule && onChange({ ...rule, ...changes });
  const end = rule?.until ? 'UNTIL' : rule?.count ? 'COUNT' : 'NEVER';
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
      onChange={(weekday) => weekday && update({ ...values, weekday: Number(weekday) })}
    />
  );

  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label="Répétition"
          data={allowNone ? FREQUENCIES : FREQUENCIES.filter((frequency) => frequency.value !== 'NONE')}
          value={rule?.frequency ?? 'NONE'}
          allowDeselect={false}
          comboboxProps={comboboxProps}
          onChange={(frequency) =>
            onChange(
              frequency === 'NONE' || !frequency
                ? null
                : withRuleValues(
                    {
                      ...(rule ?? DEFAULT_RECURRENCE),
                      frequency: frequency as RecurrenceFrequency,
                      // The week of the year is a yearly choice.
                      ...(frequency !== 'YEARLY' && rule?.monthlyMode === 'WEEK' ? { monthlyMode: 'DAY' as const } : {}),
                    },
                    start,
                  ),
            )
          }
        />
        {rule && !(rule.frequency === 'WEEKLY' && rule.weekParity) && (
          <NumberInput
            label="Tous les"
            suffix={` ${plural(rule.interval, ...UNITS[rule.frequency])}`}
            min={1}
            max={999}
            w={150}
            value={rule.interval}
            onChange={(interval) => update({ interval: typeof interval === 'number' ? interval : 1 })}
          />
        )}
      </Group>

      {weekly && rule?.frequency === 'WEEKLY' && (
        <SegmentedControl
          size="xs"
          aria-label="Semaines"
          value={rule.weekParity ?? 'ALL'}
          onChange={(value) => update({ weekParity: value === 'ALL' ? null : (value as 'EVEN' | 'ODD') })}
          data={[
            { value: 'ALL', label: rule.interval > 1 ? `Toutes les ${rule.interval} semaines` : 'Toutes les semaines' },
            { value: 'EVEN', label: 'Semaines paires' },
            { value: 'ODD', label: 'Semaines impaires' },
          ]}
        />
      )}
      {weekly && rule?.frequency === 'WEEKLY' && (
        <Chip.Group multiple value={rule.weekdays.map(String)} onChange={(days) => update({ weekdays: days.map(Number).sort() })}>
          <Group gap={6}>
            {WEEKDAY_SHORT_LABELS.map((name, index) => (
              <Chip key={name} value={String(index + 1)} size="xs">
                {name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}
      {(rule?.frequency === 'MONTHLY' || rule?.frequency === 'YEARLY') && values && (
        <Stack gap="xs">
          <SegmentedControl
            size="xs"
            value={rule.monthlyMode}
            // A month repeats a day or a weekday: the week of the year is a yearly choice.
            onChange={(monthlyMode) => update({ ...values, monthlyMode: monthlyMode as Recurrence['monthlyMode'] })}
            data={[
              { value: 'DAY', label: 'Un jour du mois' },
              { value: 'WEEKDAY', label: 'Un jour de semaine du mois' },
              ...(rule.frequency === 'YEARLY' ? [{ value: 'WEEK', label: 'Un jour d’une semaine' }] : []),
            ]}
          />
          <Group gap="xs" align="flex-end" wrap="wrap">
            {rule.monthlyMode === 'DAY' && (
              <NumberInput
                size="xs"
                w={100}
                min={1}
                max={31}
                prefix="le "
                aria-label="Jour du mois"
                value={values.monthDay}
                onChange={(monthDay) => update({ ...values, monthDay: Math.min(31, Math.max(1, Number(monthDay) || 1)) })}
              />
            )}
            {rule.monthlyMode === 'WEEKDAY' && (
              <>
                <Select
                  size="xs"
                  w={110}
                  aria-label="Rang"
                  data={positionOptions}
                  value={String(values.position)}
                  allowDeselect={false}
                  comboboxProps={comboboxProps}
                  onChange={(position) => position && update({ ...values, position: Number(position) as Recurrence['position'] })}
                />
                {weekdaySelect}
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
                onChange={(month) => month && update({ ...values, month: Number(month) })}
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
                />
              </>
            )}
          </Group>
        </Stack>
      )}

      {rule && (
        <>
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
              onChange={(next) => update(next === 'UNTIL' ? { until: start, count: null } : next === 'COUNT' ? { until: null, count: 10 } : { until: null, count: null })}
            />
            {end === 'UNTIL' && <DateField label="Jusqu’au" minDate={start} value={rule.until} onChange={(until) => until && update({ until })} popoverProps={comboboxProps} />}
            {end === 'COUNT' && (
              <NumberInput label="Nombre de fois" min={1} max={9999} w={140} value={rule.count ?? 1} onChange={(count) => update({ count: typeof count === 'number' ? count : 1 })} />
            )}
          </Group>

          <LabeledField label="Pauses">
            {rule.pauses.map((pause, index) => (
              <Group key={index} gap="xs" wrap="nowrap">
                <PauseIcon aria-hidden />
                <PeriodField
                  aria-label={`Pause ${index + 1}`}
                  required
                  value={[pause.from, pause.to]}
                  onChange={([from, to]) => from && update({ pauses: rule.pauses.map((item, position) => (position === index ? { from, to: to ?? from } : item)) })}
                  popoverProps={comboboxProps}
                  style={{ flex: 1 }}
                />
                <RemoveButton label="Retirer" aria-label={`Retirer la pause ${index + 1}`} onClick={() => update({ pauses: rule.pauses.filter((_, position) => position !== index) })} />
              </Group>
            ))}
            {rule.pauses.length === 0 && (
              <Text size="xs" c="dimmed">
                Aucune occurrence pendant une pause (congés…), la répétition reprend ensuite.
              </Text>
            )}
            <AddItemButton onClick={() => update({ pauses: [...rule.pauses, { from: start, to: start }] })}>Ajouter une pause</AddItemButton>
          </LabeledField>

          <DeletedDates dates={rule.exceptions} onChange={(dates) => update({ exceptions: dates })} />

          <Text size="sm" c="dimmed">
            {describeRecurrence(rule, start, weekly)}.
          </Text>
        </>
      )}
    </Stack>
  );
}
