import { Checkbox } from '@mantine/core';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { toggledIn } from '../../../lib/sets';

interface HiddenChecklistProps {
  /** Title of the list (« Calendriers »). */
  label: string;
  /** Said when there is nothing to show (« Aucun calendrier. »). */
  empty: string;
  /** What can be shown, each in its colour. */
  choices: readonly { id: string; label: string; color: string }[];
  /** Those hidden. */
  hidden: ReadonlySet<string>;
  /** Nothing can be chosen (their layer is hidden). Optional. */
  disabled?: boolean;
  /** Called with those hidden once one is ticked or unticked. */
  onChange: (hidden: string[]) => void;
}

/**
 * List of what the agenda shows (calendars, slots), each ticked when shown; kept as those hidden.
 * @param {HiddenChecklistProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function HiddenChecklist({ label, empty, choices, hidden, disabled, onChange }: HiddenChecklistProps) {
  return (
    <LabeledField label={label} gap="xs">
      {choices.length === 0 ? (
        <EmptyState compact message={empty} />
      ) : (
        choices.map((choice) => (
          <Checkbox key={choice.id} color={choice.color} label={choice.label} disabled={disabled} checked={!hidden.has(choice.id)} onChange={() => onChange([...toggledIn(hidden, choice.id)])} />
        ))
      )}
    </LabeledField>
  );
}
