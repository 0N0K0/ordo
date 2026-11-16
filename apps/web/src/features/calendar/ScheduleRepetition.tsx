import { ActionIcon, Button, Checkbox, Divider, Group, Paper, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { type DurationUnit, type ScheduleCase, type ScheduleException, type ScheduleTimes } from '@ordo/shared';
import { PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { TimeField } from '../../components/TimeField';
import { RepetitionEditor, type RepetitionModeValue, type RepetitionTimes } from '../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../components/recurrence/RepetitionField';
import * as fmt from '../../lib/format';
import { localToday } from '../../lib/dates';
import { defaultScheduleTimes, describeScheduleCase, describeScheduleTimes, exceptionPeriod, newScheduleCase } from './schedule-text';

/** Period, cases and exceptions of a schedule: everything about how it repeats. */
export interface ScheduleRepetitionValue {
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
}

/** Every length an occurrence of a slot can have: days, weeks, months, up to a day, a week or a month of the year. */
const SCHEDULE_DURATIONS: readonly DurationUnit[] = ['DAYS', 'WEEKS', 'MONTHS', 'TO_DAY', 'TO_WEEK', 'TO_MONTH'];

/**
 * Hours of a case: the whole day, or time ranges.
 * @param {{ value: ScheduleTimes, onChange: (value: ScheduleTimes) => void, index: number }} props Hours, their change, case number.
 * @returns {JSX.Element} Fields.
 */
function ScheduleTimesFields({ value, onChange, index }: { value: ScheduleTimes; onChange: (value: ScheduleTimes) => void; index: number }) {
  /**
   * Changes a range.
   * @param {number} position Range.
   * @param {Partial<{ start: string, end: string }>} changes Changes.
   * @returns {void}
   */
  const setRange = (position: number, changes: Partial<{ start: string; end: string }>) =>
    onChange({ ...value, ranges: value.ranges.map((range, other) => (other === position ? { ...range, ...changes } : range)) });
  return (
    <Group gap="xs" align="flex-start">
      <Checkbox
        size="xs"
        mt={6}
        label="Toute la journée"
        checked={value.allDay}
        onChange={(event) => onChange({ allDay: event.currentTarget.checked, ranges: event.currentTarget.checked ? [] : [{ start: '09:00', end: '17:00' }] })}
      />
      {!value.allDay && (
        <Stack gap={4}>
          {value.ranges.map((range, position) => (
            <Group key={position} gap={6} wrap="nowrap">
              <TimeField size="xs" aria-label={`Début, cas ${index + 1}`} value={range.start} onChange={(start) => setRange(position, { start })} />
              <Text size="sm">à</Text>
              <TimeField size="xs" aria-label={`Fin, cas ${index + 1}`} value={range.end} onChange={(end) => setRange(position, { end })} />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Retirer ces horaires"
                onClick={() => onChange({ ...value, ranges: value.ranges.filter((_, other) => other !== position) })}
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
                const last = value.ranges.at(-1);
                onChange({
                  ...value,
                  ranges: [...value.ranges, last ? { start: last.end < '13:00' ? '14:00' : last.end, end: last.end < '13:00' ? '18:00' : '23:59' } : { start: '09:00', end: '12:30' }],
                });
              }}
            >
              Ajouter des horaires
            </Button>
          </div>
        </Stack>
      )}
    </Group>
  );
}

/** Hours of the cases of a schedule, for the common repetition editor. */
const SCHEDULE_TIMES: RepetitionTimes<ScheduleTimes> = {
  render: (times, onChange, index) => <ScheduleTimesFields value={times} onChange={onChange} index={index} />,
  describe: describeScheduleTimes,
  empty: defaultScheduleTimes,
};

/**
 * Cases of a period (the schedule's, or an exception's): one rule, or several cases each with its period.
 * @param {{ cases: ScheduleCase[], onChange: (cases: ScheduleCase[]) => void, start: string }} props Cases, their change, first day of their period.
 * @returns {JSX.Element} Editor.
 */
function ScheduleCases({ cases, onChange, start }: { cases: ScheduleCase[]; onChange: (cases: ScheduleCase[]) => void; start: string }) {
  const [mode, setMode] = useState<RepetitionModeValue>(cases.length > 1 || cases.some((item) => item.since || item.until) ? 'CASES' : 'RULE');
  return (
    <RepetitionEditor<ScheduleTimes>
      mode={mode}
      onModeChange={setMode}
      cases={cases.length ? cases : [newScheduleCase(start)]}
      onChange={onChange}
      start={start}
      multiple
      allowNone={false}
      durations={SCHEDULE_DURATIONS}
      times={SCHEDULE_TIMES}
    />
  );
}

/**
 * Every repetition setting of a schedule: its period, its cases (rule, length, hours) and its exceptions (a period
 * with its own cases, or a pause), in the common modal.
 * @param {{ draft: ScheduleRepetitionValue, setDraft: (value: ScheduleRepetitionValue) => void }} props Draft and its change.
 * @returns {JSX.Element} Settings.
 */
function ScheduleRepetitionEditor({ draft, setDraft }: { draft: ScheduleRepetitionValue; setDraft: (value: ScheduleRepetitionValue) => void }) {
  const start = draft.startDate || localToday();
  /**
   * Changes an exception, its end kept after its start.
   * @param {number} index Exception.
   * @param {Partial<ScheduleException>} changes Changes.
   * @returns {void}
   */
  const setException = (index: number, changes: Partial<ScheduleException>) =>
    setDraft({
      ...draft,
      exceptions: draft.exceptions.map((other, position) => {
        if (position !== index) return other;
        const next = { ...other, ...changes };
        return next.to < next.from ? { ...next, to: next.from } : next;
      }),
    });
  return (
    <Stack gap="md">
      <Group grow align="flex-start">
        <DatePickerInput label="À partir du" required placeholder="À choisir" value={draft.startDate || null} onChange={(date) => date && setDraft({ ...draft, startDate: String(date) })} />
        <DatePickerInput
          label="Jusqu’au"
          clearable
          placeholder="Sans fin"
          minDate={draft.startDate || undefined}
          value={draft.endDate}
          onChange={(date) => setDraft({ ...draft, endDate: date ? String(date) : null })}
        />
      </Group>
      <Divider label="Cas" labelPosition="left" />
      <ScheduleCases cases={draft.cases} onChange={(cases) => setDraft({ ...draft, cases })} start={start} />
      <Divider label="Exceptions (congés, horaires particuliers…)" labelPosition="left" />
      <Text size="xs" c="dimmed">
        Pendant une exception, ses propres cas remplacent ceux de la plage ; sans cas, c’est une pause.
      </Text>
      {draft.exceptions.map((exception, index) => {
        const pause = exception.cases.length === 0;
        return (
          <Paper key={index} withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
            <Stack gap="xs">
              <Group gap={6} wrap="nowrap" align="flex-end">
                <DatePickerInput label="Du" size="xs" w={140} value={exception.from} onChange={(date) => date && setException(index, { from: String(date) })} />
                <DatePickerInput label="Au" size="xs" w={140} minDate={exception.from} value={exception.to} onChange={(date) => date && setException(index, { to: String(date) })} />
                <TextInput
                  label="Motif"
                  size="xs"
                  placeholder="Congés, formation…"
                  style={{ flex: 1 }}
                  value={exception.label}
                  onChange={(event) => setException(index, { label: event.currentTarget.value })}
                />
                <Tooltip label="Retirer l’exception">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    mb={4}
                    aria-label={`Retirer l’exception ${index + 1}`}
                    onClick={() => setDraft({ ...draft, exceptions: draft.exceptions.filter((_, position) => position !== index) })}
                  >
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Checkbox
                size="xs"
                label="Pause (aucune plage pendant cette période)"
                checked={pause}
                onChange={(event) => setException(index, { cases: event.currentTarget.checked ? [] : [newScheduleCase(exception.from)] })}
              />
              {!pause && <ScheduleCases cases={exception.cases} start={exception.from} onChange={(cases) => setException(index, { cases })} />}
            </Stack>
          </Paper>
        );
      })}
      <div>
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<PlusIcon aria-hidden />}
          onClick={() => setDraft({ ...draft, exceptions: [...draft.exceptions, { from: localToday(), to: localToday(), label: 'Congés', cases: [] }] })}
        >
          Ajouter une exception
        </Button>
      </div>
    </Stack>
  );
}

/**
 * Period, cases and exceptions of a schedule in its form: their summary, and every setting in the common repetition
 * modal.
 * @param {{ value: ScheduleRepetitionValue, onChange: (value: ScheduleRepetitionValue) => void, error?: ReactNode }} props Value, its change, error.
 * @returns {JSX.Element} Field.
 */
export function ScheduleRepetition({ value, onChange, error }: { value: ScheduleRepetitionValue; onChange: (value: ScheduleRepetitionValue) => void; error?: ReactNode }) {
  return (
    <RepetitionField<ScheduleRepetitionValue>
      label="Période et horaires"
      required
      error={error}
      value={value}
      onChange={onChange}
      valid={(draft) => Boolean(draft.startDate) && draft.cases.length > 0}
      describe={(item) => {
        const start = item.startDate || localToday();
        return [
          item.startDate ? `${item.endDate ? `Du ${fmt.day(item.startDate)} au ${fmt.day(item.endDate)}` : `À partir du ${fmt.day(item.startDate)}`}` : 'Dates à choisir',
          ...item.cases.map((other) => describeScheduleCase(other, start)),
          ...item.exceptions.map((exception) => `${fmt.capitalize(exceptionPeriod(exception))} : ${exception.label || 'exception'}${exception.cases.length ? '' : ' (pause)'}`),
        ];
      }}
      editor={(draft, setDraft) => <ScheduleRepetitionEditor draft={draft} setDraft={setDraft} />}
    />
  );
}
