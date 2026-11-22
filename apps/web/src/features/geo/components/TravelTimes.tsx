import { SimpleGrid, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { GeoPoint } from '@ordo/shared';
import { TravelCalculator } from './TravelCalculator';
import { TravelField } from './TravelField';

/** Travel times of an event or a routine, in minutes. */
interface Travels {
  travelBefore: number;
  travelAfter: number;
}

interface TravelTimesProps {
  value: Travels;
  /** Help under each way (« Pour y aller », « Avant le début »…). */
  hints: [before: string, after: string];
  /** Point of the place, the calculator's destination. */
  point: GeoPoint | null;
  onChange: (changes: Partial<Travels>) => void;
  /** Saves fields now, in a panel saved field by field: a time once left, both once computed. Optional. */
  onCommit?: (fields: (keyof Travels)[]) => void;
  errors?: Partial<Record<keyof Travels, ReactNode>>;
  /** When to leave (« Partir à 8 h 05… »): told only once an outward travel is given. Optional. */
  leave?: string | null;
}

/**
 * Travel times there and back of an event or a routine, with the calculator from its place, and when to leave once an
 * outward travel is given.
 * @param {TravelTimesProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function TravelTimes({ value, hints, point, onChange, onCommit, errors, leave }: TravelTimesProps) {
  return (
    <Stack gap="xs">
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <TravelField way="before" description={hints[0]} value={value.travelBefore} onChange={(next) => onChange({ travelBefore: Number(next) || 0 })} onBlur={() => onCommit?.(['travelBefore'])} error={errors?.travelBefore} />
        <TravelField way="after" description={hints[1]} value={value.travelAfter} onChange={(next) => onChange({ travelAfter: Number(next) || 0 })} onBlur={() => onCommit?.(['travelAfter'])} error={errors?.travelAfter} />
      </SimpleGrid>
      <div>
        <TravelCalculator
          eventPoint={point}
          onResult={({ before, after }) => {
            onChange({ ...(before !== undefined && { travelBefore: before }), ...(after !== undefined && { travelAfter: after }) });
            onCommit?.(['travelBefore', 'travelAfter']);
          }}
        />
      </div>
      {value.travelBefore > 0 && leave && (
        <Text size="sm" c="dimmed">
          {leave}
        </Text>
      )}
    </Stack>
  );
}
