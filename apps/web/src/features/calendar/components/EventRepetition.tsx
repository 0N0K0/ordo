import { SimpleGrid, Stack, Switch } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { addDays, daysBetween, spanEnd, type Recurrence, DURATION_UNITS } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { PICKER_FORMATS } from '../../../lib/format';
import { describeDuration, describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import { dateRangeProps } from '../../../components/inputs/date-range';
import { eventMomentText } from '../lib/event-moment';

/** When an event takes place, and how it repeats. */
interface EventTiming {
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  recurrence: Recurrence | null;
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
        eventMomentText(timing),
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
        // The end cannot be picked before the start; its own days again: the length of the rule follows them.
        const days = dateRangeProps({
          value: [draft.startDate, draft.endDate],
          onChange: ([startDate, endDate]) => startDate && endDate && set({ startDate, endDate, ...(draft.recurrence?.duration ? { recurrence: { ...draft.recurrence, duration: null } } : {}) }),
        });
        return (
          <RuleEditor
            rule={draft.recurrence}
            onChange={(rule) => {
              // A length of the rule sets the end of the event (its first occurrence).
              const duration = rule?.duration;
              set({ recurrence: rule, ...(duration && draft.allDay ? { endDate: spanEnd(duration, draft.startDate) } : {}) });
            }}
            start={ruleStart}
            durations={draft.allDay && draft.recurrence ? DURATION_UNITS : undefined}
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
                  {!draft.allDay && <TimePicker label="Heure de début" required value={draft.startTime ?? ''} onChange={(startTime) => set({ startTime: startTime || null })} />}
                  <DatePickerInput label="Fin" required valueFormat={PICKER_FORMATS.weekday} {...days.end} />
                  {!draft.allDay && <TimePicker label="Heure de fin" required value={draft.endTime ?? ''} onChange={(endTime) => set({ endTime: endTime || null })} />}
                </SimpleGrid>
              </Stack>
            }
          />
        );
      }}
    />
  );
}
