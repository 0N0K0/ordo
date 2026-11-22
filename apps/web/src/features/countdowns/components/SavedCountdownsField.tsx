import type { QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { listSelectProps } from '../../../components/items/item-look';
import { onMutationError } from '../../../lib/notify';
import { useSavedCountdowns, useSetSavedCountdownLinks, type SavedCountdownTarget } from '../api';
import { timerLabel } from '../lib/countdowns';

interface SavedCountdownsFieldProps {
  /** Kind of the item. */
  target: SavedCountdownTarget;
  /** Item; none: a new one (saved first). */
  id: string | null;
  /** Saved timers linked to it. */
  value: readonly string[];
  /** Queries showing the item, reloaded once saved. */
  invalidate: readonly QueryKey[];
  /** Read only (an archived item). Optional. Default = false. */
  readOnly?: boolean;
  /** Help under the label. Optional. Default = what they are for. */
  description?: string;
  /** Told the saved timers once saved (a panel not following the cache keeps them). Optional. */
  onSaved?: (ids: string[]) => void;
}

/**
 * Field « Minuteurs » of a task, a routine, an event or a sheet: the saved timers of the workspace it launches (its
 * « … » menu, or its buttons, starts them at once, the timer linked to the item), saved as soon as they change; an
 * archived saved timer is not offered (one already there stays). Shown at once as chosen, put back on a failure; a value
 * changed elsewhere is taken.
 * @param {SavedCountdownsFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function SavedCountdownsField({ target, id, value, invalidate, readOnly = false, description = 'Minuteurs enregistrés lancés depuis son menu « … ».', onSaved }: SavedCountdownsFieldProps) {
  const { data: all = [] } = useSavedCountdowns();
  const setLinks = useSetSavedCountdownLinks(invalidate);
  const [chosen, setChosen] = useState<readonly string[]>(value);
  const [given, setGiven] = useState(value);
  // A value saved elsewhere (or reloaded) replaces the one shown.
  if (given.join() !== value.join()) {
    setGiven(value);
    setChosen(value);
  }

  /**
   * Shows and saves the saved timers chosen; a failure puts them back, in an error toast.
   * @param {string[]} savedCountdownIds Saved timers.
   * @returns {void}
   */
  const save = (savedCountdownIds: string[]) => {
    if (!id) return;
    const before = chosen;
    setChosen(savedCountdownIds);
    setLinks.mutate(
      { target, id, savedCountdownIds },
      {
        onSuccess: () => onSaved?.(savedCountdownIds),
        onError: (error) => {
          setChosen(before);
          onMutationError(error);
        },
      },
    );
  };
  return (
    <BatchMultiSelect
      label="Minuteurs"
      description={id ? description : 'Enregistrez d’abord l’élément.'}
      placeholder={chosen.length ? undefined : 'Aucun'}
      searchable
      clearable={!readOnly}
      readOnly={readOnly}
      disabled={!id}
      nothingFoundMessage="Aucun minuteur enregistré"
      {...listSelectProps(all, timerLabel, chosen)}
      value={[...chosen]}
      onChange={save}
    />
  );
}
