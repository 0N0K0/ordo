import { Checkbox, Collapse, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { BellRingingIcon } from '@phosphor-icons/react';
import {
  normalizedReminders,
  reminderAnchorOf,
  reminderKey,
  reminderOfKey,
  readReminders,
  reminderSchema,
  REMINDERS_MAX,
  type Reminder,
  type ReminderAnchor,
  type ReminderFields,
  type ReminderKind,
} from '@ordo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';
import { AddItemButton } from '../actions/AddItemButton';
import { RemoveButton } from '../actions/RemoveButton';
import { LabeledField } from './LabeledField';
import { RingtoneSelect } from './RingtoneSelect';
import { anchorWords, REMINDER_DAY, REMINDER_DAYS_TIME, reminderLabel, reminderTargetOf, type ReminderTarget } from './reminder-presets';

export interface RemindersSelectProps {
  label: ReactNode;
  /** Help under the label. Optional. */
  description?: ReactNode;
  /** Error of the list (from the form or the API), under the rows. Optional. */
  error?: ReactNode;
  /** Kinds offered: « before » (« N min / h avant »), « at » (« À HH:MM le jour J »), « days » (« N jours avant, à HH:MM »). Optional. Default = all. */
  kinds?: readonly ReminderKind[];
  /** Reminders chosen (as the form or GraphQL holds them). */
  value: readonly ReminderFields[];
  /** Reminders chosen, in their stored order (`normalizedReminders`): on leaving a field of a row, on a choice, a row added or removed. */
  onChange: (reminders: Reminder[]) => void;
  /** Day of the times of the day in their labels (empty: none, a task). Optional. Default = « le jour J ». */
  day?: string;
  /** Box of a time of the day of the item's day. Optional. Default = « Le jour J ». */
  dayLabel?: string;
  /** Text when there is none. Optional. Default = « Aucun rappel. ». */
  emptyLabel?: string;
  /**
   * What they count from (`EVENT_REMINDER_ANCHORS`, `ROUTINE_REMINDER_ANCHORS`): a small select on
   * each row when there are several. Optional. Default = the start only.
   */
  anchors?: readonly ReminderAnchor[];
  disabled?: boolean;
  readOnly?: boolean;
}

/** Unit of the number of a row: minutes or hours before a moment, days before a day. */
type ReminderUnit = 'min' | 'h' | 'days';

/** A row of the editor as typed: on the item's day (a time) or some minutes, hours or days before, its anchor, its time. */
interface ReminderDraft {
  id: number;
  /** On the item's day, at a time (« Le jour J »). */
  onDay: boolean;
  count: number | string;
  unit: ReminderUnit;
  /** HH:MM. */
  at: string;
  anchor: ReminderAnchor;
  /** A field of the row was left: its errors show. */
  touched: boolean;
}

/** Labels of the units. */
const UNIT_LABELS: Record<ReminderUnit, string> = { min: 'min', h: 'h', days: 'jours' };

/** Id of the next row of an editor (unique across editors: only told apart within one). */
let nextDraftId = 0;

/** Message of a row that is already in the list. */
const DUPLICATE = 'Ce rappel est déjà dans la liste.';

/**
 * A row of the editor from a reminder.
 * @param {Reminder} reminder Reminder.
 * @param {number} id Id of the row.
 * @returns {ReminderDraft} Row.
 */
function draftOf(reminder: Reminder, id: number): ReminderDraft {
  const anchor = reminderAnchorOf(reminder);
  if (reminder.at !== null) return { id, onDay: !reminder.days, count: reminder.days ?? 1, unit: 'days', at: reminder.at, anchor, touched: false };
  const hours = reminder.before >= 60 && reminder.before % 60 === 0;
  return { id, onDay: false, count: hours ? reminder.before / 60 : reminder.before, unit: hours ? 'h' : 'min', at: REMINDER_DAYS_TIME, anchor, touched: false };
}

/**
 * Reminder of a row, or the errors of its fields (the messages of `reminderSchema`).
 * @param {ReminderDraft} draft Row.
 * @returns {{ reminder?: Reminder, count?: string, at?: string }} Reminder, or errors.
 */
function readDraft(draft: ReminderDraft): { reminder?: Reminder; count?: string; at?: string } {
  const count = draft.count === '' ? null : Number(draft.count);
  if (!draft.onDay && count === null) return { count: 'Nombre attendu.' };
  const fields = draft.onDay
    ? { at: draft.at, anchor: draft.anchor }
    : draft.unit === 'days'
      ? { at: draft.at, days: count, anchor: draft.anchor }
      : { before: draft.unit === 'h' ? count! * 60 : count, anchor: draft.anchor };
  const parsed = reminderSchema.safeParse(fields);
  if (parsed.success) return { reminder: parsed.data };
  const errors: { count?: string; at?: string } = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === 'at') errors.at ??= issue.message;
    else errors.count ??= issue.message;
  }
  return errors;
}

/**
 * Keys of reminders, as one text (a list changed or not).
 * @param {readonly ReminderFields[]} reminders Reminders.
 * @returns {string} Keys.
 */
const keysOf = (reminders: readonly ReminderFields[]): string => normalizedReminders(readReminders(reminders)).map(reminderKey).join(',');

/**
 * The ringtone of each reminder chosen, folded under « Sonneries » to keep the editor light: « Celle des
 * réglages » or one of the bank.
 * @param {object} props Component props.
 * @param {Reminder[]} props.reminders Reminders chosen.
 * @param {(reminder: Reminder) => string} props.labelOf Label of a reminder.
 * @param {(reminders: Reminder[]) => void} props.onChange Reminders with the ringtone changed.
 * @param {boolean} [props.disabled] Read only. Optional.
 * @returns {JSX.Element} Ringtones.
 */
function ReminderRingtones({
  reminders,
  labelOf,
  onChange,
  disabled,
}: {
  reminders: Reminder[];
  labelOf: (reminder: Reminder) => string;
  onChange: (reminders: Reminder[]) => void;
  disabled?: boolean;
}) {
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
              <Text size="sm">{labelOf(reminder)}</Text>
              <RingtoneSelect
                size="xs"
                aria-label={`Sonnerie de « ${labelOf(reminder)} »`}
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
 * Anchors a row may count from: those offered, a time of the day telling only its day (the start or the end).
 * @param {readonly ReminderAnchor[]} anchors Anchors offered.
 * @param {boolean} atTime The row is at a time of the day.
 * @returns {ReminderAnchor[]} Anchors.
 */
const rowAnchors = (anchors: readonly ReminderAnchor[], atTime: boolean): ReminderAnchor[] => (atTime ? anchors.filter((anchor) => anchor === 'start' || anchor === 'end') : [...anchors]);

/**
 * Label of an anchor in the select of a row.
 * @param {ReminderTarget} target What the reminders are of.
 * @param {ReminderAnchor} anchor Anchor.
 * @param {'moment' | 'daysBefore' | 'on'} use Before a moment, some days before a day, on a day.
 * @returns {string} Label.
 */
const anchorLabel = (target: ReminderTarget, anchor: ReminderAnchor, use: 'moment' | 'daysBefore' | 'on'): string => anchorWords(target, anchor)?.[use] ?? anchor;

/**
 * « Rappels » of a task, a routine, an event, an éphéméride or a birthday, the one editor of all:
 * one row per reminder (10 at most), added and removed one by one, each with only the fields of its kind — « Le
 * jour J » (a time of the item's day), else a number and its unit (« min » / « h » avant a moment, « jours » avant a
 * day), the time « à HH:MM » of a reminder at a time, and what it counts from when the item has several anchors
 * (events: the start or the end; routines: the start or the end of the opening day or of the due day). Only the kinds
 * of the item are offered. Each reminder may name its ringtone (« Sonneries », folded). A row is kept once valid, on
 * leaving its fields or on a choice; its errors show under its fields once left (the messages of `reminderSchema`).
 * @param {RemindersSelectProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RemindersSelect({
  label,
  description,
  error,
  kinds = ['before', 'at', 'days'],
  anchors = ['start'],
  value,
  onChange,
  day = REMINDER_DAY,
  dayLabel = 'Le jour J',
  emptyLabel = 'Aucun rappel.',
  disabled = false,
  readOnly = false,
}: RemindersSelectProps) {
  const target = reminderTargetOf(anchors);
  /**
   * Rows of reminders.
   * @param {readonly ReminderFields[]} reminders Reminders.
   * @returns {ReminderDraft[]} Rows.
   */
  const draftsOf = (reminders: readonly ReminderFields[]) => normalizedReminders(readReminders(reminders)).map((reminder) => draftOf(reminder, nextDraftId++));
  const [drafts, setDrafts] = useState<ReminderDraft[]>(() => draftsOf(value));
  const sent = useRef(keysOf(value));
  const chosen = normalizedReminders(readReminders(value));
  const ringtones = new Map(chosen.flatMap((reminder) => (reminder.ringtone ? [[reminderKey(reminder), reminder.ringtone] as const] : [])));

  // Reminders changed elsewhere (another item of a selection, the API): the rows follow.
  const external = keysOf(value);
  useEffect(() => {
    if (external === sent.current) return;
    sent.current = external;
    setDrafts(draftsOf(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the reminders given change.
  }, [external]);

  const units: ReminderUnit[] = [...(kinds.includes('before') ? (['min', 'h'] as const) : []), ...(kinds.includes('days') ? (['days'] as const) : [])];
  const withDay = kinds.includes('at');
  const editable = !disabled && !readOnly;

  /**
   * Keeps rows, and sends the reminders of the valid ones when they changed (their ringtones kept by key).
   * @param {ReminderDraft[]} next Rows.
   * @param {boolean} send Send now (a choice, a row added or removed, a field left).
   * @returns {void}
   */
  const update = (next: ReminderDraft[], send: boolean) => {
    setDrafts(next);
    if (!send) return;
    const reminders = normalizedReminders(
      next.flatMap((draft) => {
        const { reminder } = readDraft(draft);
        if (!reminder) return [];
        const ringtone = ringtones.get(reminderKey(reminder));
        return [ringtone ? { ...reminder, ringtone } : reminder];
      }),
    );
    const keys = reminders.map(reminderKey).join(',');
    if (keys === sent.current) return;
    sent.current = keys;
    onChange(reminders);
  };

  /**
   * Changes a row.
   * @param {number} id Row.
   * @param {Partial<ReminderDraft>} patch Fields changed.
   * @param {boolean} send Send now.
   * @returns {void}
   */
  const change = (id: number, patch: Partial<ReminderDraft>, send: boolean) =>
    update(
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
      send,
    );

  /**
   * A new row: 15 min before the moment where there is one, else the day itself (or one day before) at 09:00.
   * @returns {ReminderDraft} Row.
   */
  const newDraft = (): ReminderDraft => ({
    id: nextDraftId++,
    onDay: !kinds.includes('before') && withDay,
    count: kinds.includes('before') ? 15 : 1,
    unit: units[0] ?? 'days',
    at: REMINDER_DAYS_TIME,
    anchor: 'start',
    touched: false,
  });

  const seen = new Set<string>();
  return (
    <LabeledField label={label} description={description} error={error} gap="xs">
      {drafts.length === 0 && (
        <Text size="sm" c="dimmed">
          {emptyLabel}
        </Text>
      )}
      {drafts.map((draft, index) => {
        const read = readDraft(draft);
        const key = read.reminder ? reminderKey(read.reminder) : null;
        const duplicate = key !== null && seen.has(key);
        if (key) seen.add(key);
        const atTime = draft.onDay || draft.unit === 'days';
        const options = rowAnchors(anchors, atTime);
        const anchor = read.reminder ? reminderAnchorOf(read.reminder) : options.includes(draft.anchor) ? draft.anchor : 'start';
        const use = draft.onDay ? 'on' : draft.unit === 'days' ? 'daysBefore' : 'moment';
        const shown = draft.touched;
        const name = `Rappel ${index + 1}`;
        /**
         * The row left: its errors show, it is sent when valid.
         * @returns {void}
         */
        const leave = () => change(draft.id, { touched: true }, true);
        return (
          <Stack key={draft.id} gap={2}>
            <Group gap="xs" align="flex-start" wrap="wrap">
              {withDay && units.length > 0 && (
                <Checkbox
                  mt={8}
                  label={dayLabel}
                  aria-label={`${dayLabel} (${name})`}
                  checked={draft.onDay}
                  disabled={!editable}
                  onChange={(event) => change(draft.id, { onDay: event.currentTarget.checked, ...(!event.currentTarget.checked && draft.unit !== 'days' && { at: REMINDER_DAYS_TIME }) }, true)}
                />
              )}
              {!draft.onDay && (
                <>
                  <NumberInput
                    aria-label={`Nombre (${name})`}
                    w={72}
                    min={draft.unit === 'days' ? 1 : 0}
                    allowDecimal={false}
                    allowNegative={false}
                    value={draft.count}
                    disabled={!editable}
                    onChange={(count) => change(draft.id, { count }, false)}
                    onBlur={leave}
                    error={shown ? read.count : undefined}
                  />
                  {units.length > 1 ? (
                    <Select
                      aria-label={`Unité (${name})`}
                      w={92}
                      allowDeselect={false}
                      data={units.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }))}
                      value={draft.unit}
                      disabled={!editable}
                      comboboxProps={{ withinPortal: false }}
                      onChange={(unit) => unit && change(draft.id, { unit: unit as ReminderUnit, ...(unit === 'days' && Number(draft.count) < 1 && { count: 1 }) }, true)}
                    />
                  ) : (
                    <Text size="sm" mt={8}>
                      {UNIT_LABELS[draft.unit]}
                    </Text>
                  )}
                  <Text size="sm" mt={8}>
                    avant
                  </Text>
                </>
              )}
              {options.length > 1 && (
                <Select
                  aria-label={`Depuis (${name})`}
                  w={draft.onDay || draft.unit === 'days' ? 170 : 210}
                  allowDeselect={false}
                  data={options.map((item) => ({ value: item, label: anchorLabel(target, item, use) }))}
                  value={anchor}
                  disabled={!editable}
                  comboboxProps={{ withinPortal: false }}
                  onChange={(item) => item && change(draft.id, { anchor: item as ReminderAnchor }, true)}
                />
              )}
              {atTime && (
                <>
                  <Text size="sm" mt={8}>
                    à
                  </Text>
                  <TimePicker
                    aria-label={`Heure (${name})`}
                    w={110}
                    value={draft.at}
                    disabled={!editable}
                    onChange={(at) => change(draft.id, { at }, false)}
                    onBlur={leave}
                    error={shown ? read.at : undefined}
                  />
                </>
              )}
              {editable && (
                <RemoveButton
                  label="Retirer"
                  aria-label={`Retirer le rappel ${index + 1}`}
                  onClick={() =>
                    update(
                      drafts.filter((item) => item.id !== draft.id),
                      true,
                    )
                  }
                />
              )}
            </Group>
            {duplicate && (
              <Text size="xs" c="red">
                {DUPLICATE}
              </Text>
            )}
          </Stack>
        );
      })}
      {editable && (
        <Group>
          <AddItemButton disabled={drafts.length >= REMINDERS_MAX} onClick={() => update([...drafts, newDraft()], true)}>
            Ajouter un rappel
          </AddItemButton>
        </Group>
      )}
      {chosen.length > 0 && (
        <ReminderRingtones
          reminders={chosen}
          labelOf={(reminder) => reminderLabel(reminder, { day, target })}
          onChange={(reminders) => {
            sent.current = keysOf(reminders);
            onChange(reminders);
          }}
          disabled={!editable}
        />
      )}
    </LabeledField>
  );
}
