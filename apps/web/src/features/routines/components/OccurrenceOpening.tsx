import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Routine, RoutineOccurrence } from '../api';
import { occurrenceOpensWords } from '../lib/routine-view';

interface OccurrenceOpeningProps {
  /** Routine, as the screens read it (its inherited « Ouverture » included); none: nothing added. */
  routine: Routine | undefined;
  /** Occurrence: the day that identifies it, its due day, its first day, the day of its rule it was moved from; none: nothing added. */
  occurrence: (Pick<RoutineOccurrence, 'date' | 'dueDate' | 'startDate' | 'movedFrom'> & { ruleDueDate?: string }) | undefined;
  /** What shows its due day (a field, a line). */
  children: ReactNode;
}

/**
 * Due day of a routine occurrence with, under it, the help line saying when it opens (« Ouverte 3 jours avant (le 5
 * nov.) », « Ouverte dès la veille (le 4 nov.) », « Ouverte le jour même »); without « Ouverture », the due day alone.
 * @param {OccurrenceOpeningProps} props Component props.
 * @returns {JSX.Element} Due day and its opening.
 */
export function OccurrenceOpening({ routine, occurrence, children }: OccurrenceOpeningProps) {
  const line = routine && occurrence ? occurrenceOpensWords(routine, occurrence) : null;
  if (!line) return <>{children}</>;
  return (
    <Stack gap={4}>
      {children}
      <Text size="xs" c="dimmed">
        {line}
      </Text>
    </Stack>
  );
}
