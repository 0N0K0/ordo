import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Checkbox, Divider, Group, Stack, Text, TextInput, Switch } from '@mantine/core';
import { type ScheduleCase, type ScheduleException, type ScheduleTimes, DURATION_UNITS, lastsWeeksOrMonths, timeToMinutes, type Recurrence } from '@ordo/shared';
import { TimeSlotFields } from '../../../components/inputs/TimeSlotFields';

import { useState, type ReactNode } from 'react';
import { RepetitionEditor, type CaseStart, type RepetitionModeValue, type RepetitionTimes } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import * as fmt from '../../../lib/format';
import { parisToday } from '../../../lib/dates';
import { defaultScheduleTimes, describeScheduleCase, describeScheduleTimes, exceptionPeriod, newScheduleCase, scheduleCasesApplicable } from '../lib/schedule-text';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { ExceptionsList, type ExceptionEntry, type ExceptionsAdd } from '../../../components/recurrence/ExceptionsList';
import { casesDayAdding, casesSkippedEntries, skippedLines, SKIPPED_KIND, type ExceptionLine } from '../../../components/recurrence/exceptions';

/** Period, cases and exceptions of a schedule: everything about how it repeats. */
interface ScheduleRepetitionValue {
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
}

/** Error of hours saved on a case whose occurrences last weeks or months. */
const WHOLE_DAYS_ERROR = 'Une durée en semaines ou en mois dure des journées entières.';

/**
 * Hours of a case: the whole day, or time ranges (each `TimeSlotFields`, on its day). Each occurrence lasting weeks or
 * months is the whole day: « Journée entière » ticked, not changed (hours saved before can still be dropped by ticking it).
 * @param {{ value: ScheduleTimes, onChange: (value: ScheduleTimes) => void, index: number, rule: Recurrence | null }} props Hours, their change, case number, its rule.
 * @returns {JSX.Element} Fields.
 */
function ScheduleTimesFields({ value, onChange, index, rule }: { value: ScheduleTimes; onChange: (value: ScheduleTimes) => void; index: number; rule: Recurrence | null }) {
  const wholeDays = lastsWeeksOrMonths(rule?.duration);
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
        disabled={wholeDays && value.allDay}
        error={wholeDays && !value.allDay ? WHOLE_DAYS_ERROR : undefined}
        onChange={(event) => onChange({ allDay: event.currentTarget.checked, ranges: event.currentTarget.checked ? [] : [{ start: '09:00', end: '17:00' }] })}
      />
      {!value.allDay && (
        <Stack gap={4}>
          {value.ranges.map((range, position) => (
            <Group key={position} gap={6} wrap="nowrap" align="flex-end">
              <TimeSlotFields
                sameDay
                name={`cas ${index + 1}`}
                value={{ start: range.start, minutes: timeToMinutes(range.end) - timeToMinutes(range.start) }}
                onChange={(slot) => setRange(position, { start: slot.start, end: slot.end.time })}
              />
              <RemoveButton label="Retirer" aria-label="Retirer ces horaires" size="sm" onClick={() => onChange({ ...value, ranges: value.ranges.filter((_, other) => other !== position) })} />
            </Group>
          ))}
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
  render: (times, onChange, index, rule) => <ScheduleTimesFields value={times} onChange={onChange} index={index} rule={rule} />,
  describe: describeScheduleTimes,
  empty: defaultScheduleTimes,
  withDuration: (times, duration) => (lastsWeeksOrMonths(duration) ? { allDay: true, ranges: [] } : times),
};

/**
 * Cases of a period (the schedule's, an exception's, or the « Horaires » of a task): one rule, or several cases each
 * with its « Début », and their hours.
 * @param {{ cases: ScheduleCase[], onChange: (cases: ScheduleCase[]) => void, start: string, caseStart?: CaseStart<ScheduleTimes> }} props Cases, their change, first day of their period, the day their rhythm counts from asked of the cases that need one (`RepetitionEditor`). Optional `caseStart`.
 * @returns {JSX.Element} Editor.
 */
export function ScheduleCases({ cases, onChange, start, caseStart }: { cases: ScheduleCase[]; onChange: (cases: ScheduleCase[]) => void; start: string; caseStart?: CaseStart<ScheduleTimes> }) {
  const [mode, setMode] = useState<RepetitionModeValue>(cases.length > 1 || cases.some((item) => item.start && item.start > start && !caseStart?.needed(item)) ? 'CASES' : 'RULE');
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
      endFirst
      caseStart={caseStart}
    />
  );
}

/**
 * Kind of an exception period of a schedule in words: « autres horaires », or « rien » without cases of its own; its
 * reason after it.
 * @param {ScheduleException} exception Exception period.
 * @returns {string} Text.
 */
const periodExceptionText = (exception: ScheduleException) =>
  `${fmt.capitalize(exceptionPeriod(exception))} : ${exception.cases.length ? 'autres horaires' : SKIPPED_KIND}${exception.label ? ` (${exception.label})` : ''}`;

/**
 * Exceptions of a schedule in words: its exception periods, and the « rien » days of the rules of its cases and of
 * theirs.
 * @param {Pick<ScheduleRepetitionValue, 'cases' | 'exceptions'>} value Cases and exceptions.
 * @returns {ExceptionLine[]} Lines.
 */
const scheduleExceptionLines = (value: Pick<ScheduleRepetitionValue, 'cases' | 'exceptions'>): ExceptionLine[] => [
  ...value.exceptions.map((exception, index) => ({ key: `period-${index}`, day: exception.from, text: periodExceptionText(exception) })),
  ...skippedLines(value.cases.map((item) => item.rule)),
  ...value.exceptions.flatMap((exception, index) => skippedLines(exception.cases.map((item) => item.rule), `period-${index}`)),
];

/**
 * Adding a « rien » exception to the cases of a schedule without the days its exception periods cover: their own cases
 * hold there, a « rien » of the schedule's cases would change nothing.
 * @param {ExceptionsAdd} add Adding to the cases of the schedule.
 * @param {readonly ScheduleException[]} periods Its exception periods.
 * @returns {ExceptionsAdd} Adding.
 */
const withoutPeriods = (add: ExceptionsAdd, periods: readonly ScheduleException[]): ExceptionsAdd => ({
  ...add,
  isDay: (day) => add.isDay(day) && !periods.some((period) => period.from <= day && day <= period.to),
});

/**
 * Every repetition setting of a schedule, in the common modal: its cases (rule, length, hours), then its exceptions
 * (`ExceptionsList`, folded): the periods with cases of their own or without any (« rien »), and the « rien » days of
 * the rules, each restored.
 * @param {{ draft: ScheduleRepetitionValue, setDraft: (value: ScheduleRepetitionValue) => void }} props Draft and its change.
 * @returns {JSX.Element} Settings.
 */
function ScheduleRepetitionEditor({ draft, setDraft }: { draft: ScheduleRepetitionValue; setDraft: (value: ScheduleRepetitionValue) => void }) {
  const start = draft.startDate || parisToday();
  // The period whose start is being edited keeps its place in the list until the field is left.
  const [editing, setEditing] = useState<{ index: number; day: string } | null>(null);
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
  const entries: ExceptionEntry[] = [
    ...draft.exceptions.map((exception, index) => {
      const none = exception.cases.length === 0;
      return {
        key: `period-${index}`,
        day: editing?.index === index ? editing.day : exception.from,
        text: periodExceptionText(exception),
        onRestore: () => {
          setEditing(null);
          setDraft({ ...draft, exceptions: draft.exceptions.filter((_, position) => position !== index) });
        },
        body: (
          <>
            <Group gap={6} wrap="nowrap" align="flex-end">
              <PeriodField label="Période" size="xs" w={280} required value={[exception.from, exception.to]}
                onChange={([from, to]) => {
                  if (!from || !to) return;
                  if (editing?.index !== index) setEditing({ index, day: exception.from });
                  setException(index, { from, to });
                }}
                onBlur={[() => setEditing(null), () => setEditing(null)]}
              />
              <TextInput
                label="Motif"
                size="xs"
                placeholder="Congés, formation…"
                style={{ flex: 1 }}
                value={exception.label}
                onChange={(event) => setException(index, { label: event.currentTarget.value })}
              />
            </Group>
            <Checkbox
              size="xs"
              label="Rien (aucun créneau pendant cette période)"
              checked={none}
              onChange={(event) => setException(index, { cases: event.currentTarget.checked ? [] : [newScheduleCase(exception.from)] })}
            />
            {!none && <ScheduleCases cases={exception.cases} start={exception.from} onChange={(cases) => setException(index, { cases })} />}
          </>
        ),
      };
    }),
    ...casesSkippedEntries(draft.cases, (cases) => setDraft({ ...draft, cases })),
    ...draft.exceptions.flatMap((exception, index) => casesSkippedEntries(exception.cases, (cases) => setException(index, { cases }), `period-${index}`)),
  ];
  return (
    <Stack gap="md">
      <ScheduleCases cases={draft.cases} onChange={(cases) => setDraft({ ...draft, cases })} start={start} />
      <Divider label="Exceptions (congés, horaires particuliers…)" labelPosition="left" />
      <Text size="xs" c="dimmed">
        Pendant une période d’exception, ses propres cas remplacent ceux du créneau ; sans cas, il n’y a rien.
      </Text>
      <ExceptionsList
        entries={entries}
        add={withoutPeriods(casesDayAdding(draft.cases, start, (cases) => setDraft({ ...draft, cases })), draft.exceptions)}
        footer={
          <AddItemButton onClick={() => setDraft({ ...draft, exceptions: [...draft.exceptions, { from: parisToday(), to: parisToday(), label: 'Congés', cases: [] }] })}>
            Ajouter une exception
          </AddItemButton>
        }
      />
    </Stack>
  );
}

/**
 * Period, cases and exceptions of a schedule in its form: the period right in the form, the summary of its cases and,
 * apart, of its exceptions (`ExceptionsSummary`); cases and exceptions changed in the common repetition modal.
 * @param {{ value: ScheduleRepetitionValue, onChange: (value: ScheduleRepetitionValue) => void, periodError?: ReactNode, error?: ReactNode }} props Value, its change, error of the period, error of the cases and exceptions. Optional errors.
 * @returns {JSX.Element} Fields.
 */
export function ScheduleRepetition({ value, onChange, periodError, error }: { value: ScheduleRepetitionValue; onChange: (value: ScheduleRepetitionValue) => void; periodError?: ReactNode; error?: ReactNode }) {
  return (
    <Stack gap="sm">
      <PeriodField
        label="Période"
        required="start"
        placeholder="À choisir"
        error={periodError}
        value={[value.startDate || null, value.endDate]}
        onChange={([startDate, endDate]) => startDate && onChange({ ...value, startDate, endDate })}
      />
      <RepetitionField<ScheduleRepetitionValue>
        label="Horaires"
        required
        error={error}
        value={value}
        onChange={onChange}
        valid={(draft) => draft.cases.length > 0 && scheduleCasesApplicable([...draft.cases, ...draft.exceptions.flatMap((exception) => exception.cases)])}
        describe={(item) => item.cases.map((other) => describeScheduleCase(other, item.startDate || parisToday()))}
        exceptions={scheduleExceptionLines}
        editor={(draft, setDraft) => <ScheduleRepetitionEditor draft={draft} setDraft={setDraft} />}
      />
    </Stack>
  );
}
