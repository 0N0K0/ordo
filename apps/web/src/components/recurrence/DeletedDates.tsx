import { Chip, Group, Stack, Text } from '@mantine/core';
import { formatLongDate } from './describe-recurrence';

/**
 * Occurrences deleted one by one from a repetition, each restored by a click; nothing without any.
 * @param {{ dates: readonly string[], onChange: (dates: string[]) => void }} props Deleted days and their change.
 * @returns {JSX.Element | null} List.
 */
export function DeletedDates({ dates, onChange }: { dates: readonly string[]; onChange: (dates: string[]) => void }) {
  if (!dates.length) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Dates supprimées
      </Text>
      <Group gap={6}>
        {dates.map((date) => (
          <Chip key={date} size="xs" checked={false} title="Rétablir cette date" onClick={() => onChange(dates.filter((item) => item !== date))}>
            {formatLongDate(date)} ×
          </Chip>
        ))}
      </Group>
    </Stack>
  );
}
