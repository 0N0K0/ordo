import type { QueryKey } from '@tanstack/react-query';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { listSelectProps } from '../../../components/items/item-look';
import { ON_ERROR } from '../../../lib/notify';
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
}

/**
 * Field « Minuteurs » of a task, a routine, an event or a sheet: the saved timers of the workspace it launches (its
 * « … » menu, or its buttons, starts them at once, the timer linked to the item), saved as soon as they change; an
 * archived saved timer is not offered (one already there stays).
 * @param {SavedCountdownsFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function SavedCountdownsField({ target, id, value, invalidate, readOnly = false, description = 'Minuteurs enregistrés lancés depuis son menu « … ».' }: SavedCountdownsFieldProps) {
  const { data: all = [] } = useSavedCountdowns();
  const setLinks = useSetSavedCountdownLinks(invalidate);
  return (
    <BatchMultiSelect
      label="Minuteurs"
      description={id ? description : 'Enregistrez d’abord l’élément.'}
      placeholder={value.length ? undefined : 'Aucun'}
      searchable
      clearable={!readOnly}
      readOnly={readOnly}
      disabled={!id}
      nothingFoundMessage="Aucun minuteur enregistré"
      {...listSelectProps(all, timerLabel, value)}
      value={[...value]}
      onChange={(savedCountdownIds) => id && setLinks.mutate({ target, id, savedCountdownIds }, ON_ERROR)}
    />
  );
}
