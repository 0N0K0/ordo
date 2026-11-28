import { AddItemButton } from '../actions/AddItemButton';
import { Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { DEFAULT_RECURRENCE, ONE_DAY, withRuleValues, type Duration, type DurationUnit, type RepetitionLimits, type Recurrence, type RepetitionCase } from '@ordo/shared';

import { useState, type ReactNode } from 'react';
import { CaseCard } from './CaseCard';
import { describeCase } from './describe-recurrence';
import { DurationFields } from './DurationFields';
import { RecurrenceEditor } from './RecurrenceEditor';
import { useCaseFolds, useCaseKeys } from './use-case-folds';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableArea } from '../dnd/sortable';
import { DateField } from '../inputs/DateField';

/** Times of the occurrences of what repeats (an event's hours, a schedule's slots, a routine's moments, an alarm's time). */
export interface RepetitionTimes<T> {
  /**
   * Editor of the times of a case (its rule given: settings that depend on it); `onCommit` (the editor's) to call once a
   * value is chosen or an hour, a number is left, for a panel saved field by field.
   */
  render: (times: T, onChange: (times: T) => void, index: number, rule: Recurrence | null, onCommit?: () => void) => ReactNode;
  /** Times as text, for the summary (empty: none told); its rule given. */
  describe: (times: T, rule: Recurrence | null) => string;
  /** Times of a new case. */
  empty: () => T;
  /** Times once the duration of each occurrence changed (the whole day when it lasts weeks or months). Optional. */
  withDuration?: (times: T, duration: Duration) => T;
  /** Limits the times give the rule (an « Ouverture » before the due day). Optional. */
  limits?: (times: T) => RepetitionLimits | null;
}

/** Another way to repeat than a rule or cases (a routine following calendar schedules). */
interface RepetitionMode {
  value: string;
  label: string;
  /** Its settings. */
  render: () => ReactNode;
}

/** Ways of repeating: a single rule, cases (each with its period), or another one. */
export type RepetitionModeValue = 'RULE' | 'CASES' | (string & {});

interface RepetitionEditorProps<T> {
  /** Mode: one rule, cases, or another. */
  mode: RepetitionModeValue;
  onModeChange: (mode: RepetitionModeValue) => void;
  /** Cases; one in RULE mode. */
  cases: RepetitionCase<T>[];
  onChange: (cases: RepetitionCase<T>[]) => void;
  /** First day of what repeats (rhythms count from it). */
  start: string;
  /** Cases offered (routines, schedules). Optional. Default = false. */
  multiple?: boolean;
  /** Weekdays and even / odd weeks offered. Optional. Default = true. */
  weekly?: boolean;
  /** « Ne se répète pas » offered (one rule only). Optional. Default = true. */
  allowNone?: boolean;
  /** Ways an occurrence can last more than a day. Optional. Default = none. */
  durations?: readonly DurationUnit[];
  /** Times of the occurrences. Optional. Default = none. */
  times?: RepetitionTimes<T>;
  /** Other modes. Optional. */
  modes?: readonly RepetitionMode[];
  /** Settings shown under every mode (slots excluded…). Optional. */
  footer?: ReactNode;
  /**
   * « Début » required of each case that needs one (its rhythm counts from it, its `start`), one rule too: `needed`
   * tells which cases, `message` is the error while it is missing. Optional. Default = none (asked of cases only, and
   * optional: without it, rhythms count from `start`).
   */
  caseStart?: CaseStart<T>;
  /**
   * Called once a value is chosen (a frequency, a weekday, a case added…) or a number is left: a panel saved field by
   * field saves the repetition then, not on each key typed. Optional.
   */
  onCommit?: () => void;
  /**
   * Fields in the order of what repeats with hours (slots, éphémérides, hours of a task): « Début » and « Fin » on one
   * line, then the duration, the hours, and the rule last. Optional. Default = false (the rule, its « Fin », the
   * duration, the hours).
   */
  endFirst?: boolean;
}

/** « Début » of a case (the day its rhythm counts from), required of the cases that need one. */
export interface CaseStart<T> {
  needed: (item: RepetitionCase<T>) => boolean;
  message: string;
}

/**
 * Case settings: its « Début » (cases only, or when required), its rule with its « Fin », how long each occurrence
 * lasts and its times.
 * @param {object} props Component props.
 * @returns {JSX.Element} Settings.
 */
function CaseFields<T>({
  item,
  onChange,
  start,
  index,
  withStart,
  props,
}: {
  item: RepetitionCase<T>;
  onChange: (changes: Partial<RepetitionCase<T>>) => void;
  start: string;
  index: number;
  withStart: boolean;
  props: RepetitionEditorProps<T>;
}) {
  const required = props.caseStart?.needed(item) ?? false;
  // Its error once the field is left (validated on blur, then on every change).
  const [startLeft, setStartLeft] = useState(false);
  // Its rhythm counts from its « Début », else from the first day of what repeats.
  const ruleStart = item.start ?? start;
  const startField = (withStart || required) && (
    <DateField
      size="xs"
      w={190}
      label="Début"
      required={required}
      placeholder={required ? 'À choisir' : 'Dès le début'}
      clearable={!required}
      // A technical « Début » before the first day (the oldest cases of a schedule or a routine) shows as none: its
      // rhythm stays as it is. Not where a « Début » may be asked (the hours of a task: `start` is today there).
      value={!props.caseStart && item.start && item.start < start ? null : item.start}
      onChange={(day) => {
        onChange({ start: day });
        props.onCommit?.();
      }}
      onBlur={() => setStartLeft(true)}
      onDropdownClose={() => setStartLeft(true)}
      error={required && startLeft && !item.start ? props.caseStart?.message : undefined}
    />
  );
  const duration = item.rule?.duration ?? ONE_DAY;
  /**
   * The rule of the case, or one part of it (`RecurrenceEditor`).
   * @param {'all' | 'rule' | 'end'} part Part.
   * @returns {JSX.Element} Editor.
   */
  const rule = (part: 'all' | 'rule' | 'end') => (
    <RecurrenceEditor
      value={item.rule}
      onChange={(next) => onChange({ rule: next })}
      start={ruleStart}
      weekly={props.weekly}
      allowNone={!withStart && props.allowNone !== false}
      onCommit={props.onCommit}
      duration={duration}
      limits={props.times?.limits?.(item.times) ?? null}
      part={part}
    />
  );
  const durationFields = props.durations && props.durations.length > 0 && item.rule && (
    <DurationFields
      value={duration}
      onChange={(next) => item.rule && onChange({ rule: { ...item.rule, duration: next }, times: props.times?.withDuration ? props.times.withDuration(item.times, next) : item.times })}
      units={props.durations}
      onCommit={props.onCommit}
    />
  );
  const timesFields = props.times?.render(item.times, (times) => onChange({ times }), index, item.rule, props.onCommit);
  if (props.endFirst)
    return (
      <Stack gap="sm">
        <Group gap="sm" align="flex-start" wrap="wrap">
          {startField}
          {rule('end')}
        </Group>
        {durationFields}
        {timesFields}
        {rule('rule')}
      </Stack>
    );
  return (
    <Stack gap="sm">
      {startField}
      {rule('all')}
      {durationFields}
      {timesFields}
    </Stack>
  );
}

/**
 * Every setting of a repetition: its mode (one rule, cases, or another), then the rule, the length of each occurrence
 * and the times of each case (and the « Début » of each one with cases), as what repeats allows. Each change is given at
 * once (`onChange`); `onCommit` follows a choice at once (a case added, removed or moved too), and a number once it is
 * left.
 * @template T
 * @param {RepetitionEditorProps<T>} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RepetitionEditor<T>(props: RepetitionEditorProps<T>) {
  const { mode, onModeChange, cases, onChange: give, start, multiple = false, modes = [], times, footer, onCommit } = props;
  /**
   * Gives cases changed by a choice, then commits them.
   * @param {RepetitionCase<T>[]} next Cases.
   * @returns {void}
   */
  const onChange = (next: RepetitionCase<T>[]) => {
    give(next);
    onCommit?.();
  };
  const folds = useCaseFolds();
  const keys = useCaseKeys(cases.length);
  /**
   * Moves a dropped case where it was dropped (its fold with it).
   * @param {string} _id Key of the case.
   * @param {number} from Its index.
   * @param {number} to Index it was dropped on.
   * @returns {void}
   */
  const handleMove = (_id: string, from: number, to: number) => {
    keys.moved(from, to);
    folds.moved(from, to);
    onChange(arrayMove(cases, from, to));
  };
  /**
   * Changes a case.
   * @param {number} index Its index.
   * @param {Partial<RepetitionCase<T>>} changes Changes.
   * @returns {void}
   */
  const update = (index: number, changes: Partial<RepetitionCase<T>>) => give(cases.map((item, other) => (other === index ? { ...item, ...changes } : item)));
  /**
   * New case, every week from the first day.
   * @returns {RepetitionCase<T>} Case.
   */
  const newCase = (): RepetitionCase<T> => ({ start: null, rule: withRuleValues(DEFAULT_RECURRENCE, start), times: (times?.empty() ?? null) as T });
  const offered = [
    ...(multiple || modes.length ? [{ value: 'RULE', label: 'Une règle' }] : []),
    ...(multiple ? [{ value: 'CASES', label: 'Plusieurs cas' }] : []),
    ...modes.map(({ value, label }) => ({ value, label })),
  ];
  const custom = modes.find((item) => item.value === mode);
  return (
    <Stack gap="md">
      {offered.length > 1 && (
        <SegmentedControl
          aria-label="Répétition"
          value={mode}
          onChange={(value) => {
            // Cases keep the rule as their first one; back to one rule keeps the first case.
            if (value === 'CASES' && !cases.length) give([newCase()]);
            // A « Début » required stays.
            if (value === 'RULE') give(cases.length ? [{ ...cases[0], start: props.caseStart?.needed(cases[0]) ? cases[0].start : null }] : [newCase()]);
            onModeChange(value);
            onCommit?.();
          }}
          data={offered}
        />
      )}
      {custom?.render()}
      {mode === 'RULE' && cases[0] && <CaseFields item={cases[0]} onChange={(changes) => update(0, changes)} start={start} index={0} withStart={false} props={props} />}
      {mode === 'CASES' && (
        <Stack gap="xs">
          <SortableArea ids={keys.list} layout="list" onMove={handleMove}>
            {cases.map((item, index) => (
              <CaseCard
                key={keys.list[index]}
                sortId={keys.list[index]}
                sortable={cases.length > 1}
                index={index + 1}
                summary={describeCase(item, start, { weekly: props.weekly, times })}
                collapsible={cases.length > 1}
                opened={folds.isOpen(index)}
                onToggle={() => folds.toggle(index)}
                onRemove={
                  cases.length > 1
                    ? () => {
                        folds.removed(index);
                        keys.removed(index);
                        onChange(cases.filter((_, other) => other !== index));
                      }
                    : undefined
                }
              >
                <CaseFields item={item} onChange={(changes) => update(index, changes)} start={start} index={index} withStart props={props} />
              </CaseCard>
            ))}
          </SortableArea>
          <Text size="xs" c="dimmed">
            Chaque cas a son début, ses jours, sa fin et ses horaires ; un jour pris par plusieurs cas suit le premier (glissez-les pour les réordonner).
          </Text>
          <AddItemButton
            onClick={() => {
              folds.open(cases.length);
              onChange([...cases, newCase()]);
            }}
          >
            Ajouter un cas
          </AddItemButton>
        </Stack>
      )}
      {footer}
    </Stack>
  );
}

interface RuleEditorProps extends Pick<RepetitionEditorProps<null>, 'start' | 'weekly' | 'allowNone' | 'durations' | 'footer' | 'onCommit'> {
  /** Rule; null: it does not repeat. */
  rule: Recurrence | null;
  onChange: (rule: Recurrence | null) => void;
}

/**
 * Editor of one rule of repetition (an alarm, an event, a field): the repetition editor without its cases.
 * @param {RuleEditorProps} props Component props (and those of the repetition editor).
 * @returns {JSX.Element} Editor.
 */
export function RuleEditor({ rule, onChange, ...props }: RuleEditorProps) {
  return (
    <RepetitionEditor<null>
      {...props}
      mode="RULE"
      onModeChange={() => undefined}
      cases={[{ start: null, rule, times: null }]}
      onChange={(cases) => onChange(cases[0]?.rule ?? null)}
    />
  );
}
