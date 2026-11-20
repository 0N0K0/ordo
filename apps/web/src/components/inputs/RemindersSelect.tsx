import type { MultiSelectProps } from '@mantine/core';
import { normalizedReminders, reminderKey, reminderOfKey, readReminders, REMINDERS_MAX, TIME_OF_DAY_PATTERN, twoDigits, type Reminder, type ReminderFields, type ReminderKind, type ReminderValue } from '@ordo/shared';
import { useState } from 'react';
import { BatchMultiSelect } from './BatchMultiSelect';
import { REMINDER_DAY, REMINDER_PRESETS, REMINDER_TIME_PRESETS, reminderLabel } from './reminder-presets';

/** Error of a time typed that is no time (shown below the field). */
const TYPED_TIME_ERROR = 'Heure attendue (HH:MM).';

export interface RemindersSelectProps extends Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> {
  /** Kinds offered: « before » (« Au début », « N min avant »), « at » (« À HH:MM »). Optional. Default = both. */
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
 * « Rappels » of a task, a routine or an event, the one editor of the three (decision D16), 10 at most, mixed kinds:
 * « Au début » and « N min avant » (`kinds` « before »), « À HH:MM le jour J » chosen every half hour or typed (`kinds`
 * « at »). A value kept from before that is no preset is still shown. A time typed that is no time shows « Heure
 * attendue (HH:MM). » below the field until the next change.
 * @param {RemindersSelectProps} props Component props (and those of the multi-select).
 * @returns {JSX.Element} Multi-select.
 */
export function RemindersSelect({ kinds = ['before', 'at'], value, onChange, day = REMINDER_DAY, emptyLabel, error, ...props }: RemindersSelectProps) {
  const [typedError, setTypedError] = useState<string | null>(null);
  const chosen = normalizedReminders(readReminders(value));
  const before = kinds.includes('before');
  const at = kinds.includes('at');
  const offered = normalizedReminders<ReminderValue>([
    ...(before ? REMINDER_PRESETS.map((preset) => ({ before: preset.value, at: null })) : []),
    ...(at ? REMINDER_TIME_PRESETS.map((time) => ({ before: null, at: time })) : []),
    ...chosen,
  ]);
  /**
   * Options of one kind.
   * @param {boolean} times Times of the day.
   * @returns {{ value: string, label: string }[]} Options.
   */
  const options = (times: boolean) => offered.filter((reminder) => (reminder.at !== null) === times).map((reminder) => ({ value: reminderKey(reminder), label: reminderLabel(reminder, day) }));
  return (
    <BatchMultiSelect
      placeholder={value.length ? undefined : emptyLabel}
      maxValues={REMINDERS_MAX}
      searchable={at}
      {...props}
      error={typedError ?? error}
      data={[...(before ? [{ group: 'Avant', items: options(false) }] : []), ...(at ? [{ group: day ? `À une heure, ${day}` : 'À une heure', items: options(true) }] : [])]}
      value={chosen.map(reminderKey)}
      onChange={(keys) => {
        setTypedError(null);
        onChange(normalizedReminders(keys.flatMap((key) => reminderOfKey(key) ?? [])));
      }}
      onCreate={
        at
          ? (text) => {
              const time = typedTime(text);
              setTypedError(time ? null : TYPED_TIME_ERROR);
              return Promise.resolve(time ? reminderKey({ before: null, at: time }) : null);
            }
          : undefined
      }
    />
  );
}
