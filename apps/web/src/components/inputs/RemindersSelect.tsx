import type { MultiSelectProps } from '@mantine/core';
import { normalizedReminders, reminderKey, reminderKindOf, reminderOfKey, readReminders, REMINDERS_MAX, TIME_OF_DAY_PATTERN, twoDigits, type Reminder, type ReminderFields, type ReminderKind, type ReminderValue } from '@ordo/shared';
import { useState } from 'react';
import { BatchMultiSelect } from './BatchMultiSelect';
import { REMINDER_DAY, REMINDER_DAYS_PRESETS, REMINDER_DAYS_TIME, REMINDER_PRESETS, REMINDER_TIME_PRESETS, reminderLabel } from './reminder-presets';

/** Error of a time typed that is no time (shown below the field). */
const TYPED_TIME_ERROR = 'Heure attendue (HH:MM).';
/** Error of a text typed that is no reminder, when « N jours avant » are offered. */
const TYPED_REMINDER_ERROR = 'Heure (HH:MM) ou jours avant (« 3 j 08:00 ») attendus.';

export interface RemindersSelectProps extends Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> {
  /** Kinds offered: « before » (« Au début », « N min avant »), « at » (« À HH:MM »), « days » (« N jours avant, à HH:MM »). Optional. Default = all. */
  kinds?: readonly ReminderKind[];
  /** Reminders chosen (as the form or GraphQL holds them). */
  value: readonly ReminderFields[];
  /** Reminders chosen, in their stored order (`normalizedReminders`). */
  onChange: (reminders: Reminder[]) => void;
  /** Day of the times of the day in their labels (empty: none, a task). Optional. Default = « le jour J ». */
  day?: string;
  /** Placeholder when there is none. Optional. Default = none. */
  emptyLabel?: string;
}

/**
 * A time typed by the user (« 8:15 », « 8h15 », « 8 »), as HH:MM.
 * @param {string} text Text typed.
 * @returns {string | null} HH:MM, null when it is not a time.
 */
function typedTime(text: string): string | null {
  const match = /^(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)?$/.exec(text.trim());
  const time = match ? `${twoDigits(Number(match[1]))}:${match[2] ?? '00'}` : '';
  return TIME_OF_DAY_PATTERN.test(time) ? time : null;
}

/**
 * A reminder « N jours avant » typed by the user (« 3 j », « 3 j 8h15 », « J-3 18:30 », « 3 jours avant à 8h »), at
 * 09:00 without hour.
 * @param {string} text Text typed.
 * @returns {Reminder | null} Reminder, null when it is none (or out of bounds).
 */
function typedDaysReminder(text: string): Reminder | null {
  const match = /^(?:j\s*-\s*)?(\d{1,2})\s*(?:j|jours?)?(?:\s*avant)?(?:\s*,?\s*(?:à\s*)?(.+))?$/i.exec(text.trim());
  if (!match || (!/j/i.test(text) && !match[2])) return null;
  const time = match[2] ? typedTime(match[2]) : REMINDER_DAYS_TIME;
  return time ? reminderOfKey(reminderKey({ before: null, at: time, days: Number(match[1]) })) : null;
}

/**
 * « Rappels » of a task, a routine, an event, an éphéméride or a birthday, the one editor of all (decision D16, lot
 * 16), 10 at most, mixed kinds: « Au début » and « N min avant » (`kinds` « before »), « À HH:MM le jour J » chosen
 * every half hour or typed (`kinds` « at »), « N jours avant, à HH:MM » chosen (at 09:00) or typed (« 3 j 18:30 »,
 * `kinds` « days », decision FO). A value kept from before that is no preset is still shown. A text typed that is no
 * reminder shows its error below the field until the next change.
 * @param {RemindersSelectProps} props Component props (and those of the multi-select).
 * @returns {JSX.Element} Multi-select.
 */
export function RemindersSelect({ kinds = ['before', 'at', 'days'], value, onChange, day = REMINDER_DAY, emptyLabel, error, ...props }: RemindersSelectProps) {
  const [typedError, setTypedError] = useState<string | null>(null);
  const chosen = normalizedReminders(readReminders(value));
  const before = kinds.includes('before');
  const at = kinds.includes('at');
  const days = kinds.includes('days');
  const offered = normalizedReminders<ReminderValue>([
    ...(before ? REMINDER_PRESETS.map((preset) => ({ before: preset.value, at: null })) : []),
    ...(days ? REMINDER_DAYS_PRESETS.map((count) => ({ before: null, at: REMINDER_DAYS_TIME, days: count })) : []),
    ...(at ? REMINDER_TIME_PRESETS.map((time) => ({ before: null, at: time })) : []),
    ...chosen,
  ]);
  /**
   * Options of one kind.
   * @param {ReminderKind} kind Kind.
   * @returns {{ value: string, label: string }[]} Options.
   */
  const options = (kind: ReminderKind) => offered.filter((reminder) => reminderKindOf(reminder) === kind).map((reminder) => ({ value: reminderKey(reminder), label: reminderLabel(reminder, day) }));
  return (
    <BatchMultiSelect
      placeholder={value.length ? undefined : emptyLabel}
      maxValues={REMINDERS_MAX}
      searchable={at || days}
      {...props}
      error={typedError ?? error}
      data={[
        ...(before ? [{ group: 'Avant', items: options('before') }] : []),
        ...(days ? [{ group: 'Jours avant', items: options('days') }] : []),
        ...(at ? [{ group: day ? `À une heure, ${day}` : 'À une heure', items: options('at') }] : []),
      ]}
      value={chosen.map(reminderKey)}
      onChange={(keys) => {
        setTypedError(null);
        onChange(normalizedReminders(keys.flatMap((key) => reminderOfKey(key) ?? [])));
      }}
      onCreate={
        at || days
          ? (text) => {
              const time = at ? typedTime(text) : null;
              const typed = time ? { before: null, at: time } : days ? typedDaysReminder(text) : null;
              setTypedError(typed ? null : days ? TYPED_REMINDER_ERROR : TYPED_TIME_ERROR);
              return Promise.resolve(typed ? reminderKey(typed) : null);
            }
          : undefined
      }
    />
  );
}
