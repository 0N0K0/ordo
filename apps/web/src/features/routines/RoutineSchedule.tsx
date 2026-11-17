import { ActionIcon, Button, Checkbox, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { opensFits, readOpens, routineSchedule, type RoutineOpens, type SlotCondition, type DurationUnit, type Recurrence, type RepetitionCase, type RoutineCase, type RoutineSlot } from '@ordo/shared';
import { BellIcon, CarIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { type ReactNode } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { TimeField } from '../../components/TimeField';
import { RepetitionEditor, type RepetitionModeValue, type RepetitionTimes } from '../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../components/recurrence/RepetitionField';
import { describeCase } from '../../components/recurrence/describe-recurrence';
import * as fmt from '../../lib/format';
import { localToday } from '../../lib/dates';
import { useWorkSchedules } from '../calendar/api';
import { EventLocation } from '../geo/EventLocation';
import { TravelCalculator } from '../geo/TravelCalculator';
import { OpensOnInput } from './OpensOnInput';
import { opensText } from './opens-format';
import { SlotConditionBuilder } from './SlotConditionBuilder';
import { describeSlotCondition } from './slot-condition-text';
import { DAILY, ROUTINE_REMINDERS, windowText } from './routine-format';

/** Time and place fields of a routine. */
export interface RoutineScheduleValues {
  startDate: string;
  recurrence: Recurrence;
  cases: RoutineCase[];
  /** Following its rule: on or out of calendar schedules, in groups (none: any time). */
  slotCondition: SlotCondition | null;
  /** Times of the day following its rule. */
  moments: RoutineSlot[];
  opensOn: RoutineOpens | null;
  reminders: number[];
  estimate: number | null;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  travelBefore: number;
  travelAfter: number;
}

/** How a routine repeats, as edited: its first day, its mode, rule, cases, schedules, moments and « à partir du ». */
type RoutineRepetitionValue = Pick<RoutineScheduleValues, 'startDate' | 'recurrence' | 'cases' | 'slotCondition' | 'moments' | 'opensOn'> & { mode: RepetitionModeValue };

/** Times of a rule or a case of a routine: its moments, its condition on calendar schedules, its « à partir du ». */
interface RoutineTimes {
  moments: RoutineSlot[];
  condition: SlotCondition | null;
  opens: RoutineOpens | null;
}

/** Lengths of an occurrence of a routine: a day, days (the weekend), weeks, months, up to a day, a week or a month. */
const ROUTINE_DURATIONS: readonly DurationUnit[] = ['DAYS', 'WEEKS', 'MONTHS', 'TO_DAY', 'TO_WEEK', 'TO_MONTH'];

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
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Moments de la journée
      </Text>
      {moments.map((moment, position) => (
        <Group key={position} gap={6} wrap="nowrap">
          <TimeField
            size="xs"
            aria-label={`À partir de, moment ${position + 1}, cas ${index + 1}`}
            leftSection={<Text size="xs">dès</Text>}
            value={moment.fromTime ?? ''}
            onChange={(value) => update(position, { fromTime: value || null })}
          />
          <TimeField
            size="xs"
            aria-label={`Avant, moment ${position + 1}, cas ${index + 1}`}
            leftSection={<Text size="xs">avant</Text>}
            value={moment.dueTime ?? ''}
            onChange={(value) => update(position, { dueTime: value || null })}
          />
          <Checkbox size="xs" label="Facultatif" checked={moment.optional} onChange={(event) => update(position, { optional: event.currentTarget.checked })} />
          {(allowEmpty || moments.length > 1) && (
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Retirer le moment ${position + 1}`} onClick={() => onChange(moments.filter((_, other) => other !== position))}>
              <XIcon aria-hidden />
            </ActionIcon>
          )}
        </Group>
      ))}
      {allowEmpty && !moments.length && (
        <Text size="xs" c="dimmed">
          Aucun : chaque horaire des plages choisies est un moment.
        </Text>
      )}
      <div>
        <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange([...moments, ANY_TIME])}>
          Ajouter un moment
        </Button>
      </div>
    </Stack>
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
      <SlotConditionBuilder value={times.condition} onChange={(condition) => onChange({ ...times, condition })} />
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
    return value.cases.map((item) => ({ since: item.from, until: item.until ?? null, anchor: null, rule: item.recurrence, times: { moments: item.slots, condition: item.condition ?? null, opens: readOpens(item.opens) } }));
  return [{ since: null, until: null, anchor: null, rule: value.recurrence, times: { moments: value.moments.length ? value.moments : [ANY_TIME], condition: value.slotCondition, opens: value.opensOn } }];
}

/**
 * « À partir du » kept while it fits the frequency of its rule (dropped when the repetition changed).
 * @param {RoutineOpens | null} opens « À partir du ».
 * @param {Recurrence | null} rule Rule.
 * @returns {RoutineOpens | null} « À partir du ».
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
      cases: cases.map((item) => ({ from: item.since, until: item.until, recurrence: item.rule ?? DAILY, slots: item.times.moments, condition: item.times.condition, opens: fittingOpens(item.times.opens, item.rule) })),
    };
  const recurrence = cases[0]?.rule ?? value.recurrence;
  return { ...value, recurrence, moments: cases[0]?.times.moments ?? value.moments, slotCondition: cases[0]?.times.condition ?? null, opensOn: fittingOpens(cases[0]?.times.opens ?? null, recurrence) };
}

/**
 * Every repetition setting of a routine, in the common modal: its first day, then one rule or cases, each with its
 * moments and its condition on calendar schedules; its « à partir du ».
 * @param {{ draft: RoutineRepetitionValue, setDraft: (value: RoutineRepetitionValue) => void, names: Map<string, string> }} props Draft, its change, names of the schedules.
 * @returns {JSX.Element} Settings.
 */
function RoutineRepetitionEditor({ draft, setDraft, names }: { draft: RoutineRepetitionValue; setDraft: (value: RoutineRepetitionValue) => void; names: Map<string, string> }) {
  const start = draft.startDate || localToday();
  return (
    <Stack gap="md">
      <DatePickerInput label="Première fois" required value={draft.startDate || null} onChange={(date) => date && setDraft({ ...draft, startDate: String(date) })} />
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
            moments: mode === 'CASES' ? [] : draft.cases[0]?.slots ?? (draft.moments.length ? draft.moments : [ANY_TIME]),
            slotCondition: mode === 'CASES' ? null : (draft.cases[0]?.condition ?? draft.slotCondition),
            // Its « à partir du » goes to the first case, and back.
            opensOn: mode === 'CASES' ? null : draft.cases.length ? fittingOpens(readOpens(draft.cases[0]?.opens), draft.cases[0]?.recurrence ?? null) : draft.opensOn,
          })
        }
        cases={editedCases(draft)}
        onChange={(cases) => setDraft(withEditedCases(draft, cases))}
        start={start}
        multiple
        allowNone={false}
        durations={ROUTINE_DURATIONS}
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
  return [
    `À partir du ${fmt.day(start)}`,
    ...editedCases(value).map((item, index) => `${value.mode === 'CASES' ? `Cas ${index + 1} · ` : ''}${fmt.capitalize(describeCase(item, start, { times }))}`),
  ];
}

interface RoutineScheduleProps {
  values: RoutineScheduleValues;
  errors: Record<string, ReactNode>;
  onChange: (changes: Partial<RoutineScheduleValues>) => void;
}

/**
 * Time and place of a routine: its repetition (summary, every setting in the common modal), where, the travel times
 * there and back (computed from the place) with when to leave and when back (one moment of its own only), and its
 * alerts.
 * @param {RoutineScheduleProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function RoutineSchedule({ values, errors, onChange }: RoutineScheduleProps) {
  const { data: schedules } = useWorkSchedules();
  const names = new Map((schedules ?? []).map((schedule) => [schedule.id, schedule.name]));
  const mode: RepetitionModeValue = values.cases.length ? 'CASES' : 'RULE';
  const single = mode === 'RULE' && values.moments.length <= 1 ? (values.moments[0] ?? ANY_TIME) : null;
  const { leaveAt, backAt } = routineSchedule({ ...values, fromTime: single?.fromTime ?? null, dueTime: single?.dueTime ?? null });
  const point = values.locationLat !== null && values.locationLon !== null ? { lat: values.locationLat, lon: values.locationLon } : null;
  const timed = mode !== 'RULE' || Boolean(values.slotCondition) || values.moments.some((moment) => moment.fromTime || moment.dueTime);
  return (
    <Stack gap="sm">
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
        valid={(draft) => Boolean(draft.startDate) && (draft.mode !== 'CASES' || draft.cases.length > 0)}
        describe={(value) => describeRepetition(value, names)}
        editor={(draft, setDraft) => <RoutineRepetitionEditor draft={draft} setDraft={setDraft} names={names} />}
      />
      <EventLocation
        value={{ text: values.location, point }}
        error={errors.location}
        onChange={(value) => onChange({ location: value.text, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null })}
      />
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
        <NumberInput
          label="Trajet aller"
          description="Pour y aller"
          leftSection={<CarIcon aria-hidden />}
          suffix=" min"
          min={0}
          max={24 * 60}
          step={5}
          allowDecimal={false}
          value={values.travelBefore}
          onChange={(value) => onChange({ travelBefore: Number(value) || 0 })}
          error={errors.travelBefore}
        />
        <NumberInput
          label="Trajet retour"
          description="Pour en revenir"
          leftSection={<CarIcon aria-hidden />}
          suffix=" min"
          min={0}
          max={24 * 60}
          step={5}
          allowDecimal={false}
          value={values.travelAfter}
          onChange={(value) => onChange({ travelAfter: Number(value) || 0 })}
          error={errors.travelAfter}
        />
        <Stack justify="flex-end">
          <TravelCalculator eventPoint={point} onResult={({ before, after }) => onChange({ ...(before !== undefined && { travelBefore: before }), ...(after !== undefined && { travelAfter: after }) })} />
        </Stack>
      </SimpleGrid>
      <BatchMultiSelect
        label="Alertes"
        description={
          timed ? 'Avant l’heure de départ (sinon le début, sinon l’heure maximale), les jours où elle est à faire, tant qu’elle n’est pas cochée.' : 'Donnez-lui un horaire ou une plage pour pouvoir l’alerter.'
        }
        leftSection={<BellIcon aria-hidden />}
        placeholder={values.reminders.length ? undefined : 'Aucune'}
        disabled={!timed}
        data={ROUTINE_REMINDERS.map((preset) => ({ value: String(preset.value), label: preset.label }))}
        value={values.reminders.map(String)}
        onChange={(reminders) => onChange({ reminders: reminders.map(Number).sort((a, b) => a - b) })}
        clearable
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
