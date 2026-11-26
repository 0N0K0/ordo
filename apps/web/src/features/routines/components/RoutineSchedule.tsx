import { DAY_REMINDER_KINDS, REMINDER_KINDS, ROUTINE_REMINDER_ANCHORS, routineHasHours, type Reminder } from '@ordo/shared';
import { InheritedField, type InheritedFieldState } from '../../../components/inheritance/InheritedField';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { useSlotChoices } from '../../calendar/hooks/use-slot-sources';
import { TravelTimes } from '../../geo/components/TravelTimes';
import { Checkbox, Group, Stack, Text } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import {
  opensFits,
  readOpens,
  readSlotCondition,
  routineSchedule,
  type RoutineOpens,
  type SlotCondition,
  type Recurrence,
  type RepetitionCase,
  type RoutineCase,
  type RoutineSlot,
  DURATION_UNITS,
} from '@ordo/shared';
import { useState, type ReactNode } from 'react';
import { RepetitionEditor, type RepetitionModeValue, type RepetitionTimes } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionModal } from '../../../components/recurrence/RepetitionField';
import { parisToday } from '../../../lib/dates';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf } from '../../geo/lib/location';
import { useFormLocation } from '../../geo/hooks/use-location-draft';
import { OpensOnInput } from './OpensOnInput';
import { opensText } from '../lib/opens-format';
import { SlotConditionBuilder } from '../../calendar/components/SlotConditionBuilder';
import { describeSlotCondition } from '../../calendar/lib/slot-condition-text';
import { DAILY, ruleOf, windowText } from '../lib/routine-format';
import type { Routine } from '../api';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { SlotTimesFields } from './SlotTimesFields';
import { ROUTINE_REPETITION_KEYS } from '../lib/routine-inheritance';

/** Time and place fields of a routine. */
interface RoutineScheduleValues {
  startDate: string;
  recurrence: Recurrence;
  cases: RoutineCase[];
  /** Following its rule: on or out of calendar schedules, in groups (none: any time). */
  slotCondition: SlotCondition | null;
  /** Times of the day following its rule. */
  moments: RoutineSlot[];
  opensOn: RoutineOpens | null;
  reminders: Reminder[];
  estimate: number | null;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  travelBefore: number;
  travelAfter: number;
}

/** How a routine repeats, as edited: its first day, its mode, rule, cases, schedules, moments and « Ouverture ». */
type RoutineRepetitionValue = Pick<RoutineScheduleValues, 'startDate' | 'recurrence' | 'cases' | 'slotCondition' | 'moments' | 'opensOn'> & { mode: RepetitionModeValue };

/** Times of a rule or a case of a routine: its moments, its condition on calendar schedules, its « Ouverture ». */
interface RoutineTimes {
  moments: RoutineSlot[];
  condition: SlotCondition | null;
  opens: RoutineOpens | null;
}

/** A moment from the start to the end of the day. */
const ANY_TIME: RoutineSlot = { fromTime: null, dueTime: null, optional: false };

/**
 * Times of the day of a routine: from when and by when (each optional), optional or not, as many as needed. Each change
 * is given at once; `onCommit` follows a choice at once (« Facultatif », a moment added or removed), and an hour once
 * it is left.
 * @param {{ moments: RoutineSlot[], onChange: (moments: RoutineSlot[]) => void, index: number, allowEmpty?: boolean, onCommit?: () => void }} props Moments, their change, case number, none allowed (one per slot of the schedules), commit. Optional.
 * @returns {JSX.Element} Moments.
 */
function MomentsEditor({
  moments,
  onChange,
  index,
  allowEmpty = false,
  onCommit,
}: {
  moments: RoutineSlot[];
  onChange: (moments: RoutineSlot[]) => void;
  index: number;
  allowEmpty?: boolean;
  onCommit?: () => void;
}) {
  /**
   * Changes a moment.
   * @param {number} position Its index.
   * @param {Partial<RoutineSlot>} changes Changes.
   * @returns {void}
   */
  const update = (position: number, changes: Partial<RoutineSlot>) => onChange(moments.map((moment, other) => (other === position ? { ...moment, ...changes } : moment)));
  /**
   * Gives moments changed by a choice, then commits them.
   * @param {RoutineSlot[]} next Moments.
   * @returns {void}
   */
  const choose = (next: RoutineSlot[]) => {
    onChange(next);
    onCommit?.();
  };
  return (
    <LabeledField label="Moments de la journée">
      {moments.map((moment, position) => (
        <Group key={position} gap={6} wrap="nowrap">
          <SlotTimesFields value={moment} onChange={(times) => update(position, times)} name={`moment ${position + 1}, cas ${index + 1}`} onBlur={onCommit} />
          <Checkbox
            size="xs"
            label="Facultatif"
            checked={moment.optional}
            onChange={(event) => choose(moments.map((other, at) => (at === position ? { ...other, optional: event.currentTarget.checked } : other)))}
          />
          {(allowEmpty || moments.length > 1) && (
            <RemoveButton label="Retirer" size="sm" aria-label={`Retirer le moment ${position + 1}`} onClick={() => choose(moments.filter((_, other) => other !== position))} />
          )}
        </Group>
      ))}
      {allowEmpty && !moments.length && (
        <Text size="xs" c="dimmed">
          Aucun : chaque horaire des créneaux choisis est un moment.
        </Text>
      )}
      <AddItemButton onClick={() => choose([...moments, ANY_TIME])}>Ajouter un moment</AddItemButton>
    </LabeledField>
  );
}

/** Why a routine that has sub-routines has no moments of its own. */
const PARENT_MOMENTS = 'Aucun : une routine qui a des sous-routines n’a pas de moments à elle, chacune de ses sous-routines a les siens.';

/**
 * Moments as text: "avant 08:00, 12:00–14:00 (facultatif)".
 * @param {readonly RoutineSlot[]} moments Moments.
 * @returns {string} Text.
 */
const describeMoments = (moments: readonly RoutineSlot[]) => moments.map((moment) => `${windowText(moment) || 'dans la journée'}${moment.optional ? ' (facultatif)' : ''}`).join(', ');

/**
 * Moments and condition of the rule or cases of a routine, for the common repetition editor: committed (a panel saved
 * field by field) once chosen, an hour or a number once left, a condition at once. Without moments (a routine that has
 * sub-routines, its rule), a line says why instead.
 * @param {Map<string, string>} names Names of the calendar schedules.
 * @param {boolean} [withMoments] Its moments are edited. Optional. Default = true.
 * @returns {RepetitionTimes<RoutineTimes>} Times.
 */
const routineTimes = (names: Map<string, string>, withMoments = true): RepetitionTimes<RoutineTimes> => ({
  render: (times, onChange, index, rule, onCommit) => (
    <Stack gap="sm">
      {withMoments ? (
        <MomentsEditor moments={times.moments} onChange={(moments) => onChange({ ...times, moments })} index={index} onCommit={onCommit} />
      ) : (
        <LabeledField label="Moments de la journée">
          <Text size="sm" c="dimmed">
            {PARENT_MOMENTS}
          </Text>
        </LabeledField>
      )}
      <SlotConditionBuilder
        item="routine"
        value={times.condition}
        onChange={(condition) => {
          onChange({ ...times, condition });
          onCommit?.();
        }}
      />
      <OpensOnInput frequency={rule?.frequency ?? 'DAILY'} value={times.opens} onChange={(opens) => onChange({ ...times, opens })} onCommit={onCommit} />
    </Stack>
  ),
  describe: (times, rule) =>
    [describeMoments(times.moments), describeSlotCondition(times.condition, names), times.opens && rule && opensText(times.opens, rule.frequency) && `dès ${opensText(times.opens, rule.frequency)}`]
      .filter(Boolean)
      .join(' · '),
  empty: () => ({ moments: [ANY_TIME], condition: null, opens: null }),
});

/**
 * Cases of the common editor of a routine as edited: its rule and moments (one rule), or its cases.
 * @param {RoutineRepetitionValue} value Repetition.
 * @returns {RepetitionCase<RoutineTimes>[]} Cases.
 */
function editedCases(value: RoutineRepetitionValue): RepetitionCase<RoutineTimes>[] {
  if (value.mode === 'CASES')
    return value.cases.map((item) => ({
      since: item.from,
      until: item.until ?? null,
      anchor: null,
      rule: item.recurrence,
      times: { moments: item.slots, condition: item.condition ?? null, opens: readOpens(item.opens) },
    }));
  return [
    { since: null, until: null, anchor: null, rule: value.recurrence, times: { moments: value.moments.length ? value.moments : [ANY_TIME], condition: value.slotCondition, opens: value.opensOn } },
  ];
}

/**
 * « Ouverture » kept while it fits the frequency of its rule (dropped when the repetition changed).
 * @param {RoutineOpens | null} opens « Ouverture ».
 * @param {Recurrence | null} rule Rule.
 * @returns {RoutineOpens | null} « Ouverture ».
 */
const fittingOpens = (opens: RoutineOpens | null, rule: Recurrence | null) => (opens && rule && opensFits(opens, rule.frequency) ? opens : null);

/**
 * Repetition with the cases of the common editor.
 * @param {RoutineRepetitionValue} value Repetition.
 * @param {RepetitionCase<RoutineTimes>[]} cases Cases edited.
 * @returns {RoutineRepetitionValue} Repetition.
 */
function withEditedCases(value: RoutineRepetitionValue, cases: RepetitionCase<RoutineTimes>[]): RoutineRepetitionValue {
  if (value.mode === 'CASES')
    return {
      ...value,
      cases: cases.map((item) => ({
        from: item.since,
        until: item.until,
        recurrence: item.rule ?? DAILY,
        slots: item.times.moments,
        condition: item.times.condition,
        opens: fittingOpens(item.times.opens, item.rule),
      })),
    };
  const recurrence = cases[0]?.rule ?? value.recurrence;
  return {
    ...value,
    recurrence,
    moments: cases[0]?.times.moments ?? value.moments,
    slotCondition: cases[0]?.times.condition ?? null,
    opensOn: fittingOpens(cases[0]?.times.opens ?? null, recurrence),
  };
}

/**
 * Every repetition setting of a routine: its first day (unless its panel shows it apart), then one rule or cases, each
 * with its moments and its condition on calendar schedules; its « Ouverture ». In the common modal (a table cell), or
 * right in the panel with `onCommit` (called once a value is chosen, an hour or a number left).
 * @param {{ draft: RoutineRepetitionValue, setDraft: (value: RoutineRepetitionValue) => void, names: Map<string, string>, withStart?: boolean, withMoments?: boolean, onCommit?: () => void }} props Draft, its change, names of the schedules, first day asked (default true), moments of its rule edited (default true: false for a routine that has sub-routines), commit. Optional.
 * @returns {JSX.Element} Settings.
 */
function RoutineRepetitionEditor({
  draft,
  setDraft,
  names,
  withStart = true,
  withMoments = true,
  onCommit,
}: {
  draft: RoutineRepetitionValue;
  setDraft: (value: RoutineRepetitionValue) => void;
  names: Map<string, string>;
  withStart?: boolean;
  withMoments?: boolean;
  onCommit?: () => void;
}) {
  const start = draft.startDate || parisToday();
  return (
    <Stack gap="md">
      {withStart && <DateField label="Première fois" required value={draft.startDate || null} onChange={(date) => date && setDraft({ ...draft, startDate: date })} />}
      <RepetitionEditor<RoutineTimes>
        mode={draft.mode}
        onModeChange={(mode) =>
          setDraft({
            ...draft,
            mode,
            // Cases start from the rule; back to one rule keeps the first case.
            cases:
              mode === 'CASES'
                ? draft.cases.length
                  ? draft.cases
                  : [{ from: null, until: null, recurrence: draft.recurrence, slots: draft.moments.length ? draft.moments : [ANY_TIME], condition: draft.slotCondition, opens: draft.opensOn }]
                : [],
            moments: mode === 'CASES' ? [] : (draft.cases[0]?.slots ?? (draft.moments.length ? draft.moments : [ANY_TIME])),
            slotCondition: mode === 'CASES' ? null : (draft.cases[0]?.condition ?? draft.slotCondition),
            // Its « Ouverture » goes to the first case, and back.
            opensOn: mode === 'CASES' ? null : draft.cases.length ? fittingOpens(readOpens(draft.cases[0]?.opens), draft.cases[0]?.recurrence ?? null) : draft.opensOn,
          })
        }
        cases={editedCases(draft)}
        onChange={(cases) => setDraft(withEditedCases(draft, cases))}
        start={start}
        multiple
        allowNone={false}
        durations={DURATION_UNITS}
        times={routineTimes(names, withMoments || draft.mode === 'CASES')}
        onCommit={onCommit}
      />
    </Stack>
  );
}

/** Whole repetition of a routine, as saved. */
type RoutineRepetition = Pick<RoutineScheduleValues, 'startDate' | 'recurrence' | 'cases' | 'slotCondition' | 'moments' | 'opensOn'>;

/**
 * Repetition of a routine, to edit.
 * @param {Routine} routine Routine.
 * @returns {RoutineRepetitionValue} Repetition.
 */
function routineRepetitionValue(routine: Routine): RoutineRepetitionValue {
  const cases = ((routine.cases as RoutineCase[] | null) ?? []).map((item) => ({ ...item, opens: readOpens(item.opens) }));
  return {
    mode: cases.length ? 'CASES' : 'RULE',
    startDate: routine.startDate,
    recurrence: ruleOf(routine) ?? DAILY,
    cases,
    slotCondition: readSlotCondition(routine.slotCondition),
    moments: (routine.moments as RoutineSlot[] | null)?.length ? (routine.moments as RoutineSlot[]) : [ANY_TIME],
    opensOn: readOpens(routine.opensOn),
  };
}

/**
 * Whether a repetition can be applied: a first day, and a case at least in cases.
 * @param {RoutineRepetitionValue} draft Repetition.
 * @returns {boolean} Valid.
 */
const validRepetition = (draft: RoutineRepetitionValue) => Boolean(draft.startDate) && (draft.mode !== 'CASES' || draft.cases.length > 0);

/**
 * Every repetition setting of a routine in the common modal, out of its form (a table cell): applied to it, or to every
 * routine selected.
 * @param {{ routine: Routine, opened: boolean, onClose: () => void, onApply: (repetition: RoutineRepetition) => void, header?: ReactNode }} props Routine edited, opened, closing, saving, what it applies to.
 * @returns {JSX.Element} Modal.
 */
export function RoutineRepetitionModal({
  routine,
  opened,
  onClose,
  onApply,
  header,
}: {
  routine: Routine;
  opened: boolean;
  onClose: () => void;
  onApply: (repetition: RoutineRepetition) => void;
  header?: ReactNode;
}) {
  const { names } = useSlotChoices();
  const [draft, setDraft] = useState<RoutineRepetitionValue>(() => routineRepetitionValue(routine));
  return (
    <RepetitionModal<RoutineRepetitionValue>
      opened={opened}
      onClose={onClose}
      title={`Répétition et moments de « ${routine.label} »`}
      header={header}
      draft={draft}
      setDraft={setDraft}
      valid={validRepetition}
      // A routine that has sub-routines has no moments of its own.
      editor={(value, change) => <RoutineRepetitionEditor draft={value} setDraft={change} names={names} withMoments={!routine.tickedWithSubRoutines} />}
      onApply={(value) =>
        onApply({
          startDate: value.startDate,
          recurrence: value.recurrence,
          cases: value.mode === 'CASES' ? value.cases : [],
          slotCondition: value.mode === 'CASES' ? null : value.slotCondition,
          moments: value.mode === 'CASES' ? [] : value.moments,
          opensOn: value.mode === 'CASES' ? null : value.opensOn,
        })
      }
    />
  );
}

interface RoutineFieldsProps {
  values: RoutineScheduleValues;
  errors: Record<string, ReactNode>;
  onChange: (changes: Partial<RoutineScheduleValues>) => void;
  /**
   * Saves fields typed now, in a panel saved field by field (`useFieldSave`): the place once chosen, cleared or left,
   * a travel time once left. Optional.
   */
  onCommit?: (fields: (keyof RoutineScheduleValues & string)[]) => void;
  /** A sub-routine: what the field shows of its inheritance, and its parent's name. Optional. */
  inherited?: { from: string; state: InheritedFieldState; readOnly?: boolean };
}

/**
 * Inheritance of a field of a sub-routine (`InheritedField`), nothing shown for another routine.
 * @param {RoutineFieldsProps['inherited']} inherited Inheritance.
 * @returns {object} Props of `InheritedField`.
 */
const inheritedProps = (inherited: RoutineFieldsProps['inherited']) => ({ ...(inherited?.state ?? { origin: null }), from: inherited?.from ?? '', readOnly: inherited?.readOnly });

/**
 * « Répétition et moments » of a routine, right in its panel (no modal; its first day apart): one rule or cases, each
 * with its moments, condition and « Ouverture ». Each change is given at once (`onChange`); `onCommit` saves them
 * once a value is chosen (a frequency, a weekday, a case, a condition…), an hour or a number once left. Greyed while
 * inherited (its moments are its own). A routine that has sub-routines has no moments of its rule (`withMoments`).
 * @param {RoutineFieldsProps & { withMoments?: boolean }} props Component props (`withMoments`: its moments edited, default true).
 * @returns {JSX.Element} Field.
 */
export function RoutineRepetition({ values, errors, onChange, onCommit, inherited, withMoments = true }: RoutineFieldsProps & { withMoments?: boolean }) {
  const { names } = useSlotChoices();
  const mode: RepetitionModeValue = values.cases.length ? 'CASES' : 'RULE';
  return (
    <InheritedField {...inheritedProps(inherited)}>
      <LabeledField label="Répétition et moments" required error={(errors.recurrence ?? errors.cases ?? errors.moments ?? errors.slotCondition ?? errors.opensOn) as ReactNode}>
        <RoutineRepetitionEditor
          draft={{ ...values, mode }}
          setDraft={(value) =>
            onChange({
              recurrence: value.recurrence,
              cases: value.cases,
              slotCondition: value.slotCondition,
              moments: value.moments,
              opensOn: value.opensOn,
            })
          }
          names={names}
          withStart={false}
          withMoments={withMoments}
          onCommit={onCommit && (() => onCommit([...ROUTINE_REPETITION_KEYS]))}
        />
      </LabeledField>
    </InheritedField>
  );
}

/**
 * Place of a routine: where (greyed while inherited), the travel times there and back (computed from the place), and,
 * once an outward travel is given, when to leave and when back (one moment of its own only).
 * @param {RoutineFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function RoutinePlace({ values, errors, onChange, onCommit, inherited }: RoutineFieldsProps) {
  const single = !values.cases.length && values.moments.length <= 1 ? (values.moments[0] ?? ANY_TIME) : null;
  const { leaveAt, backAt } = routineSchedule({ ...values, fromTime: single?.fromTime ?? null, dueTime: single?.dueTime ?? null });
  // Put in the form (and saved, field by field) once chosen, cleared or left.
  const place = useFormLocation(values, onChange, onCommit);
  const leave = leaveAt
    ? `Partir à ${leaveAt.replace(':', ' h ')}${values.estimate && single?.dueTime ? ` (trajet et ${values.estimate} min sur place)` : ''}${backAt ? ` · retour vers ${backAt.replace(':', ' h ')}` : ''}`
    : null;
  return (
    <Stack gap="sm">
      <InheritedField {...inheritedProps(inherited)}>
        <EventLocation value={place.value} error={errors.location} onChange={place.onChange} onBlur={place.leave} />
      </InheritedField>
      <TravelTimes value={values} hints={['Pour y aller', 'Pour en revenir']} point={addressOf(values).point} onChange={onChange} onCommit={onCommit} errors={errors} leave={leave} />
    </Stack>
  );
}

/**
 * « Rappels » of a routine: before its moments or at a time of its days (only at a time without any hour).
 * @param {RoutineFieldsProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RoutineReminders({ values, errors, onChange }: RoutineFieldsProps) {
  // Without any hour, only reminders at a time of the day.
  const timed = routineHasHours(values);
  return (
    <RemindersSelect
      label="Rappels"
      description={
        timed
          ? 'Pour chaque occurrence : avant le début ou la fin de chaque moment non coché, le jour de l’ouverture ou celui de l’échéance (« dès » / « jusqu’à », l’autre heure selon le temps à y consacrer), 24 h au plus ; ou à une heure de l’un de ces jours ou de quelques jours avant.'
          : 'À une heure du jour de l’ouverture ou de l’échéance, ou de quelques jours avant : donnez une heure « dès » ou « jusqu’à » à ses moments (ou un créneau) pour des rappels avant eux.'
      }
      kinds={timed ? REMINDER_KINDS : DAY_REMINDER_KINDS}
      anchors={ROUTINE_REMINDER_ANCHORS}
      value={values.reminders}
      onChange={(reminders) => onChange({ reminders })}
      error={errors.reminders}
    />
  );
}
