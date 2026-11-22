import { Stack, Switch } from '@mantine/core';
import { daysBetween, spanEnd, type Recurrence, DURATION_UNITS } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { describeDuration, describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import { PeriodField } from '../../../components/inputs/PeriodField';
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
 * (whole day, start and end, rule, and the length of each occurrence of an all-day event). With `ruleLocked` (one
 * occurrence of a series edited alone), only its days and hours: the rule is the one of the series.
 * @param {{ value: EventTiming, onChange: (value: EventTiming) => void, ruleStart: string, error?: string, ruleLocked?: boolean }} props Timing, its change, first day of the series, error, rule not editable. Optional.
 * @returns {JSX.Element} Field.
 */
export function EventRepetition({
  value,
  onChange,
  ruleStart,
  error,
  ruleLocked = false,
}: {
  value: EventTiming;
  onChange: (value: EventTiming) => void;
  ruleStart: string;
  error?: string;
  ruleLocked?: boolean;
}) {
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
        const footer = (
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
                <PeriodField
                  label="Dates"
                  required
                  weekday
                  keepLength
                  value={[draft.startDate, draft.endDate]}
                  times={draft.allDay ? undefined : [draft.startTime, draft.endTime]}
                  onChange={([startDate, endDate], hours) => {
                    if (!startDate || !endDate) return;
                    // Moving the start keeps the length; other days of its own: the length of the rule follows them.
                    const length = daysBetween(startDate, endDate) !== daysBetween(draft.startDate, draft.endDate);
                    set({
                      startDate,
                      endDate,
                      ...(hours ? { startTime: hours[0], endTime: hours[1] } : {}),
                      ...(length && draft.recurrence?.duration ? { recurrence: { ...draft.recurrence, duration: null } } : {}),
                    });
                  }}
                />
              </Stack>
        );
        if (ruleLocked) return footer;
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
            footer={footer}
          />
        );
      }}
    />
  );
}
