import { Button, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_RECURRENCE, ONE_DAY, withRuleValues, type DurationUnit, type Recurrence, type RepetitionCase } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { CaseCard } from './CaseCard';
import { describeCase } from './describe-recurrence';
import { DurationFields } from './DurationFields';
import { RecurrenceEditor } from './RecurrenceEditor';
import { useCaseFolds, useCaseKeys } from './use-case-folds';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/** Times of the occurrences of what repeats (an event's hours, a schedule's slots, a routine's moments, an alarm's time). */
export interface RepetitionTimes<T> {
  /** Editor of the times of a case (its rule given: settings that depend on it). */
  render: (times: T, onChange: (times: T) => void, index: number, rule: Recurrence | null) => ReactNode;
  /** Times as text, for the summary (empty: none told); its rule given. */
  describe: (times: T, rule: Recurrence | null) => string;
  /** Times of a new case. */
  empty: () => T;
}

/** Another way to repeat than a rule or cases (a routine following calendar schedules). */
export interface RepetitionMode {
  value: string;
  label: string;
  /** Its settings. */
  render: () => ReactNode;
}

/** Ways of repeating: a single rule, cases (each with its period), or another one. */
export type RepetitionModeValue = 'RULE' | 'CASES' | (string & {});

export interface RepetitionEditorProps<T> {
  /** Mode: one rule, cases, or another. */
  mode: RepetitionModeValue;
  onModeChange: (mode: RepetitionModeValue) => void;
  /** Cases; one in RULE mode. */
  cases: RepetitionCase<T>[];
  onChange: (cases: RepetitionCase<T>[]) => void;
  /** First day of what repeats (rhythms count from it). */
  start: string;
  /** Cases offered (tasks, routines, schedules). Optional. Default = false. */
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
  /** Exceptions of what repeats (occurrences moved or changed), listed under the rule. Optional. */
  exceptions?: ReactNode;
  /** Settings shown under every mode (slots excluded…). Optional. */
  footer?: ReactNode;
}

/**
 * Case settings: its period (cases only), its rule, how long each occurrence lasts and its times.
 * @param {object} props Component props.
 * @returns {JSX.Element} Settings.
 */
function CaseFields<T>({
  item,
  onChange,
  start,
  index,
  withPeriod,
  props,
}: {
  item: RepetitionCase<T>;
  onChange: (changes: Partial<RepetitionCase<T>>) => void;
  start: string;
  index: number;
  withPeriod: boolean;
  props: RepetitionEditorProps<T>;
}) {
  const ruleStart = item.since && item.since > start ? item.since : start;
  return (
    <Stack gap="sm">
      {withPeriod && (
        <Group gap="xs">
          <DatePickerInput
            size="xs"
            w={190}
            label="Du"
            placeholder="Dès le début"
            clearable
            maxDate={item.until ?? undefined}
            value={item.since}
            // Its rhythm counts from its first day.
            onChange={(date) => onChange({ since: date ? String(date) : null, anchor: null })}
          />
          <DatePickerInput
            size="xs"
            w={190}
            label="Au"
            placeholder="Jusqu’à la fin"
            clearable
            minDate={item.since ?? undefined}
            value={item.until}
            onChange={(date) => onChange({ until: date ? String(date) : null })}
          />
        </Group>
      )}
      <RecurrenceEditor
        value={item.rule}
        onChange={(rule) => onChange({ rule })}
        start={ruleStart}
        weekly={props.weekly}
        allowNone={!withPeriod && props.allowNone !== false}
        exceptions={withPeriod ? undefined : props.exceptions}
      />
      {props.durations && props.durations.length > 0 && item.rule && (
        <DurationFields value={item.rule.duration ?? ONE_DAY} onChange={(duration) => item.rule && onChange({ rule: { ...item.rule, duration } })} units={props.durations} />
      )}
      {props.times?.render(item.times, (times) => onChange({ times }), index, item.rule)}
    </Stack>
  );
}

/**
 * Every setting of a repetition: its mode (one rule, cases, or another), then the rule, the length of each occurrence
 * and the times of each case (and the period of each one with cases), as what repeats allows.
 * @template T
 * @param {RepetitionEditorProps<T>} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function RepetitionEditor<T>(props: RepetitionEditorProps<T>) {
  const { mode, onModeChange, cases, onChange, start, multiple = false, modes = [], times, footer } = props;
  const folds = useCaseFolds();
  const keys = useCaseKeys(cases.length);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  /**
   * Moves a dropped case where it was dropped (its fold with it).
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const from = keys.list.indexOf(String(active.id));
    const to = over ? keys.list.indexOf(String(over.id)) : -1;
    if (from < 0 || to < 0 || from === to) return;
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
  const update = (index: number, changes: Partial<RepetitionCase<T>>) => onChange(cases.map((item, other) => (other === index ? { ...item, ...changes } : item)));
  /**
   * New case, every week from the first day.
   * @returns {RepetitionCase<T>} Case.
   */
  const newCase = (): RepetitionCase<T> => ({ since: null, until: null, anchor: null, rule: withRuleValues(DEFAULT_RECURRENCE, start), times: (times?.empty() ?? null) as T });
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
            if (value === 'CASES' && !cases.length) onChange([newCase()]);
            if (value === 'RULE') onChange(cases.length ? [{ ...cases[0], since: null, until: null }] : [newCase()]);
            onModeChange(value);
          }}
          data={offered}
        />
      )}
      {custom?.render()}
      {mode === 'RULE' && cases[0] && <CaseFields item={cases[0]} onChange={(changes) => update(0, changes)} start={start} index={0} withPeriod={false} props={props} />}
      {mode === 'CASES' && (
        <Stack gap="xs">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={keys.list} strategy={verticalListSortingStrategy}>
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
                  <CaseFields item={item} onChange={(changes) => update(index, changes)} start={start} index={index} withPeriod props={props} />
                </CaseCard>
              ))}
            </SortableContext>
          </DndContext>
          <Text size="xs" c="dimmed">
            Chaque cas a sa période, ses jours et ses horaires ; un jour pris par plusieurs cas suit le premier (glissez-les pour les réordonner).
          </Text>
          <div>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() => {
                folds.open(cases.length);
                onChange([...cases, newCase()]);
              }}
            >
              Ajouter un cas
            </Button>
          </div>
          {props.exceptions}
        </Stack>
      )}
      {footer}
    </Stack>
  );
}
