import { Collapse, Group, Stack, Text, type MultiSelectProps } from '@mantine/core';
import { BellRingingIcon } from '@phosphor-icons/react';
import {
  normalizedReminders,
  reminderAnchorOf,
  reminderKey,
  reminderKindOf,
  reminderOfKey,
  readReminders,
  REMINDERS_MAX,
  TIME_OF_DAY_PATTERN,
  twoDigits,
  type Reminder,
  type ReminderAnchor,
  type ReminderFields,
  type ReminderKind,
  type ReminderValue,
} from '@ordo/shared';
import { useState } from 'react';
import { ActionButton } from '../actions/ActionButton';
import { BatchMultiSelect } from './BatchMultiSelect';
import { RingtoneSelect } from './RingtoneSelect';
import { REMINDER_DAY, REMINDER_DAYS_PRESETS, REMINDER_DAYS_TIME, REMINDER_PRESETS, REMINDER_TIME_PRESETS, reminderLabel } from './reminder-presets';

/** Error of a time typed that is no time (shown below the field). */
const TYPED_TIME_ERROR = 'Heure attendue (HH:MM).';
/** Error of a text typed that is no reminder, when « N jours avant » are offered. */
const TYPED_REMINDER_ERROR = 'Heure (HH:MM) ou jours avant (« 3 j 08:00 ») attendus.';
/** Error of a text typed that is no reminder, when those from the end are offered too. */
const TYPED_END_ERROR = 'Heure (HH:MM), jours avant (« 3 j 08:00 ») ou depuis la fin (« fin 18:00 », « fin 2 j 9h ») attendus.';

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
  /** What they count from: the start, and the end for events and routines (decision FS). Optional. Default = the start. */
  anchors?: readonly ReminderAnchor[];
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
 * A reminder typed counted from the end (« fin 18:00 », « fin 2 j 9h »): the text after « fin », null otherwise.
 * @param {string} text Text typed.
 * @returns {string | null} Text after « fin ».
 */
function typedEnd(text: string): string | null {
  const match = /^\s*(?:à\s+la\s+)?fin\s*,?\s*(.*)$/i.exec(text);
  return match ? match[1] : null;
}

/**
 * The ringtone of each reminder chosen (decision FS), folded under « Sonneries » to keep the editor light: « Celle des
 * réglages » or one of the bank.
 * @param {object} props Component props.
 * @param {Reminder[]} props.reminders Reminders chosen.
 * @param {string} props.day Day of the times of the day in their labels.
 * @param {(reminders: Reminder[]) => void} props.onChange Reminders with the ringtone changed.
 * @param {boolean} [props.disabled] Read only. Optional.
 * @returns {JSX.Element} Ringtones.
 */
function ReminderRingtones({ reminders, day, onChange, disabled }: { reminders: Reminder[]; day: string; onChange: (reminders: Reminder[]) => void; disabled?: boolean }) {
  const [opened, setOpened] = useState(false);
  const named = reminders.filter((reminder) => reminder.ringtone).length;
  return (
    <Stack gap={4}>
      <Group>
        <ActionButton priority="tertiary" size="xs" icon={<BellRingingIcon aria-hidden />} aria-expanded={opened} onClick={() => setOpened((current) => !current)}>
          {named ? `Sonneries (${named})` : 'Sonneries'}
        </ActionButton>
      </Group>
      <Collapse expanded={opened}>
        <Stack gap={4}>
          {reminders.map((reminder) => (
            <Group key={reminderKey(reminder)} gap="xs" wrap="nowrap" justify="space-between">
              <Text size="sm">{reminderLabel(reminder, day)}</Text>
              <RingtoneSelect
                size="xs"
                aria-label={`Sonnerie de « ${reminderLabel(reminder, day)} »`}
                value={reminder.ringtone}
                disabled={disabled}
                comboboxProps={{ withinPortal: false }}
                onChange={(ringtone) => {
                  // The same reminder without its ringtone (its key leaves it out), then the one chosen.
                  const plain = reminderOfKey(reminderKey(reminder)) ?? reminder;
                  onChange(reminders.map((item) => (item === reminder ? { ...plain, ...(ringtone && { ringtone }) } : item)));
                }}
              />
            </Group>
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
}

/**
 * « Rappels » of a task, a routine, an event, an éphéméride or a birthday, the one editor of all (decision D16, lot
 * 16), 10 at most, mixed kinds: « Au début » and « N min avant » (`kinds` « before »), « À HH:MM le jour J » chosen
 * every half hour or typed (`kinds` « at »), « N jours avant, à HH:MM » chosen (at 09:00) or typed (« 3 j 18:30 »,
 * `kinds` « days », decision FO). With `anchors` « end » (events, routines, decision FS), the same counted from the
 * end: « À la fin », « N min avant la fin », « N jours avant la fin » chosen, « À HH:MM le jour de la fin » typed
 * (« fin 18:00 », « fin 2 j 9h »). Each reminder may name its ringtone (« Sonneries », folded). A value kept from
 * before that is no preset is still shown. A text typed that is no reminder shows its error below the field until the
 * next change.
 * @param {RemindersSelectProps} props Component props (and those of the multi-select).
 * @returns {JSX.Element} Multi-select.
 */
export function RemindersSelect({ kinds = ['before', 'at', 'days'], anchors = ['start'], value, onChange, day = REMINDER_DAY, emptyLabel, error, ...props }: RemindersSelectProps) {
  const [typedError, setTypedError] = useState<string | null>(null);
  const chosen = normalizedReminders(readReminders(value));
  const before = kinds.includes('before');
  const at = kinds.includes('at');
  const days = kinds.includes('days');
  const fromEnd = anchors.includes('end');
  /**
   * Presets counted from one side.
   * @param {ReminderAnchor} anchor Start or end.
   * @returns {ReminderValue[]} Presets.
   */
  const presets = (anchor: ReminderAnchor): ReminderValue[] => [
    ...(before
      ? REMINDER_PRESETS.map((preset) => ({
          before: preset.value,
          at: null,
          anchor,
        }))
      : []),
    ...(days
      ? REMINDER_DAYS_PRESETS.map((count) => ({
          before: null,
          at: REMINDER_DAYS_TIME,
          days: count,
          anchor,
        }))
      : []),
    ...(at && anchor === 'start' ? REMINDER_TIME_PRESETS.map((time) => ({ before: null, at: time })) : []),
  ];
  const offered = normalizedReminders<ReminderValue>([...presets('start'), ...(fromEnd ? presets('end') : []), ...chosen]);
  /**
   * Options of one kind, counted from one side.
   * @param {ReminderKind} kind Kind.
   * @param {ReminderAnchor} [anchor] Start or end. Optional. Default = start.
   * @returns {{ value: string, label: string }[]} Options.
   */
  const options = (kind: ReminderKind, anchor: ReminderAnchor = 'start') =>
    offered
      .filter((reminder) => reminderKindOf(reminder) === kind && reminderAnchorOf(reminder) === anchor)
      .map((reminder) => ({
        value: reminderKey(reminder),
        label: reminderLabel(reminder, day),
      }));
  // Ringtones are kept by key: a reminder chosen again keeps its own.
  const ringtones = new Map(chosen.flatMap((reminder) => (reminder.ringtone ? [[reminderKey(reminder), reminder.ringtone] as const] : [])));
  /**
   * Typed text as a reminder from the start (or, after « fin », from the end).
   * @param {string} text Text typed.
   * @returns {Reminder | null} Reminder.
   */
  const typedReminder = (text: string): Reminder | null => {
    const end = fromEnd ? typedEnd(text) : null;
    const body = end ?? text;
    const time = at ? typedTime(body) : null;
    const typed = time ? reminderOfKey(reminderKey({ before: null, at: time })) : days ? typedDaysReminder(body) : null;
    return typed && end !== null ? { ...typed, anchor: 'end' } : typed;
  };
  const endGroups = fromEnd
    ? [
        ...(before ? [{ group: 'Avant la fin', items: options('before', 'end') }] : []),
        ...(days ? [{ group: 'Jours avant la fin', items: options('days', 'end') }] : []),
        ...(at
          ? [
              {
                group: 'À une heure, le jour de la fin',
                items: options('at', 'end'),
              },
            ]
          : []),
      ]
    : [];
  return (
    <Stack gap={4}>
      <BatchMultiSelect
        placeholder={value.length ? undefined : emptyLabel}
        maxValues={REMINDERS_MAX}
        searchable={at || days}
        {...props}
        error={typedError ?? error}
        data={[
          ...(before
            ? [
                {
                  group: fromEnd ? 'Avant le début' : 'Avant',
                  items: options('before'),
                },
              ]
            : []),
          ...(days
            ? [
                {
                  group: fromEnd ? 'Jours avant le début' : 'Jours avant',
                  items: options('days'),
                },
              ]
            : []),
          ...(at
            ? [
                {
                  group: day ? `À une heure, ${day}` : 'À une heure',
                  items: options('at'),
                },
              ]
            : []),
          ...endGroups.filter((group) => group.items.length > 0),
        ]}
        value={chosen.map(reminderKey)}
        onChange={(keys) => {
          setTypedError(null);
          onChange(
            normalizedReminders(
              keys.flatMap((key) => {
                const reminder = reminderOfKey(key);
                const ringtone = ringtones.get(key);
                return reminder ? [ringtone ? { ...reminder, ringtone } : reminder] : [];
              }),
            ),
          );
        }}
        onCreate={
          at || days
            ? (text) => {
                const typed = typedReminder(text);
                setTypedError(typed ? null : fromEnd ? TYPED_END_ERROR : days ? TYPED_REMINDER_ERROR : TYPED_TIME_ERROR);
                return Promise.resolve(typed ? reminderKey(typed) : null);
              }
            : undefined
        }
      />
      {chosen.length > 0 && <ReminderRingtones reminders={chosen} day={day} onChange={onChange} disabled={props.disabled || props.readOnly} />}
    </Stack>
  );
}
