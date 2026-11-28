import { Stack, Switch, Text } from '@mantine/core';
import { LabelField } from '../../../components/inputs/LabelField';
import { useEffect, useRef } from 'react';
import { daysBetween, postponedRestoreRefusal, spanEnd, type Recurrence, DURATION_UNITS } from '@ordo/shared';
import type { ExceptionEntry } from '../../../components/recurrence/ExceptionsList';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { ExceptionsSummary } from '../../../components/recurrence/ExceptionsSummary';
import { RuleExceptions } from '../../../components/recurrence/RuleExceptions';
import { openRepetitionModal } from '../../../components/recurrence/open-repetition-modal';
import { skippedLines } from '../../../components/recurrence/exceptions';
import { useEventExceptions, type EventExceptionChange } from '../api';
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

/** Days and hours of an event or of one of its occurrences. */
interface EventDaysValue {
  allDay: boolean;
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
}

/**
 * « Journée entière » and « Période » (days with their hours) of an event, or of one of its occurrences in the list of
 * its exceptions: each change given with whether the length of the days changed.
 * @param {{ value: EventDaysValue, onChange: (changes: Partial<EventDaysValue>, length: boolean) => void, error?: string, size?: 'xs' }} props Days, their change, error (optional), smaller fields (optional).
 * @returns {JSX.Element} Fields.
 */
function EventDays({ value, onChange, error, size }: { value: EventDaysValue; onChange: (changes: Partial<EventDaysValue>, length: boolean) => void; error?: string; size?: 'xs' }) {
  return (
    <Stack gap="sm">
      <Switch
        label="Journée entière"
        size={size}
        checked={value.allDay}
        onChange={(event) => {
          const allDay = event.currentTarget.checked;
          onChange({ allDay, startTime: allDay ? null : '09:00', endTime: allDay ? null : '10:00' }, false);
        }}
      />
      <PeriodField
        label="Période"
        required
        weekday
        keepLength
        size={size}
        value={[value.startDate, value.endDate]}
        times={value.allDay ? undefined : [value.startTime, value.endTime]}
        error={error}
        onChange={([startDate, endDate], hours) => {
          if (!startDate || !endDate) return;
          onChange({ startDate, endDate, ...(hours ? { startTime: hours[0], endTime: hours[1] } : {}) }, daysBetween(startDate, endDate) !== daysBetween(value.startDate, value.endDate));
        }}
      />
    </Stack>
  );
}

/** Exceptions of a series edited in their modal: its rule (« rien » days), its occurrences restored and changed alone. */
interface ExceptionsDraft {
  rule: Recurrence;
  restored: string[];
  changed: Record<string, EventExceptionChange>;
}

/**
 * Exceptions of a recurring event in its modal: its « rien » days, and its occurrences deleted, cancelled or changed
 * alone (`useEventExceptions`): each restored by « Rétablir », or changed in its card (label, days and hours); all
 * saved on « Appliquer », with the repetition, all or nothing. A postponed one is not restored
 * (`postponedRestoreRefusal`).
 * @param {{ eventId: string | null, draft: ExceptionsDraft, setDraft: (draft: ExceptionsDraft) => void, start: string }} props Event (none: a new one), draft, its change, first day of the series.
 * @returns {JSX.Element} List.
 */
function EventExceptions({ eventId, draft, setDraft, start }: { eventId: string | null; draft: ExceptionsDraft; setDraft: (draft: ExceptionsDraft) => void; start: string }) {
  const { data: exceptions } = useEventExceptions(eventId);
  const others = (exceptions ?? [])
    .filter((exception) => !draft.restored.includes(exception.date))
    .map((exception): ExceptionEntry => {
      const change = draft.changed[exception.date];
      // Changed in its card: its line says so before it is saved (other hours as soon as they differ from those it had).
      const hoursChanged = change !== undefined && (change.allDay !== exception.allDay || (change.startTime ?? null) !== exception.startTime || (change.endTime ?? null) !== exception.endTime || daysBetween(change.startDate, change.endDate) !== daysBetween(exception.startDate, exception.endDate));
      const shown = change ? { ...exception, ...change, otherHours: exception.otherHours || hoursChanged, changed: exception.changed || change.label !== exception.label } : exception;
      const [line] = eventExceptionLines([shown]);
      // Changed alone: its label, days and hours, as « Cette occurrence » changes them.
      const own: EventExceptionChange = change ?? { date: exception.date, label: exception.label, allDay: exception.allDay, startDate: exception.startDate, startTime: exception.startTime, endDate: exception.endDate, endTime: exception.endTime };
      const edit = (changes: Partial<EventExceptionChange>) => setDraft({ ...draft, changed: { ...draft.changed, [exception.date]: { ...own, ...changes } } });
      return {
        ...line,
        onRestore: exception.postponedTo
          ? undefined
          : () => {
              const changed = Object.fromEntries(Object.entries(draft.changed).filter(([day]) => day !== exception.date));
              setDraft({ ...draft, restored: [...draft.restored, exception.date], changed });
            },
        body: exception.cancelled ? undefined : exception.postponedTo ? (
          <Text size="xs" c="dimmed">
            {postponedRestoreRefusal(exception.postponedTo)}
          </Text>
        ) : (
          <Stack gap="xs">
            <LabelField size="xs" sticky={false} value={own.label} onChange={(event) => edit({ label: event.currentTarget.value })} />
            <EventDays size="xs" value={{ ...own, startTime: own.startTime ?? null, endTime: own.endTime ?? null }} onChange={(changes) => edit(changes)} />
          </Stack>
        ),
      };
    });
  return <RuleExceptions rule={draft.rule} onChange={(rule) => setDraft({ ...draft, rule })} start={start} others={others} />;
}

/**
 * Days, hours and repetition of an event, right in its panel (no modal): the whole day, the start and the end, then
 * the rule (its end) and the length of each occurrence of an all-day event, then its exceptions (`ExceptionsSummary`:
 * its « rien » days, changed in their modal and saved on « Appliquer », and its occurrences deleted, cancelled or
 * changed alone, restored or changed there on « Appliquer »: given to `onExceptions`, saved with the repetition, all or
 * nothing). Each change is given at once
 * (`onChange`); `onCommit` follows a choice at once (a frequency, a weekday, the period…) and a number once it is left
 * (the interval, the count…): the event panel saves then. With `ruleLocked` (one occurrence of a series edited alone),
 * only its days and hours: the rule is the one of the series.
 * @param {{ value: EventTiming, onChange: (value: EventTiming) => void, onCommit?: () => void, ruleStart: string, error?: string, ruleLocked?: boolean, eventId?: string | null, onExceptions?: (change: { restored: string[], changed: EventExceptionChange[] }) => void }} props Timing, its change, its commit (`always`: saved even unchanged), first day of the series, error, rule not editable, event saved (its exceptions), exceptions restored and changed to send with the save of the repetition. Optional.
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
  onExceptions,
}: {
  value: EventTiming;
  onChange: (value: EventTiming) => void;
  onCommit?: (always?: boolean) => void;
  ruleStart: string;
  error?: string;
  ruleLocked?: boolean;
  eventId?: string | null;
  onExceptions?: (change: { restored: string[]; changed: EventExceptionChange[] }) => void;
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
    <EventDays
      value={value}
      error={error}
      onChange={(changes, length) =>
        // Hours of its own, or other days of its own: the length of the rule follows them.
        choose({ ...changes, ...(value.recurrence && (changes.allDay === false || (length && value.recurrence.duration)) ? { recurrence: { ...value.recurrence, duration: null } } : {}) })
      }
    />
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
            openRepetitionModal<ExceptionsDraft>({
              title: 'Exceptions de la répétition',
              value: { rule, restored: [], changed: {} },
              editor: (draft, setDraft) => <EventExceptions eventId={eventId} draft={draft} setDraft={setDraft} start={ruleStart} />,
              valid: (draft) => Object.values(draft.changed).every((change) => change.label.trim() !== ''),
              onApply: ({ rule: next, restored, changed }) => {
                const given = { restored, changed: Object.values(changed) };
                const carried = given.restored.length > 0 || given.changed.length > 0;
                if (carried) onExceptions?.(given);
                onChange({ ...latest.current, recurrence: next });
                // Saved even without another change when exceptions go with it.
                onCommit?.(carried);
              },
            })
          }
        />
      )}
    </Stack>
  );
}
