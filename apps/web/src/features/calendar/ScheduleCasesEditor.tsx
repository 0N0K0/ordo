import { TimeField } from '../../components/TimeField';
import { ActionIcon, Button, Checkbox, Chip, Group, NumberInput, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { isoWeek, type ScheduleCase, type SchedulePattern } from '@ordo/shared';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import { describeCase, MONTH_NAMES, newCase, parityStart, WEEKDAY_NAMES } from './schedule-text';
import { CaseCard } from '../../components/recurrence/CaseCard';
import { useCaseFolds } from '../../components/recurrence/use-case-folds';

const PATTERN_LABELS: Record<SchedulePattern, string> = {
  DAILY: 'Tous les jours',
  WEEKLY: 'Certains jours de la semaine',
  EVERY_N_DAYS: 'Tous les N jours',
  MONTHLY: 'Chaque mois',
  YEARLY: 'Chaque année',
};
const SHORTCUTS = [
  { label: 'Tous', days: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'Semaine', days: [1, 2, 3, 4, 5] },
  { label: 'Week-end', days: [6, 7] },
];

interface CaseEditorProps {
  item: ScheduleCase;
  onChange: (changes: Partial<ScheduleCase>) => void;
  onRemove: () => void;
  rhythm: 'DAY' | 'WEEK' | 'ANY';
  /** Start of the period (rhythms count from it by default). */
  periodStart: string;
  index: number;
  /** Folded or not (several cases). */
  collapsible: boolean;
  opened: boolean;
  onToggle: () => void;
}

/**
 * One case: its days (as the period allows) and its hours (time ranges, or the whole day).
 * @param {CaseEditorProps} props Component props.
 * @returns {JSX.Element} Case.
 */
function CaseEditor({ item, onChange, onRemove, rhythm, periodStart, index, collapsible, opened, onToggle }: CaseEditorProps) {
  const patterns = (rhythm === 'DAY' ? [] : rhythm === 'WEEK' ? ['DAILY', 'WEEKLY'] : ['DAILY', 'WEEKLY', 'EVERY_N_DAYS', 'MONTHLY', 'YEARLY']) as SchedulePattern[];
  const monthly = item.pattern === 'MONTHLY' || item.pattern === 'YEARLY';
  const parity = item.pattern === 'WEEKLY' && item.every === 2 ? (isoWeek(item.from ?? periodStart) % 2 === 0 ? 'even' : 'odd') : null;

  return (
    <CaseCard index={index + 1} summary={describeCase(item)} collapsible={collapsible} opened={opened} onToggle={onToggle} onRemove={onRemove}>
      {patterns.length > 1 && (
        <Select
          size="xs"
          aria-label={`Jours du cas ${index + 1}`}
          data={patterns.map((pattern) => ({ value: pattern, label: PATTERN_LABELS[pattern] }))}
          value={item.pattern}
          allowDeselect={false}
          onChange={(pattern) => pattern && onChange({ pattern: pattern as SchedulePattern, every: 1, from: null })}
        />
      )}

      {item.pattern === 'WEEKLY' && (
        <Stack gap={6}>
          <Group gap={4}>
            <Chip.Group multiple value={item.weekdays.map(String)} onChange={(days) => onChange({ weekdays: days.map(Number).sort() })}>
              {WEEKDAY_NAMES.map((name, day) => (
                <Chip key={name} value={String(day + 1)} size="xs" variant="light">
                  {name.slice(0, 3)}
                </Chip>
              ))}
            </Chip.Group>
            {SHORTCUTS.map((shortcut) => (
              <Button key={shortcut.label} size="compact-xs" variant="subtle" onClick={() => onChange({ weekdays: shortcut.days })}>
                {shortcut.label}
              </Button>
            ))}
          </Group>
          {rhythm === 'ANY' && (
            <Group gap="xs" align="flex-end">
              <Select
                size="xs"
                w={190}
                aria-label="Rythme des semaines"
                data={[
                  { value: '1', label: 'Chaque semaine' },
                  { value: '2', label: 'Une semaine sur 2' },
                  { value: 'n', label: 'Une semaine sur N…' },
                ]}
                value={item.every === 1 ? '1' : item.every === 2 ? '2' : 'n'}
                allowDeselect={false}
                onChange={(value) => onChange(value === '1' ? { every: 1, from: null } : value === '2' ? { every: 2, from: parityStart(periodStart, 'even') } : { every: 3, from: null })}
              />
              {parity && (
                <SegmentedControl
                  size="xs"
                  data={[
                    { value: 'even', label: 'Semaines paires' },
                    { value: 'odd', label: 'Semaines impaires' },
                  ]}
                  value={parity}
                  onChange={(value) => onChange({ from: parityStart(periodStart, value as 'even' | 'odd') })}
                />
              )}
              {item.every > 2 && (
                <>
                  <NumberInput size="xs" w={120} min={3} max={52} prefix="1 sur " value={item.every} onChange={(value) => onChange({ every: Math.max(3, Number(value) || 3) })} />
                  <DatePickerInput
                    size="xs"
                    w={180}
                    valueFormat="[Dès la sem. du] D MMM YYYY"
                    placeholder="Dès le début"
                    clearable
                    value={item.from}
                    onChange={(date) => onChange({ from: date ? String(date) : null })}
                  />
                </>
              )}
            </Group>
          )}
        </Stack>
      )}

      {item.pattern === 'EVERY_N_DAYS' && (
        <Group gap="xs">
          <NumberInput size="xs" w={140} min={2} max={366} prefix="Tous les " suffix=" jours" value={item.every} onChange={(value) => onChange({ every: Math.max(1, Number(value) || 1) })} />
          <DatePickerInput
            size="xs"
            w={190}
            valueFormat="[À partir du] D MMM YYYY"
            placeholder="Dès le début"
            clearable
            value={item.from}
            onChange={(date) => onChange({ from: date ? String(date) : null })}
          />
        </Group>
      )}

      {monthly && (
        <Group gap="xs" align="flex-end">
          {item.pattern === 'YEARLY' && (
            <Select
              size="xs"
              w={130}
              aria-label="Mois"
              data={MONTH_NAMES.map((name, month) => ({ value: String(month + 1), label: name }))}
              value={String(item.month)}
              allowDeselect={false}
              onChange={(value) => value && onChange({ month: Number(value) })}
            />
          )}
          <SegmentedControl
            size="xs"
            data={[
              { value: 'DAY', label: 'Le jour…' },
              { value: 'WEEKDAY', label: 'Le …e jour de semaine' },
            ]}
            value={item.monthlyMode}
            onChange={(value) => onChange({ monthlyMode: value as ScheduleCase['monthlyMode'] })}
          />
          {item.monthlyMode === 'DAY' ? (
            <NumberInput size="xs" w={90} min={1} max={31} prefix="le " value={item.monthDay} onChange={(value) => onChange({ monthDay: Math.min(31, Math.max(1, Number(value) || 1)) })} />
          ) : (
            <>
              <Select
                size="xs"
                w={100}
                aria-label="Rang"
                data={[
                  { value: '1', label: '1er' },
                  { value: '2', label: '2e' },
                  { value: '3', label: '3e' },
                  { value: '4', label: '4e' },
                  { value: '-1', label: 'dernier' },
                ]}
                value={String(item.position)}
                allowDeselect={false}
                onChange={(value) => value && onChange({ position: Number(value) as ScheduleCase['position'] })}
              />
              <Select
                size="xs"
                w={120}
                aria-label="Jour de la semaine"
                data={WEEKDAY_NAMES.map((name, day) => ({ value: String(day + 1), label: name.toLowerCase() }))}
                value={String(item.weekday)}
                allowDeselect={false}
                onChange={(value) => value && onChange({ weekday: Number(value) })}
              />
            </>
          )}
          <NumberInput
            size="xs"
            w={150}
            min={1}
            max={99}
            prefix={item.pattern === 'MONTHLY' ? 'Tous les ' : 'Tous les '}
            suffix={item.pattern === 'MONTHLY' ? ' mois' : ' ans'}
            value={item.every}
            onChange={(value) => onChange({ every: Math.max(1, Number(value) || 1) })}
          />
        </Group>
      )}

      <Group gap="xs">
        <DatePickerInput
          size="xs"
          w={170}
          aria-label={`Premier jour, cas ${index + 1}`}
          valueFormat="[Du] D MMM YYYY"
          placeholder="Dès le début"
          clearable
          maxDate={item.until ?? undefined}
          value={item.since}
          onChange={(date) => onChange({ since: date ? String(date) : null })}
        />
        <DatePickerInput
          size="xs"
          w={170}
          aria-label={`Dernier jour, cas ${index + 1}`}
          valueFormat="[Au] D MMM YYYY"
          placeholder="Jusqu’à la fin"
          clearable
          minDate={item.since ?? undefined}
          value={item.until}
          onChange={(date) => onChange({ until: date ? String(date) : null })}
        />
      </Group>

      <Group gap="xs" align="flex-start">
        <Checkbox
          size="xs"
          mt={6}
          label="Toute la journée"
          checked={item.allDay}
          onChange={(event) => onChange({ allDay: event.currentTarget.checked, ranges: event.currentTarget.checked ? [] : [{ start: '09:00', end: '17:00' }] })}
        />
        {!item.allDay && (
          <Stack gap={4}>
            {item.ranges.map((range, position) => (
              <Group key={position} gap={6} wrap="nowrap">
                <TimeField
                  size="xs"
                  aria-label={`Début, cas ${index + 1}`}
                  value={range.start}
                  onChange={(value) => onChange({ ranges: item.ranges.map((other, otherIndex) => (otherIndex === position ? { ...other, start: value } : other)) })}
                />
                <Text size="sm">à</Text>
                <TimeField
                  size="xs"
                  aria-label={`Fin, cas ${index + 1}`}
                  value={range.end}
                  onChange={(value) => onChange({ ranges: item.ranges.map((other, otherIndex) => (otherIndex === position ? { ...other, end: value } : other)) })}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="Retirer ces horaires"
                  onClick={() => onChange({ ranges: item.ranges.filter((_, otherIndex) => otherIndex !== position) })}
                >
                  <XIcon aria-hidden />
                </ActionIcon>
              </Group>
            ))}
            <div>
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<PlusIcon aria-hidden />}
                onClick={() => {
                  const last = item.ranges.at(-1);
                  onChange({ ranges: [...item.ranges, last ? { start: last.end < '13:00' ? '14:00' : last.end, end: last.end < '13:00' ? '18:00' : '23:59' } : { start: '09:00', end: '12:30' }] });
                }}
              >
                Ajouter des horaires
              </Button>
            </div>
          </Stack>
        )}
      </Group>
    </CaseCard>
  );
}

interface ScheduleCasesEditorProps {
  cases: ScheduleCase[];
  onChange: (cases: ScheduleCase[]) => void;
  /** Rhythms the period allows (see `periodRhythm`). */
  rhythm: 'DAY' | 'WEEK' | 'ANY';
  periodStart: string;
  /** Text when there is no case (an exception without cases is a pause). */
  emptyText?: string;
}

/**
 * Cases of a schedule or of an exception, edited the same way: each with its days (every day, weekdays every n
 * weeks, even or odd weeks, every n days, monthly, yearly, as the length of the period allows) and its hours.
 * @param {ScheduleCasesEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function ScheduleCasesEditor({ cases, onChange, rhythm, periodStart, emptyText }: ScheduleCasesEditorProps) {
  const folds = useCaseFolds();
  return (
    <Stack gap="xs">
      {cases.length === 0 && emptyText && (
        <Text size="xs" c="dimmed">
          {emptyText}
        </Text>
      )}
      {cases.map((item, index) => (
        <CaseEditor
          key={index}
          item={item}
          index={index}
          rhythm={rhythm}
          periodStart={periodStart}
          onChange={(changes) => onChange(cases.map((other, otherIndex) => (otherIndex === index ? { ...other, ...changes } : other)))}
          onRemove={() => {
            folds.removed(index);
            onChange(cases.filter((_, otherIndex) => otherIndex !== index));
          }}
          collapsible={cases.length > 1}
          opened={folds.isOpen(index)}
          onToggle={() => folds.toggle(index)}
        />
      ))}
      <div>
        <Button
          size="compact-xs"
          variant="default"
          leftSection={<PlusIcon aria-hidden />}
          onClick={() => {
            folds.open(cases.length);
            onChange([...cases, newCase(rhythm === 'DAY')]);
          }}
        >
          Ajouter un cas
        </Button>
      </div>
    </Stack>
  );
}
