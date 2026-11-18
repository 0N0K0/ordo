import * as fmt from '../../lib/format';
import { LabeledField } from '../inputs/LabeledField';
import { Chip, Group } from '@mantine/core';

/**
 * Occurrences deleted one by one from a repetition, each restored by a click; nothing without any.
 * @param {{ dates: readonly string[], onChange: (dates: string[]) => void }} props Deleted days and their change.
 * @returns {JSX.Element | null} List.
 */
export function DeletedDates({ dates, onChange }: { dates: readonly string[]; onChange: (dates: string[]) => void }) {
  if (!dates.length) return null;
  return (
    <LabeledField label="Dates supprimées">
      <Group gap={6}>
        {dates.map((date) => (
          <Chip key={date} size="xs" checked={false} title="Rétablir cette date" onClick={() => onChange(dates.filter((item) => item !== date))}>
            {fmt.dayInWords(date)} ×
          </Chip>
        ))}
      </Group>
    </LabeledField>
  );
}
