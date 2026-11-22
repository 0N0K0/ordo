import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Checkbox, Divider, Group, Paper, Stack, Text, TextInput, Switch } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { type ScheduleCase, type ScheduleException, type ScheduleTimes, DURATION_UNITS } from '@ordo/shared';

import { useState, type ReactNode } from 'react';
import { RepetitionEditor, type CaseStart, type RepetitionModeValue, type RepetitionTimes } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import * as fmt from '../../../lib/format';
import { localToday } from '../../../lib/dates';
import { defaultScheduleTimes, describeScheduleCase, describeScheduleTimes, exceptionPeriod, newScheduleCase } from '../lib/schedule-text';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { rangeProps } from '../../../components/inputs/date-range';
import { PeriodField } from '../../../components/inputs/PeriodField';

/** Period, cases and exceptions of a schedule: everything about how it repeats. */
interface ScheduleRepetitionValue {
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
}

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
      <Switch
        size="xs"
        mt={6}
        label="Journée entière"
        checked={value.allDay}
        onChange={(event) => onChange({ allDay: event.currentTarget.checked, ranges: event.currentTarget.checked ? [] : [{ start: '09:00', end: '17:00' }] })}
      />
      {!value.allDay && (
        <Stack gap={4}>
          {value.ranges.map((range, position) => {
            const hours = rangeProps({ value: [range.start, range.end], onChange: ([start, end]) => setRange(position, { start, end }) }, true);
            return (
              <Group key={position} gap={6} wrap="nowrap">
                <TimePicker size="xs" aria-label={`Début, cas ${index + 1}`} {...hours.start} />
                <Text size="sm">à</Text>
                <TimePicker size="xs" aria-label={`Fin, cas ${index + 1}`} {...hours.end} />
                <RemoveButton label="Retirer" aria-label="Retirer ces horaires" size="sm" onClick={() => onChange({ ...value, ranges: value.ranges.filter((_, other) => other !== position) })} />
              </Group>
            );
          })}
          <AddItemButton
            onClick={() => {
              const last = value.ranges.at(-1);
              onChange({
                ...value,
                ranges: [...value.ranges, last ? { start: last.end < '13:00' ? '14:00' : last.end, end: last.end < '13:00' ? '18:00' : '23:59' } : { start: '09:00', end: '12:30' }],
              });
            }}
          >
            Ajouter des horaires
          </AddItemButton>
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
 * Cases of a period (the schedule's, an exception's, or the « Horaires » of a task): one rule, or several cases each
 * with its period, and their hours.
 * @param {{ cases: ScheduleCase[], onChange: (cases: ScheduleCase[]) => void, start: string, caseStart?: CaseStart<ScheduleTimes> }} props Cases, their change, first day of their period, the day their rhythm counts from asked of the cases that need one (`RepetitionEditor`). Optional `caseStart`.
 * @returns {JSX.Element} Editor.
 */
export function ScheduleCases({ cases, onChange, start, caseStart }: { cases: ScheduleCase[]; onChange: (cases: ScheduleCase[]) => void; start: string; caseStart?: CaseStart<ScheduleTimes> }) {
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
      durations={DURATION_UNITS}
      times={SCHEDULE_TIMES}
      caseStart={caseStart}
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
   * Changes an exception.
   * @param {number} index Exception.
   * @param {Partial<ScheduleException>} changes Changes.
   * @returns {void}
   */
  const setException = (index: number, changes: Partial<ScheduleException>) =>
    setDraft({
      ...draft,
      exceptions: draft.exceptions.map((other, position) => (position === index ? { ...other, ...changes } : other)),
    });
  return (
    <Stack gap="md">
      <PeriodField
        label="Période"
        required="start"
        placeholder="À choisir"
        value={[draft.startDate || null, draft.endDate]}
        onChange={([startDate, endDate]) => startDate && setDraft({ ...draft, startDate, endDate })}
      />
      <Divider label="Cas" labelPosition="left" />
      <ScheduleCases cases={draft.cases} onChange={(cases) => setDraft({ ...draft, cases })} start={start} />
      <Divider label="Exceptions (congés, horaires particuliers…)" labelPosition="left" />
      <Text size="xs" c="dimmed">
        Pendant une exception, ses propres cas remplacent ceux du créneau ; sans cas, c’est une pause.
      </Text>
      {draft.exceptions.map((exception, index) => {
        const pause = exception.cases.length === 0;
        return (
          <Paper key={index} withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
            <Stack gap="xs">
              <Group gap={6} wrap="nowrap" align="flex-end">
                <PeriodField label="Période" size="xs" w={280} required value={[exception.from, exception.to]} onChange={([from, to]) => from && to && setException(index, { from, to })} />
                <TextInput
                  label="Motif"
                  size="xs"
                  placeholder="Congés, formation…"
                  style={{ flex: 1 }}
                  value={exception.label}
                  onChange={(event) => setException(index, { label: event.currentTarget.value })}
                />
                <RemoveButton
                  label="Retirer"
                  mb={4}
                  aria-label={`Retirer l’exception ${index + 1}`}
                  onClick={() => setDraft({ ...draft, exceptions: draft.exceptions.filter((_, position) => position !== index) })}
                />
              </Group>
              <Checkbox
                size="xs"
                label="Pause (aucun créneau pendant cette période)"
                checked={pause}
                onChange={(event) => setException(index, { cases: event.currentTarget.checked ? [] : [newScheduleCase(exception.from)] })}
              />
              {!pause && <ScheduleCases cases={exception.cases} start={exception.from} onChange={(cases) => setException(index, { cases })} />}
            </Stack>
          </Paper>
        );
      })}
      <AddItemButton onClick={() => setDraft({ ...draft, exceptions: [...draft.exceptions, { from: localToday(), to: localToday(), label: 'Congés', cases: [] }] })}>
        Ajouter une exception
      </AddItemButton>
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
