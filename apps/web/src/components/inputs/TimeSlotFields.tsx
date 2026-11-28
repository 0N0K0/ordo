import { Group, NumberInput, Select, Text } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { DAY_MINUTES, durationParts, END_AFTER_START, endDayText, timeSlotDuration, minutesToTime, timeSlotEnd, timeToMinutes, type TimeSlotEnd } from '@ordo/shared';
import { useState } from 'react';

/** A time slot: its start, its duration, and its end (the days after its start day: 0, the same day). */
export interface TimeSlotValue {
  start: string;
  minutes: number;
  end: TimeSlotEnd;
}

/** Ends offered after the start day: « le lendemain », « J+2 »… up to J+30. */
const MAX_END_DAYS = 30;

interface TimeSlotFieldsProps {
  /** Start and duration. */
  value: { start: string; minutes: number };
  /** Called with the start, the duration and the end once one of them changed (the others recomputed). */
  onChange: (value: TimeSlotValue) => void;
  /** What the slot is, in the accessible names (« cas 1 », « moment 2, cas 1 »). */
  name: string;
  /** The end on the start day only (hours of a day): no days in the duration, no day of the end. Optional. Default = false. */
  sameDay?: boolean;
  /** Called once a time or a number is left (a panel saved field by field saves then). Optional. */
  onCommit?: () => void;
}

/**
 * A time slot on one line, the same everywhere: « Début [HH:MM] Durée [j] [h] [min] Fin [HH:MM] [jour] ». The duration
 * and the end recompute each other, with no 24 h limit (« 22:00 » for 3 h ends « 01:00 » « le lendemain ») and no
 * locked field; changing the start keeps the duration; an end typed before the start moves to the next day. A time
 * typed is applied once its field is left (each digit typed is a change). With
 * `sameDay`, the end stays on its day: an end before the start shows « La fin doit suivre le début. » under it, once
 * a field is left.
 * @param {TimeSlotFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function TimeSlotFields({ value, onChange, name, sameDay = false, onCommit }: TimeSlotFieldsProps) {
  const [left, setLeft] = useState(false);
  // A time being typed (each digit is a change: « 2 » of « 21:00 » reads 02:00): applied once its field is left.
  const [typed, setTyped] = useState<{ field: 'start' | 'end'; time: string } | null>(null);
  // On its day only, the end is the one typed, even before the start (its error shown).
  const end = sameDay ? { time: minutesToTime(Math.min(DAY_MINUTES - 1, Math.max(0, timeToMinutes(value.start) + value.minutes))), days: 0 } : timeSlotEnd(value.start, value.minutes);
  const parts = durationParts(value.minutes);
  const invalid = value.minutes <= 0;
  /**
   * Gives a duration, its end recomputed.
   * @param {string} start Start.
   * @param {number} minutes Duration.
   * @returns {void}
   */
  const setDuration = (start: string, minutes: number) => {
    // On its day only: up to 23:59.
    const kept = sameDay ? Math.min(minutes, DAY_MINUTES - 1 - timeToMinutes(start)) : minutes;
    onChange({ start, minutes: kept, end: timeSlotEnd(start, kept) });
  };
  /**
   * Gives an end, its duration recomputed (on the same day only, with `sameDay`).
   * @param {TimeSlotEnd} next End.
   * @returns {void}
   */
  const setEnd = (next: TimeSlotEnd) => {
    if (sameDay) return onChange({ start: value.start, minutes: timeToMinutes(next.time) - timeToMinutes(value.start), end: { time: next.time, days: 0 } });
    const { minutes, days } = timeSlotDuration(value.start, next);
    onChange({ start: value.start, minutes, end: { time: next.time, days } });
  };
  /**
   * Gives a new start: the duration kept, or the end kept when it would leave its day (`sameDay`).
   * @param {string} start Start.
   * @returns {void}
   */
  const setStart = (start: string) => {
    if (!start) return;
    if (sameDay && timeSlotEnd(start, value.minutes).days > 0) return onChange({ start, minutes: timeToMinutes(end.time) - timeToMinutes(start), end: { time: end.time, days: 0 } });
    setDuration(start, value.minutes);
  };
  /**
   * Gives one part of the duration.
   * @param {'days' | 'hours' | 'minutes'} part Part.
   * @param {number | string} amount Its new amount.
   * @returns {void}
   */
  const setPart = (part: 'days' | 'hours' | 'minutes', amount: number | string) => {
    const next = { ...parts, [part]: Math.max(0, Number(amount) || 0) };
    setDuration(value.start, next.days * DAY_MINUTES + next.hours * 60 + next.minutes);
  };
  /**
   * Field left: its error shown from then on, and the change committed.
   * @returns {void}
   */
  const leave = () => {
    if (typed?.field === 'start') setStart(typed.time);
    if (typed?.field === 'end') setEnd({ time: typed.time, days: sameDay ? 0 : end.days });
    setTyped(null);
    setLeft(true);
    onCommit?.();
  };
  // Up to J+30, or further to its end.
  const days = Array.from({ length: Math.max(MAX_END_DAYS, end.days) + 1 }, (_, index) => ({ value: String(index), label: endDayText(index) }));
  return (
    <Group gap={6} wrap="wrap" align="flex-start">
      <TimePicker size="xs" label="Début" aria-label={`Début, ${name}`} value={typed?.field === 'start' ? typed.time : value.start} onChange={(time) => time && setTyped({ field: 'start', time })} onBlur={leave} />
      <Group gap={4} wrap="nowrap" align="flex-end">
        {!sameDay && (
          <NumberInput size="xs" w={64} label="Durée" aria-label={`Durée en jours, ${name}`} rightSection={<Text size="xs">j</Text>} min={0} max={366} allowDecimal={false} value={parts.days} onChange={(amount) => setPart('days', amount)} onBlur={leave} />
        )}
        <NumberInput
          size="xs"
          w={64}
          label={sameDay ? 'Durée' : undefined}
          aria-label={`Durée en heures, ${name}`}
          rightSection={<Text size="xs">h</Text>}
          min={0}
          max={sameDay ? 23 : 999}
          allowDecimal={false}
          value={parts.hours}
          onChange={(amount) => setPart('hours', amount)}
          onBlur={leave}
        />
        <NumberInput size="xs" w={72} aria-label={`Durée en minutes, ${name}`} rightSection={<Text size="xs">min</Text>} min={0} max={59} step={5} allowDecimal={false} value={parts.minutes} onChange={(amount) => setPart('minutes', amount)} onBlur={leave} />
      </Group>
      <Group gap={4} wrap="nowrap" align="flex-end">
        <TimePicker
          size="xs"
          label="Fin"
          aria-label={`Fin, ${name}`}
          value={typed?.field === 'end' ? typed.time : end.time}
          onChange={(time) => time && setTyped({ field: 'end', time })}
          onBlur={leave}
          error={left && invalid ? END_AFTER_START : undefined}
        />
        {!sameDay && (
          <Select
            size="xs"
            w={120}
            aria-label={`Jour de la fin, ${name}`}
            variant={end.days === 0 ? 'unstyled' : 'default'}
            allowDeselect={false}
            data={days}
            value={String(end.days)}
            onChange={(day) => {
              setEnd({ time: end.time, days: Number(day ?? 0) });
              onCommit?.();
            }}
          />
        )}
      </Group>
    </Group>
  );
}
