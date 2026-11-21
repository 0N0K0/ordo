import { DAY_REMINDER_KINDS, REMINDER_KINDS, ROUTINE_REMINDER_ANCHORS, routineHasHours, type Reminder } from '@ordo/shared';
import { InheritedField, type InheritedFieldState } from '../../../components/inheritance/InheritedField';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { useSlotChoices } from '../../calendar/hooks/use-slot-sources';
import { TravelField } from '../../geo/components/TravelField';
import { Checkbox, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
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
import { RepetitionField, RepetitionModal } from '../../../components/recurrence/RepetitionField';
import { describeCase } from '../../../components/recurrence/describe-recurrence';
import * as fmt from '../../../lib/format';
import { localToday } from '../../../lib/dates';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf } from '../../geo/lib/location';
import { useFormLocation } from '../../geo/hooks/use-location-draft';
import { TravelCalculator } from '../../geo/components/TravelCalculator';
import { OpensOnInput } from './OpensOnInput';
import { opensText } from '../lib/opens-format';
import { SlotConditionBuilder } from '../../calendar/components/SlotConditionBuilder';
import { describeSlotCondition } from '../../calendar/lib/slot-condition-text';
import { DAILY, ruleOf, windowText } from '../lib/routine-format';
import type { Routine } from '../api';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { SlotTimesFields } from './SlotTimesFields';

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
 * Times of the day of a routine: from when and by when (each optional), optional or not, as many as needed.
 * @param {{ moments: RoutineSlot[], onChange: (moments: RoutineSlot[]) => void, index: number, allowEmpty?: boolean }} props Moments, their change, case number, none allowed (one per slot of the schedules).
 * @returns {JSX.Element} Moments.
 */
function MomentsEditor({ moments, onChange, index, allowEmpty = false }: { moments: RoutineSlot[]; onChange: (moments: RoutineSlot[]) => void; index: number; allowEmpty?: boolean }) {
  /**
   * Changes a moment.
   * @param {number} position Its index.
   * @param {Partial<RoutineSlot>} changes Changes.
   * @returns {void}
   */
  const update = (position: number, changes: Partial<RoutineSlot>) => onChange(moments.map((moment, other) => (other === position ? { ...moment, ...changes } : moment)));
  return (
    <LabeledField label="Moments de la journée">
      {moments.map((moment, position) => (
        <Group key={position} gap={6} wrap="nowrap">
          <SlotTimesFields value={moment} onChange={(times) => update(position, times)} name={`moment ${position + 1}, cas ${index + 1}`} />
          <Checkbox size="xs" label="Facultatif" checked={moment.optional} onChange={(event) => update(position, { optional: event.currentTarget.checked })} />
          {(allowEmpty || moments.length > 1) && (
            <RemoveButton label="Retirer" size="sm" aria-label={`Retirer le moment ${position + 1}`} onClick={() => onChange(moments.filter((_, other) => other !== position))} />
          )}
        </Group>
      ))}
      {allowEmpty && !moments.length && (
        <Text size="xs" c="dimmed">
          Aucun : chaque horaire des créneaux choisis est un moment.
        </Text>
      )}
      <AddItemButton onClick={() => onChange([...moments, ANY_TIME])}>Ajouter un moment</AddItemButton>
    </LabeledField>
  );
}

/**
 * Moments as text: "avant 08:00, 12:00–14:00 (facultatif)".
 * @param {readonly RoutineSlot[]} moments Moments.
 * @returns {string} Text.
 */
const describeMoments = (moments: readonly RoutineSlot[]) => moments.map((moment) => `${windowText(moment) || 'dans la journée'}${moment.optional ? ' (facultatif)' : ''}`).join(', ');

/**
 * Moments and condition of the rule or cases of a routine, for the common repetition editor.
 * @param {Map<string, string>} names Names of the calendar schedules.
 * @returns {RepetitionTimes<RoutineTimes>} Times.
 */
const routineTimes = (names: Map<string, string>): RepetitionTimes<RoutineTimes> => ({
  render: (times, onChange, index, rule) => (
    <Stack gap="sm">
      <MomentsEditor moments={times.moments} onChange={(moments) => onChange({ ...times, moments })} index={index} />
      <SlotConditionBuilder item="routine" value={times.condition} onChange={(condition) => onChange({ ...times, condition })} />
      <OpensOnInput frequency={rule?.frequency ?? 'DAILY'} value={times.opens} onChange={(opens) => onChange({ ...times, opens })} />
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
 * Every repetition setting of a routine, in the common modal: its first day, then one rule or cases, each with its
 * moments and its condition on calendar schedules; its « Ouverture ».
 * @param {{ draft: RoutineRepetitionValue, setDraft: (value: RoutineRepetitionValue) => void, names: Map<string, string> }} props Draft, its change, names of the schedules.
 * @returns {JSX.Element} Settings.
 */
function RoutineRepetitionEditor({ draft, setDraft, names }: { draft: RoutineRepetitionValue; setDraft: (value: RoutineRepetitionValue) => void; names: Map<string, string> }) {
  const start = draft.startDate || localToday();
  return (
    <Stack gap="md">
      <DatePickerInput label="Première fois" required value={draft.startDate || null} onChange={(date) => date && setDraft({ ...draft, startDate: date })} />
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
        times={routineTimes(names)}
      />
    </Stack>
  );
}

/**
 * Repetition of a routine as text, a line each: its first day, then its rule or cases with their moments and
 * conditions.
 * @param {RoutineRepetitionValue} value Repetition.
 * @param {Map<string, string>} names Names of the schedules.
 * @returns {string[]} Lines.
 */
function describeRepetition(value: RoutineRepetitionValue, names: Map<string, string>): string[] {
  const start = value.startDate || localToday();
  const times = routineTimes(names);
  return [`À partir du ${fmt.day(start)}`, ...editedCases(value).map((item, index) => `${value.mode === 'CASES' ? `Cas ${index + 1} · ` : ''}${fmt.capitalize(describeCase(item, start, { times }))}`)];
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
      editor={(value, change) => <RoutineRepetitionEditor draft={value} setDraft={change} names={names} />}
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

interface RoutineScheduleProps {
  values: RoutineScheduleValues;
  errors: Record<string, ReactNode>;
  onChange: (changes: Partial<RoutineScheduleValues>) => void;
  /**
   * Saves fields typed now, in a panel saved field by field (`useFieldSave`): the place once chosen, cleared or left,
   * a travel time once left. Optional.
   */
  onCommit?: (fields: (keyof RoutineScheduleValues & string)[]) => void;
  /** A sub-routine: what its repetition and its place show of their inheritance, and its parent's name. Optional. */
  inherited?: { from: string; when: InheritedFieldState; location: InheritedFieldState; readOnly?: boolean };
}

/**
 * Time and place of a routine: its repetition (summary, every setting in the common modal), where, the travel times
 * there and back (computed from the place) with when to leave and when back (one moment of its own only), and its
 * alerts; a sub-routine's repetition and place greyed while inherited (`InheritedField`).
 * @param {RoutineScheduleProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function RoutineSchedule({ values, errors, onChange, onCommit, inherited }: RoutineScheduleProps) {
  const { names } = useSlotChoices();
  const mode: RepetitionModeValue = values.cases.length ? 'CASES' : 'RULE';
  const single = mode === 'RULE' && values.moments.length <= 1 ? (values.moments[0] ?? ANY_TIME) : null;
  const { leaveAt, backAt } = routineSchedule({ ...values, fromTime: single?.fromTime ?? null, dueTime: single?.dueTime ?? null });
  const address = addressOf(values);
  // Put in the form (and saved, field by field) once chosen, cleared or left.
  const place = useFormLocation(values, onChange, onCommit);
  // Without any hour, only reminders at a time of the day.
  const timed = routineHasHours(values);
  return (
    <Stack gap="sm">
      <InheritedField {...(inherited?.when ?? { origin: null })} from={inherited?.from ?? ''} readOnly={inherited?.readOnly}>
        <RepetitionField<RoutineRepetitionValue>
          label="Répétition et moments"
          required
          error={(errors.recurrence ?? errors.cases ?? errors.moments ?? errors.slotCondition ?? errors.startDate ?? errors.opensOn) as ReactNode}
          value={{ ...values, mode }}
          onChange={(value) =>
            onChange({
              startDate: value.startDate,
              recurrence: value.recurrence,
              cases: value.cases,
              slotCondition: value.slotCondition,
              moments: value.moments,
              opensOn: value.opensOn,
            })
          }
          valid={validRepetition}
          describe={(value) => describeRepetition(value, names)}
          editor={(draft, setDraft) => <RoutineRepetitionEditor draft={draft} setDraft={setDraft} names={names} />}
        />
      </InheritedField>
      <InheritedField {...(inherited?.location ?? { origin: null })} from={inherited?.from ?? ''} readOnly={inherited?.readOnly}>
        <EventLocation value={place.value} error={errors.location} onChange={place.onChange} onBlur={place.leave} />
      </InheritedField>
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
        <TravelField way="before" description="Pour y aller" value={values.travelBefore} onChange={(value) => onChange({ travelBefore: Number(value) || 0 })} onBlur={() => onCommit?.(['travelBefore'])} error={errors.travelBefore} />
        <TravelField way="after" description="Pour en revenir" value={values.travelAfter} onChange={(value) => onChange({ travelAfter: Number(value) || 0 })} onBlur={() => onCommit?.(['travelAfter'])} error={errors.travelAfter} />
        <Stack justify="flex-end">
          <TravelCalculator
            eventPoint={address.point}
            onResult={({ before, after }) => {
              onChange({ ...(before !== undefined && { travelBefore: before }), ...(after !== undefined && { travelAfter: after }) });
              onCommit?.(['travelBefore', 'travelAfter']);
            }}
          />
        </Stack>
      </SimpleGrid>
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
      {(leaveAt || backAt) && (
        <Text size="sm" c="dimmed">
          {leaveAt && `Partir à ${leaveAt.replace(':', ' h ')}${values.estimate && single?.dueTime ? ` (trajet et ${values.estimate} min sur place)` : ''}`}
          {leaveAt && backAt && ' · '}
          {backAt && `retour vers ${backAt.replace(':', ' h ')}`}
        </Text>
      )}
    </Stack>
  );
}
