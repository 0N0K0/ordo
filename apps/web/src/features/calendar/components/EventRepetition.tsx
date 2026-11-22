import { Stack, Switch } from '@mantine/core';
import { daysBetween, spanEnd, type Recurrence, DURATION_UNITS } from '@ordo/shared';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { PeriodField } from '../../../components/inputs/PeriodField';

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
 * Days, hours and repetition of an event, right in its panel (no modal): the rule (its end and its pauses), the whole
 * day, the start and the end, and the length of each occurrence of an all-day event; each change applied at once. With
 * `ruleLocked` (one occurrence of a series edited alone), only its days and hours: the rule is the one of the series.
 * @param {{ value: EventTiming, onChange: (value: EventTiming) => void, ruleStart: string, error?: string, ruleLocked?: boolean }} props Timing, its change, first day of the series, error, rule not editable. Optional.
 * @returns {JSX.Element} Fields.
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
  /**
   * Changes the days, keeping the end after the start (and the length of an occurrence of the rule).
   * @param {Partial<EventTiming>} changes Changes.
   * @returns {void}
   */
  const set = (changes: Partial<EventTiming>) => onChange({ ...value, ...changes });
  const days = (
    <Stack gap="sm">
      <Switch
        label="Journée entière"
        checked={value.allDay}
        onChange={(event) => {
          const allDay = event.currentTarget.checked;
          set({
            allDay,
            startTime: allDay ? null : '09:00',
            endTime: allDay ? null : '10:00',
            ...(value.recurrence && !allDay ? { recurrence: { ...value.recurrence, duration: null } } : {}),
          });
        }}
      />
      <PeriodField
        label="Période"
        required
        weekday
        keepLength
        value={[value.startDate, value.endDate]}
        times={value.allDay ? undefined : [value.startTime, value.endTime]}
        error={error}
        onChange={([startDate, endDate], hours) => {
          if (!startDate || !endDate) return;
          // Moving the start keeps the length; other days of its own: the length of the rule follows them.
          const length = daysBetween(startDate, endDate) !== daysBetween(value.startDate, value.endDate);
          set({
            startDate,
            endDate,
            ...(hours ? { startTime: hours[0], endTime: hours[1] } : {}),
            ...(length && value.recurrence?.duration ? { recurrence: { ...value.recurrence, duration: null } } : {}),
          });
        }}
      />
    </Stack>
  );
  if (ruleLocked) return days;
  return (
    <RuleEditor
      rule={value.recurrence}
      onChange={(rule) => {
        // A length of the rule sets the end of the event (its first occurrence).
        const duration = rule?.duration;
        set({ recurrence: rule, ...(duration && value.allDay ? { endDate: spanEnd(duration, value.startDate) } : {}) });
      }}
      start={ruleStart}
      durations={value.allDay && value.recurrence ? DURATION_UNITS : undefined}
      footer={days}
    />
  );
}
