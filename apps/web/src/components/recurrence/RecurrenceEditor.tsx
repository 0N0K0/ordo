import { ActionIcon, Button, Chip, Group, NumberInput, SegmentedControl, Select, Stack, Text, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_RECURRENCE, type Recurrence, type RecurrenceFrequency } from '@ordo/shared';
import { PauseIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { describeRecurrence, formatLongDate, WEEKDAY_NAMES, weekdayOfMonth } from './describe-recurrence';

const FREQUENCIES: { value: RecurrenceFrequency | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'Ne se répète pas' },
  { value: 'DAILY', label: 'Tous les jours' },
  { value: 'WEEKLY', label: 'Toutes les semaines' },
  { value: 'MONTHLY', label: 'Tous les mois' },
  { value: 'YEARLY', label: 'Tous les ans' },
];

const UNITS: Record<RecurrenceFrequency, string> = { DAILY: 'jour(s)', WEEKLY: 'semaine(s)', MONTHLY: 'mois', YEARLY: 'an(s)' };

interface RecurrenceEditorProps {
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
  /** First date the rule repeats from. */
  start: string;
  /** Dropdowns kept in place (inside a popover). */
  withinPortal?: boolean;
}

/**
 * Repetition settings: frequency, interval, weekdays, monthly mode, end (date or number), paused periods
 * and excluded dates, with a readable summary.
 * @param {RecurrenceEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RecurrenceEditor({ value, onChange, start, withinPortal = true }: RecurrenceEditorProps) {
  const comboboxProps = { withinPortal };
  const rule = value;
  /**
   * Changes some fields of the rule.
   * @param {Partial<Recurrence>} changes Changes.
   * @returns {void}
   */
  const update = (changes: Partial<Recurrence>) => rule && onChange({ ...rule, ...changes });
  const end = rule?.until ? 'UNTIL' : rule?.count ? 'COUNT' : 'NEVER';

  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label="Répétition"
          data={FREQUENCIES}
          value={rule?.frequency ?? 'NONE'}
          allowDeselect={false}
          comboboxProps={comboboxProps}
          onChange={(frequency) =>
            onChange(frequency === 'NONE' || !frequency ? null : { ...(rule ?? DEFAULT_RECURRENCE), frequency: frequency as RecurrenceFrequency })
          }
        />
        {rule && !(rule.frequency === 'WEEKLY' && rule.weekParity) && (
          <NumberInput
            label="Tous les"
            suffix={` ${UNITS[rule.frequency]}`}
            min={1}
            max={999}
            w={150}
            value={rule.interval}
            onChange={(interval) => update({ interval: typeof interval === 'number' ? interval : 1 })}
          />
        )}
      </Group>

      {rule?.frequency === 'WEEKLY' && (
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
      {rule?.frequency === 'WEEKLY' && (
        <Chip.Group multiple value={rule.weekdays.map(String)} onChange={(days) => update({ weekdays: days.map(Number).sort() })}>
          <Group gap={6}>
            {WEEKDAY_NAMES.map((name, index) => (
              <Chip key={name} value={String(index + 1)} size="xs">
                {name.slice(0, 3)}.
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      )}
      {rule?.frequency === 'MONTHLY' && (
        <SegmentedControl
          size="xs"
          value={rule.monthlyMode}
          onChange={(monthlyMode) => update({ monthlyMode: monthlyMode as Recurrence['monthlyMode'] })}
          data={[
            { value: 'DAY', label: `Le ${Number(start.slice(8))} du mois` },
            { value: 'WEEKDAY', label: weekdayOfMonth(start).replace(/^le /, 'Le ') },
          ]}
        />
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
              onChange={(next) =>
                update(next === 'UNTIL' ? { until: start, count: null } : next === 'COUNT' ? { until: null, count: 10 } : { until: null, count: null })
              }
            />
            {end === 'UNTIL' && (
              <DatePickerInput
                label="Jusqu’au"
                valueFormat="D MMM YYYY"
                minDate={start}
                value={rule.until}
                onChange={(until) => until && update({ until })}
                popoverProps={comboboxProps}
              />
            )}
            {end === 'COUNT' && (
              <NumberInput
                label="Nombre de fois"
                min={1}
                max={9999}
                w={140}
                value={rule.count ?? 1}
                onChange={(count) => update({ count: typeof count === 'number' ? count : 1 })}
              />
            )}
          </Group>

          <Stack gap={4}>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Pauses
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<PlusIcon aria-hidden />}
                onClick={() => update({ pauses: [...rule.pauses, { from: start, to: start }] })}
              >
                Ajouter une pause
              </Button>
            </Group>
            {rule.pauses.map((pause, index) => (
              <Group key={index} gap="xs" wrap="nowrap">
                <PauseIcon aria-hidden />
                <DatePickerInput
                  type="range"
                  aria-label={`Pause ${index + 1}`}
                  valueFormat="D MMM YYYY"
                  allowSingleDateInRange
                  value={[pause.from, pause.to]}
                  onChange={([from, to]) =>
                    from &&
                    update({ pauses: rule.pauses.map((item, position) => (position === index ? { from, to: to ?? from } : item)) })
                  }
                  popoverProps={comboboxProps}
                  style={{ flex: 1 }}
                />
                <Tooltip label="Retirer la pause">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Retirer la pause ${index + 1}`}
                    onClick={() => update({ pauses: rule.pauses.filter((_, position) => position !== index) })}
                  >
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
            {rule.pauses.length === 0 && (
              <Text size="xs" c="dimmed">
                Aucune occurrence pendant une pause (congés…), la répétition reprend ensuite.
              </Text>
            )}
          </Stack>

          {rule.exceptions.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Dates supprimées
              </Text>
              <Group gap={6}>
                {rule.exceptions.map((date) => (
                  <Chip
                    key={date}
                    size="xs"
                    checked={false}
                    title="Rétablir cette date"
                    onClick={() => update({ exceptions: rule.exceptions.filter((item) => item !== date) })}
                  >
                    {formatLongDate(date)} ×
                  </Chip>
                ))}
              </Group>
            </Stack>
          )}

          <Text size="sm" c="dimmed">
            {describeRecurrence(rule, start)}.
          </Text>
        </>
      )}
    </Stack>
  );
}
