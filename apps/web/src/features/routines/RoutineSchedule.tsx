import { ActionIcon, Button, Checkbox, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { routineSchedule, type DurationUnit, type Recurrence, type RepetitionCase, type RoutineCase, type RoutineSlot } from '@ordo/shared';
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
import { DAILY, ROUTINE_REMINDERS, windowText } from './routine-format';

/** Time and place fields of a routine. */
export interface RoutineScheduleValues {
  startDate: string;
  recurrence: Recurrence;
  cases: RoutineCase[];
  /** Calendar schedules it follows (one or another). */
  scheduleIds: string[];
  /** Calendar schedules it is done out of. */
  excludedScheduleIds: string[];
  /** Times of the day following its rule or its schedules. */
  moments: RoutineSlot[];
  opensOn: string | null;
  reminders: number[];
  estimate: number | null;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  travelBefore: number;
  travelAfter: number;
}

/** How a routine repeats, as edited: its first day, its mode, rule, cases, schedules, moments and « à partir du ». */
type RoutineRepetitionValue = Pick<RoutineScheduleValues, 'startDate' | 'recurrence' | 'cases' | 'scheduleIds' | 'excludedScheduleIds' | 'moments' | 'opensOn'> & { mode: RepetitionModeValue };

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

/** Moments of the cases of a routine, for the common repetition editor. */
const MOMENTS: RepetitionTimes<RoutineSlot[]> = {
  render: (moments, onChange, index) => <MomentsEditor moments={moments} onChange={onChange} index={index} />,
  describe: describeMoments,
  empty: () => [ANY_TIME],
};

/**
 * Cases of the common editor of a routine as edited: its rule and moments (one rule), or its cases.
 * @param {RoutineRepetitionValue} value Repetition.
 * @returns {RepetitionCase<RoutineSlot[]>[]} Cases.
 */
function editedCases(value: RoutineRepetitionValue): RepetitionCase<RoutineSlot[]>[] {
  if (value.mode === 'CASES') return value.cases.map((item) => ({ since: item.from, until: item.until ?? null, anchor: null, rule: item.recurrence, times: item.slots }));
  return [{ since: null, until: null, anchor: null, rule: value.recurrence, times: value.moments.length ? value.moments : [ANY_TIME] }];
}

/**
 * Repetition with the cases of the common editor.
 * @param {RoutineRepetitionValue} value Repetition.
 * @param {RepetitionCase<RoutineSlot[]>[]} cases Cases edited.
 * @returns {RoutineRepetitionValue} Repetition.
 */
function withEditedCases(value: RoutineRepetitionValue, cases: RepetitionCase<RoutineSlot[]>[]): RoutineRepetitionValue {
  if (value.mode === 'CASES') return { ...value, cases: cases.map((item) => ({ from: item.since, until: item.until, recurrence: item.rule ?? DAILY, slots: item.times })) };
  return { ...value, recurrence: cases[0]?.rule ?? value.recurrence, moments: cases[0]?.times ?? value.moments };
}

/**
 * Every repetition setting of a routine, in the common modal: its first day, then one rule, cases, or calendar
 * schedules (one or another, its moments kept within their slots); the schedules it is done out of; its « à partir du ».
 * @param {{ draft: RoutineRepetitionValue, setDraft: (value: RoutineRepetitionValue) => void }} props Draft and its change.
 * @returns {JSX.Element} Settings.
 */
function RoutineRepetitionEditor({ draft, setDraft }: { draft: RoutineRepetitionValue; setDraft: (value: RoutineRepetitionValue) => void }) {
  const { data: schedules } = useWorkSchedules();
  const scheduleOptions = (schedules ?? []).map((schedule) => ({ value: schedule.id, label: schedule.name }));
  const start = draft.startDate || localToday();
  const frequency = draft.recurrence.frequency;
  return (
    <Stack gap="md">
      <DatePickerInput label="Première fois" required value={draft.startDate || null} onChange={(date) => date && setDraft({ ...draft, startDate: String(date) })} />
      <RepetitionEditor<RoutineSlot[]>
        mode={draft.mode}
        onModeChange={(mode) =>
          setDraft({
            ...draft,
            mode,
            // Each mode keeps only its own settings.
            cases: mode === 'CASES' ? (draft.cases.length ? draft.cases : [{ from: null, until: null, recurrence: draft.recurrence, slots: draft.moments.length ? draft.moments : [ANY_TIME] }]) : [],
            scheduleIds: mode === 'SCHEDULES' ? draft.scheduleIds : [],
            excludedScheduleIds: mode === 'SCHEDULES' ? [] : draft.excludedScheduleIds,
            moments: mode === 'SCHEDULES' ? [] : draft.moments.length ? draft.moments : [ANY_TIME],
          })
        }
        cases={editedCases(draft)}
        onChange={(cases) => setDraft(withEditedCases(draft, cases))}
        start={start}
        multiple
        allowNone={false}
        durations={ROUTINE_DURATIONS}
        times={MOMENTS}
        modes={[
          {
            value: 'SCHEDULES',
            label: 'Plages de l’agenda',
            render: () => (
              <Stack gap="sm">
                <BatchMultiSelect
                  label="Plages"
                  description="L’une ou l’autre : la routine a lieu sur leurs horaires (pauses et exceptions comprises)."
                  placeholder={draft.scheduleIds.length ? undefined : 'Choisir des plages'}
                  searchable
                  data={scheduleOptions}
                  nothingFoundMessage="Aucune plage (créez-en dans l’agenda)"
                  value={draft.scheduleIds}
                  onChange={(scheduleIds) => setDraft({ ...draft, scheduleIds })}
                />
                <MomentsEditor moments={draft.moments} onChange={(moments) => setDraft({ ...draft, moments })} index={0} allowEmpty />
                <Text size="xs" c="dimmed">
                  Facultatif : chaque moment n’est gardé que les jours où il croise un horaire de ces plages (manger entre 7 h et 7 h 30, 12 h et 12 h 30…).
                </Text>
              </Stack>
            ),
          },
        ]}
        footer={
          draft.mode === 'SCHEDULES' ? undefined : (
            <Stack gap="sm">
              {draft.mode === 'RULE' && (frequency === 'MONTHLY' || frequency === 'YEARLY') && (
                <OpensOnInput frequency={frequency} value={draft.opensOn} onChange={(opensOn) => setDraft({ ...draft, opensOn })} />
              )}
              <BatchMultiSelect
                label="Hors des plages"
                description="Facultatif : la routine ne se fait que sur le temps libre en dehors de ces plages (une plage sur toute la journée la bloque)."
                placeholder={draft.excludedScheduleIds.length ? undefined : 'Aucune'}
                searchable
                clearable
                data={scheduleOptions}
                value={draft.excludedScheduleIds}
                onChange={(excludedScheduleIds) => setDraft({ ...draft, excludedScheduleIds })}
              />
            </Stack>
          )
        }
      />
    </Stack>
  );
}

/**
 * Repetition of a routine as text, a line each: its first day, its rule or cases or schedules, its exclusions.
 * @param {RoutineRepetitionValue} value Repetition.
 * @param {Map<string, string>} names Names of the schedules.
 * @returns {string[]} Lines.
 */
function describeRepetition(value: RoutineRepetitionValue, names: Map<string, string>): string[] {
  const start = value.startDate || localToday();
  const listed = (ids: readonly string[]) => ids.map((id) => names.get(id) ?? 'plage supprimée').join(', ');
  const lines = [`À partir du ${fmt.day(start)}`];
  if (value.mode === 'SCHEDULES') lines.push(`Sur les plages ${listed(value.scheduleIds) || '—'}${value.moments.length ? ` · ${describeMoments(value.moments)}` : ''}`);
  else lines.push(...editedCases(value).map((item, index) => `${value.mode === 'CASES' ? `Cas ${index + 1} · ` : ''}${fmt.capitalize(describeCase(item, start, { times: MOMENTS }))}`));
  if (value.excludedScheduleIds.length) lines.push(`Hors des plages ${listed(value.excludedScheduleIds)}`);
  return lines;
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
  const mode: RepetitionModeValue = values.scheduleIds.length ? 'SCHEDULES' : values.cases.length ? 'CASES' : 'RULE';
  const single = mode === 'RULE' && values.moments.length <= 1 ? (values.moments[0] ?? ANY_TIME) : null;
  const { leaveAt, backAt } = routineSchedule({ ...values, fromTime: single?.fromTime ?? null, dueTime: single?.dueTime ?? null });
  const point = values.locationLat !== null && values.locationLon !== null ? { lat: values.locationLat, lon: values.locationLon } : null;
  const timed = mode !== 'RULE' || values.moments.some((moment) => moment.fromTime || moment.dueTime);
  return (
    <Stack gap="sm">
      <RepetitionField<RoutineRepetitionValue>
        label="Répétition et moments"
        required
        error={(errors.recurrence ?? errors.cases ?? errors.moments ?? errors.scheduleIds ?? errors.startDate ?? errors.opensOn) as ReactNode}
        value={{ ...values, mode }}
        onChange={(value) =>
          onChange({
            startDate: value.startDate,
            recurrence: value.recurrence,
            cases: value.cases,
            scheduleIds: value.scheduleIds,
            excludedScheduleIds: value.excludedScheduleIds,
            moments: value.moments,
            opensOn: value.opensOn,
          })
        }
        valid={(draft) => Boolean(draft.startDate) && (draft.mode !== 'SCHEDULES' || draft.scheduleIds.length > 0) && (draft.mode !== 'CASES' || draft.cases.length > 0)}
        describe={(value) => describeRepetition(value, names)}
        editor={(draft, setDraft) => <RoutineRepetitionEditor draft={draft} setDraft={setDraft} />}
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
