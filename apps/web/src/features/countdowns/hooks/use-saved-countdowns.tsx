import { TextInput } from '@mantine/core';
import { durationText, isRingtone, parseDuration, readDeadTimes, savedCountdownFormSchema, type RingtoneId } from '@ordo/shared';
import { TimerIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { RingtoneSelect } from '../../../components/inputs/RingtoneSelect';
import { itemMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { unarchived } from '../../../lib/archive';
import { toastCallbacks } from '../../../lib/notify';
import { useWorkspaces } from '../../workspaces/api';
import { useCountdownMutations, useSavedCountdownMutations, useSavedCountdowns, type DeadTimeOutput, type SavedCountdown } from '../api';
import { countdownItemInput, countdownStartedMessage, timerLabel, type CountdownItem } from '../lib/countdowns';
import { openCountdownForm } from '../lib/open-countdown-form';

/** What an item launches: its dead times (each opens the form, its duration editable) and its saved timers (at once). */
export interface ItemLaunchers {
  deadTimes?: readonly DeadTimeOutput[];
  savedCountdownIds?: readonly string[];
}

/**
 * Saved timers of an item that can be started: those linked to it, in the order of the list, archived ones left out.
 * @param {readonly SavedCountdown[]} all Saved timers of the workspace.
 * @param {readonly string[]} ids Those linked to the item.
 * @returns {SavedCountdown[]} Saved timers.
 */
export function linkedSavedCountdowns(all: readonly SavedCountdown[], ids: readonly string[]): SavedCountdown[] {
  const linked = new Set(ids);
  return unarchived(all).filter((saved) => linked.has(saved.id));
}

/**
 * Starts a saved timer at once (its name, duration and ringtone), alone or for an item it is linked to; told in a toast.
 * @returns {(saved: SavedCountdown, item?: CountdownItem) => void} Start.
 */
export function useStartSavedCountdown() {
  const { start } = useCountdownMutations();
  const { data: spaces } = useWorkspaces();
  return (saved: SavedCountdown, item?: CountdownItem) =>
    start.mutate(
      { label: saved.label, seconds: saved.minutes * 60, ringtone: saved.ringtone, ...(item && countdownItemInput(item, spaces?.currentWorkspaceId)) },
      toastCallbacks(countdownStartedMessage(saved.minutes * 60)),
    );
}

/**
 * What an item launches, each with its label (« Lave-linge (1 h 30) ») and what it does: the dead times open the form
 * launching their timer, the saved timers start at once.
 * @returns {(launchers: ItemLaunchers, item: CountdownItem) => { deadTimes: object[], saved: object[] }} Launchers of an item.
 */
export function useItemLaunchers() {
  const { data: all = [] } = useSavedCountdowns();
  const startSaved = useStartSavedCountdown();
  return ({ deadTimes: value = [], savedCountdownIds = [] }: ItemLaunchers, item: CountdownItem) => {
    const deadTimes = readDeadTimes(value);
    return {
      deadTimes: deadTimes.map((deadTime) => ({ label: timerLabel(deadTime), launch: () => openCountdownForm({ item, deadTimes, deadTime }) })),
      saved: linkedSavedCountdowns(all, savedCountdownIds).map((saved) => ({ label: timerLabel(saved), launch: () => startSaved(saved, item) })),
    };
  };
}

/**
 * Entries of the « … » menu of an item (its row, its panel, its page): « Lancer « Lave-linge (1 h 30) » » under
 * « Temps morts » for each dead time, under « Minuteurs » for each saved timer. None without any.
 * @returns {(launchers: ItemLaunchers, item: CountdownItem) => RowMenuEntry[]} Entries of an item.
 */
export function useCountdownMenuEntries() {
  const launchersOf = useItemLaunchers();
  return (launchers: ItemLaunchers, item: CountdownItem): RowMenuEntry[] => {
    const { deadTimes, saved } = launchersOf(launchers, item);
    /**
     * A section of launchers, after a divider; nothing without any.
     * @param {string} section Title of the section.
     * @param {{ label: string, launch: () => void }[]} entries Launchers.
     * @returns {RowMenuEntry[]} Entries.
     */
    const sectionOf = (section: string, entries: { label: string; launch: () => void }[]): RowMenuEntry[] =>
      entries.length ? ['divider', { section }, ...entries.map(({ label, launch }) => ({ label: `Lancer « ${label} »`, icon: <TimerIcon aria-hidden />, onClick: launch }))] : [];
    return [...sectionOf('Temps morts', deadTimes), ...sectionOf('Minuteurs', saved)];
  };
}

/** Fields of the form of a saved timer beyond its name and color. */
export interface SavedCountdownExtra {
  /** Duration typed: « 9 », « 1:30 », « 1h30 ». */
  duration: string;
  ringtone: RingtoneId | null;
}

/**
 * Saved timers, for their settings list and their form: name, color, image, duration (typed, `parseDuration`) and
 * ringtone (« Celle des réglages » by default, with « Écouter »).
 * @returns {SettingsItemKind<SavedCountdown, SavedCountdownExtra>} List and form.
 */
export function useSavedCountdownItems(): SettingsItemKind<SavedCountdown, SavedCountdownExtra> {
  const { create, update } = useSavedCountdownMutations();
  return {
    kind: 'SAVED_COUNTDOWN',
    labelField: 'Nom',
    labelPlaceholder: 'Œufs durs, lessive, lave-vaisselle…',
    schema: savedCountdownFormSchema,
    extra: {
      initial: (saved) => ({ duration: durationText(saved?.minutes ?? 10), ringtone: isRingtone(saved?.ringtone) ? saved.ringtone : null }),
      render: (form) => (
        <>
          <TextInput label="Durée" required description="9, 1:30, 1h30 ou 1,5 h" {...form.getInputProps('duration')} />
          <RingtoneSelect label="Sonnerie" value={form.getValues().ringtone} onChange={(ringtone) => form.setFieldValue('ringtone', ringtone)} />
        </>
      ),
      onBlur: ['duration'],
    },
    ...itemMutations({ create, update }, (values: { label: string; color: string } & SavedCountdownExtra) => ({
      label: values.label,
      color: values.color,
      minutes: (parseDuration(values.duration) ?? 0) / 60,
      ringtone: values.ringtone,
    })),
  };
}
