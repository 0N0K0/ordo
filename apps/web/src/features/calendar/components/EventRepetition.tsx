import { Stack, Switch } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { daysBetween, spanEnd, type Recurrence, DURATION_UNITS } from '@ordo/shared';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { ExceptionsSummary } from '../../../components/recurrence/ExceptionsSummary';
import { RuleExceptions } from '../../../components/recurrence/RuleExceptions';
import { openRepetitionModal } from '../../../components/recurrence/open-repetition-modal';
import { skippedLines } from '../../../components/recurrence/exceptions';
import { toastCallbacks } from '../../../lib/notify';
import * as fmt from '../../../lib/format';
import { useCalendarEventMutations, useEventExceptions } from '../api';
import { eventExceptionLines } from '../lib/event-exceptions';

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
 * Exceptions of a recurring event in its modal: its « rien » days, and its occurrences deleted, cancelled or changed
 * alone (`useEventExceptions`), each restored by « Rétablir » at once (the occurrence goes back to its series; the
 * routine links it can no longer have confirmed first).
 * @param {{ eventId: string | null, rule: Recurrence, onChange: (rule: Recurrence) => void, start: string }} props Event (none: a new one), rule edited, its change, first day of the series.
 * @returns {JSX.Element} List.
 */
function EventExceptions({ eventId, rule, onChange, start }: { eventId: string | null; rule: Recurrence; onChange: (rule: Recurrence) => void; start: string }) {
  const { data: exceptions } = useEventExceptions(eventId);
  const { restoreException } = useCalendarEventMutations();
  const others = eventExceptionLines(exceptions ?? []).map((line) => ({
    ...line,
    restoring: restoreException.isPending && restoreException.variables?.occurrenceDate === line.day,
    onRestore: () => eventId && restoreException.mutate({ id: eventId, occurrenceDate: line.day }, toastCallbacks(`Occurrence du ${fmt.dayLong(line.day)} rétablie.`)),
  }));
  return <RuleExceptions rule={rule} onChange={onChange} start={start} others={others} />;
}

/**
 * Days, hours and repetition of an event, right in its panel (no modal): the whole day, the start and the end, then
 * the rule (its end) and the length of each occurrence of an all-day event, then its exceptions (`ExceptionsSummary`:
 * its « rien » days, changed in their modal and saved on « Appliquer », and its occurrences deleted, cancelled or
 * changed alone, restored there at once). Each change is given at once
 * (`onChange`); `onCommit` follows a choice at once (a frequency, a weekday, the period…) and a number once it is left
 * (the interval, the count…): the event panel saves then. With `ruleLocked` (one occurrence of a series edited alone),
 * only its days and hours: the rule is the one of the series.
 * @param {{ value: EventTiming, onChange: (value: EventTiming) => void, onCommit?: () => void, ruleStart: string, error?: string, ruleLocked?: boolean, eventId?: string | null }} props Timing, its change, its commit, first day of the series, error, rule not editable, event saved (its exceptions). Optional.
 * @returns {JSX.Element} Fields.
 */
export function EventRepetition({
  value,
  onChange,
  onCommit,
  ruleStart,
  error,
  ruleLocked = false,
  eventId = null,
}: {
  value: EventTiming;
  onChange: (value: EventTiming) => void;
  onCommit?: () => void;
  ruleStart: string;
  error?: string;
  ruleLocked?: boolean;
  eventId?: string | null;
}) {
  const { data: exceptions } = useEventExceptions(ruleLocked || !value.recurrence ? null : eventId);
  /**
   * Changes the days, keeping the end after the start (and the length of an occurrence of the rule).
   * @param {Partial<EventTiming>} changes Changes.
   * @returns {void}
   */
  const set = (changes: Partial<EventTiming>) => onChange({ ...value, ...changes });
  // The timing as it is now, read when the exceptions modal applies (saves may have come back meanwhile).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  /**
   * Changes the days or hours from a choice: given, then committed.
   * @param {Partial<EventTiming>} changes Changes.
   * @returns {void}
   */
  const choose = (changes: Partial<EventTiming>) => {
    set(changes);
    onCommit?.();
  };
  const days = (
    <Stack gap="sm">
      <Switch
        label="Journée entière"
        checked={value.allDay}
        onChange={(event) => {
          const allDay = event.currentTarget.checked;
          choose({
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
          choose({
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
  const rule = value.recurrence;
  return (
    <Stack gap="sm">
      {days}
      <RuleEditor
        rule={rule}
        onChange={(next) => {
          // A length of the rule sets the end of the event (its first occurrence).
          const duration = next?.duration;
          set({ recurrence: next, ...(duration && value.allDay ? { endDate: spanEnd(duration, value.startDate) } : {}) });
        }}
        onCommit={onCommit}
        start={ruleStart}
        durations={value.allDay && rule ? DURATION_UNITS : undefined}
      />
      {rule && (
        <ExceptionsSummary
          lines={[...skippedLines([rule]), ...eventExceptionLines(exceptions ?? [])]}
          showEmpty
          onEdit={() =>
            openRepetitionModal<Recurrence>({
              title: 'Exceptions de la répétition',
              value: rule,
              editor: (draft, setDraft) => <EventExceptions eventId={eventId} rule={draft} onChange={setDraft} start={ruleStart} />,
              onApply: (next) => {
                onChange({ ...latest.current, recurrence: next });
                onCommit?.();
              },
            })
          }
        />
      )}
    </Stack>
  );
}
