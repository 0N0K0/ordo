import { SimpleGrid, Stack, Switch } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, daysBetween, spanEnd, type DurationUnit, type Recurrence } from '@ordo/shared';
import { TimeField } from '../../components/TimeField';
import * as fmt from '../../lib/format';
import { PICKER_FORMATS } from '../../lib/format';
import { describeDuration, describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { RepetitionEditor } from '../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../components/recurrence/RepetitionField';

/** When an event takes place, and how it repeats. */
interface EventTiming {
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  recurrence: Recurrence | null;
}

/** Lengths an all-day repeated event can have besides its own days: weeks, months, up to a week or a month of the year. */
const ALL_DAY_DURATIONS: readonly DurationUnit[] = ['DAYS', 'WEEKS', 'MONTHS', 'TO_DAY', 'TO_WEEK', 'TO_MONTH'];

/**
 * Days and hours of an event as text: "Lundi 3 novembre 2026, 9:00 – 10:00", "Du 3 au 5 novembre 2026".
 * @param {EventTiming} timing Timing.
 * @returns {string} Text.
 */
function describeTiming(timing: EventTiming): string {
  const day = (date: string) => fmt.capitalize(fmt.day(new Date(`${date}T00:00:00Z`)));
  if (timing.allDay)
    return timing.startDate === timing.endDate
      ? `${day(timing.startDate)}, toute la journée`
      : `Du ${fmt.day(new Date(`${timing.startDate}T00:00:00Z`))} au ${fmt.day(new Date(`${timing.endDate}T00:00:00Z`))}`;
  if (timing.startDate === timing.endDate) return `${day(timing.startDate)}, ${timing.startTime ?? ''} – ${timing.endTime ?? ''}`;
  return `${day(timing.startDate)} ${timing.startTime ?? ''} – ${fmt.day(new Date(`${timing.endDate}T00:00:00Z`))} ${timing.endTime ?? ''}`;
}

/**
 * Days, hours and repetition of an event in its panel: their summary, every setting in the common repetition modal
 * (whole day, start and end, rule, and the length of each occurrence of an all-day event).
 * @param {{ value: EventTiming, onChange: (value: EventTiming) => void, ruleStart: string, error?: string }} props Timing, its change, first day of the series, error.
 * @returns {JSX.Element} Field.
 */
export function EventRepetition({ value, onChange, ruleStart, error }: { value: EventTiming; onChange: (value: EventTiming) => void; ruleStart: string; error?: string }) {
  return (
    <RepetitionField<EventTiming>
      label="Date et répétition"
      required
      error={error}
      value={value}
      onChange={onChange}
      valid={(draft) => draft.allDay || Boolean(draft.startTime && draft.endTime && (draft.endDate > draft.startDate || (draft.endTime ?? '') > (draft.startTime ?? '')))}
      describe={(timing) => [
        describeTiming(timing),
        ...(timing.recurrence
          ? [[fmt.capitalize(describeRecurrence(timing.recurrence, ruleStart)), timing.recurrence.duration ? describeDuration(timing.recurrence.duration) : ''].filter(Boolean).join(' · ')]
          : []),
      ]}
      editor={(draft, setDraft) => {
        /**
         * Changes the days, keeping the end after the start (and the length of an occurrence of the rule).
         * @param {Partial<EventTiming>} changes Changes.
         * @returns {void}
         */
        const set = (changes: Partial<EventTiming>) => setDraft({ ...draft, ...changes });
        return (
          <RepetitionEditor<null>
            mode="RULE"
            onModeChange={() => undefined}
            cases={[{ since: null, until: null, anchor: null, rule: draft.recurrence, times: null }]}
            onChange={(cases) => {
              const rule = cases[0]?.rule ?? null;
              // A length of the rule sets the end of the event (its first occurrence).
              const duration = rule?.duration;
              set({ recurrence: rule, ...(duration && draft.allDay ? { endDate: spanEnd(duration, draft.startDate) } : {}) });
            }}
            start={ruleStart}
            durations={draft.allDay && draft.recurrence ? ALL_DAY_DURATIONS : undefined}
            footer={
              <Stack gap="sm">
                <Switch
                  label="Journée entière"
                  checked={draft.allDay}
                  onChange={(event) => {
                    const allDay = event.currentTarget.checked;
                    set({
                      allDay,
                      startTime: allDay ? null : '09:00',
                      endTime: allDay ? null : '10:00',
                      ...(draft.recurrence && !allDay ? { recurrence: { ...draft.recurrence, duration: null } } : {}),
                    });
                  }}
                />
                <SimpleGrid cols={{ base: 1, xs: draft.allDay ? 2 : 4 }} spacing="sm">
                  <DatePickerInput
                    label="Début"
                    required
                    valueFormat={PICKER_FORMATS.weekday}
                    value={draft.startDate}
                    onChange={(startDate) => {
                      if (!startDate) return;
                      // The end follows, keeping the length.
                      set({ startDate, endDate: addDays(startDate, Math.max(0, daysBetween(draft.startDate, draft.endDate))) });
                    }}
                  />
                  {!draft.allDay && <TimeField label="Heure de début" required value={draft.startTime ?? ''} onChange={(startTime) => set({ startTime: startTime || null })} />}
                  <DatePickerInput
                    label="Fin"
                    required
                    valueFormat={PICKER_FORMATS.weekday}
                    minDate={draft.startDate}
                    value={draft.endDate}
                    // Its own days again: the length of the rule follows them.
                    onChange={(endDate) => endDate && set({ endDate, ...(draft.recurrence?.duration ? { recurrence: { ...draft.recurrence, duration: null } } : {}) })}
                  />
                  {!draft.allDay && <TimeField label="Heure de fin" required value={draft.endTime ?? ''} onChange={(endTime) => set({ endTime: endTime || null })} />}
                </SimpleGrid>
              </Stack>
            }
          />
        );
      }}
    />
  );
}
