import { Group, Stack, TextInput } from '@mantine/core';
import { DEAD_TIMES_MAX, DURATION_TEXT_INVALID, durationText, isRingtone, parseDuration, readDeadTimes, type DeadTime, type RingtoneId } from '@ordo/shared';
import { TimerIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { IconAction } from '../../../components/actions/IconAction';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { RingtoneSelect } from '../../../components/inputs/RingtoneSelect';
import { useCountdowns, type DeadTimeOutput } from '../api';
import { countdownOf, type CountdownItem } from '../lib/countdowns';
import { openCountdownForm } from '../lib/open-countdown-form';
import { CountdownRow } from './CountdownRow';

/** A dead time as typed: its duration as text, until it is valid. */
interface DeadTimeRow {
  key: number;
  label: string;
  duration: string;
  ringtone: RingtoneId | null;
  /** Fields left once (their errors shown). */
  touched: boolean;
}

/** Label of a dead time left empty. */
const LABEL_REQUIRED = 'Le libellé est requis.';

let rowCount = 0;

/**
 * A row of the editor from a dead time saved.
 * @param {DeadTime} deadTime Dead time.
 * @returns {DeadTimeRow} Row.
 */
const rowOf = (deadTime: DeadTime): DeadTimeRow => ({ key: (rowCount += 1), label: deadTime.label, duration: durationText(deadTime.minutes), ringtone: deadTime.ringtone ?? null, touched: false });

/**
 * The dead time of a row, null while it is not valid (no label, a duration not understood).
 * @param {DeadTimeRow} row Row.
 * @returns {DeadTime | null} Dead time.
 */
function deadTimeOf(row: DeadTimeRow): DeadTime | null {
  const seconds = parseDuration(row.duration);
  if (!row.label.trim() || !seconds) return null;
  return { label: row.label.trim(), minutes: Math.round(seconds / 60), ...(row.ringtone && { ringtone: row.ringtone }) };
}

interface DeadTimesFieldProps {
  /** Dead times saved. */
  value: readonly (DeadTime | DeadTimeOutput)[];
  /** Saves the dead times (each change validated: a row not valid yet is not saved). */
  onChange: (deadTimes: DeadTime[]) => void;
  /** Item they belong to (« Lancer » launches a timer for it); none: a new item (nothing to launch yet). */
  item: CountdownItem | null;
  disabled?: boolean;
}

/**
 * « Temps morts » of a task or a routine: waits during which something else is done (« Lave-linge,
 * 1 h 30 »), with the ringtone at their end; not time spent. Each is saved once valid, on leaving its fields
 * (one left invalid holds the save, its error under it); « Lancer » opens the form launching its timer (its duration editable), and the timers launched for the item
 * show under them.
 * @param {DeadTimesFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function DeadTimesField({ value, onChange, item, disabled = false }: DeadTimesFieldProps) {
  const saved = readDeadTimes(value);
  const savedKey = JSON.stringify(saved);
  const [rows, setRows] = useState<DeadTimeRow[]>(() => saved.map(rowOf));
  const { data: countdowns } = useCountdowns();
  const launched = item ? (countdowns ?? []).filter((countdown) => countdownOf(countdown, item)) : [];

  // Saved elsewhere (another tab, an undo): the rows saved follow, those being typed stay; a save of these rows keeps
  // them as they are (the focus stays).
  const [followed, setFollowed] = useState(savedKey);
  if (followed !== savedKey) {
    setFollowed(savedKey);
    if (JSON.stringify(rows.flatMap((row) => deadTimeOf(row) ?? [])) !== savedKey) setRows([...saved.map(rowOf), ...rows.filter((row) => !deadTimeOf(row))]);
  }

  /**
   * Saves the valid rows, when they changed; a row left invalid (its error under it) holds the save until it is put
   * right or removed (a new row not left yet does not).
   * @param {DeadTimeRow[]} next Rows.
   * @returns {void}
   */
  const commit = (next: DeadTimeRow[]) => {
    if (next.some((row) => row.touched && !deadTimeOf(row))) return;
    const deadTimes = next.flatMap((row) => deadTimeOf(row) ?? []);
    if (JSON.stringify(deadTimes) !== savedKey) onChange(deadTimes);
  };

  /**
   * Changes a row (saved at once when `save`).
   * @param {number} key Row.
   * @param {Partial<DeadTimeRow>} change Change.
   * @param {boolean} [save] Saved now. Optional. Default = false.
   * @returns {void}
   */
  const change = (key: number, change: Partial<DeadTimeRow>, save = false) => {
    const next = rows.map((row) => (row.key === key ? { ...row, ...change } : row));
    setRows(next);
    if (save) commit(next);
  };

  return (
    <LabeledField label="Temps morts" description="Attentes pendant lesquelles vous faites autre chose (lave-linge…) : un minuteur sonne à la fin. Ce n’est pas du temps passé." gap="xs">
      {rows.map((row) => {
        const deadTime = deadTimeOf(row);
        return (
          <Stack key={row.key} gap={4}>
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                size="xs"
                flex={1}
                aria-label="Libellé du temps mort"
                placeholder="Lave-linge"
                disabled={disabled}
                value={row.label}
                error={row.touched && !row.label.trim() ? LABEL_REQUIRED : undefined}
                onChange={(event) => change(row.key, { label: event.currentTarget.value })}
                onBlur={() => change(row.key, { touched: true }, true)}
              />
              <TextInput
                size="xs"
                w={88}
                aria-label="Durée estimée"
                placeholder="1:30"
                disabled={disabled}
                value={row.duration}
                error={row.touched && !parseDuration(row.duration) ? DURATION_TEXT_INVALID : undefined}
                onChange={(event) => change(row.key, { duration: event.currentTarget.value })}
                onBlur={() => change(row.key, { touched: true }, true)}
              />
            </Group>
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <RingtoneSelect
                size="xs"
                flex={1}
                aria-label={`Sonnerie de « ${row.label || 'temps mort'} »`}
                disabled={disabled}
                value={row.ringtone}
                comboboxProps={{ withinPortal: false }}
                onChange={(ringtone) => change(row.key, { ringtone: isRingtone(ringtone) ? ringtone : null }, true)}
              />
              <Group gap={4} wrap="nowrap">
                <IconAction
                  label="Lancer"
                  item={row.label || undefined}
                  hint={!item ? 'Enregistrez d’abord l’élément.' : !deadTime ? 'Donnez-lui un libellé et une durée.' : 'Lancer le minuteur de ce temps mort.'}
                  disabled={disabled || !item || !deadTime}
                  onClick={() => item && deadTime && openCountdownForm({ item, deadTimes: saved, deadTime: saved.find((other) => JSON.stringify(other) === JSON.stringify(deadTime)) ?? deadTime })}
                >
                  <TimerIcon aria-hidden />
                </IconAction>
                <RemoveButton
                  label="Retirer"
                  item={row.label || 'le temps mort'}
                  disabled={disabled}
                  onClick={() => {
                    const next = rows.filter((other) => other.key !== row.key);
                    setRows(next);
                    commit(next);
                  }}
                />
              </Group>
            </Group>
          </Stack>
        );
      })}
      {!disabled && rows.length < DEAD_TIMES_MAX && (
        <AddItemButton onClick={() => setRows((current) => [...current, { key: (rowCount += 1), label: '', duration: durationText(30), ringtone: null, touched: false }])}>
          Ajouter un temps mort
        </AddItemButton>
      )}
      {launched.map((countdown) => (
        <CountdownRow key={countdown.id} countdown={countdown} withSubject={false} />
      ))}
    </LabeledField>
  );
}
