import { SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { PeriodRange } from './use-period-range';

/**
 * « Du » and « Au » of an export period: shown for a preset, typed for « Dates choisies », the end checked against
 * the start.
 * @param {{ range: PeriodRange<string> }} props Period (usePeriodRange).
 * @returns {JSX.Element} Fields.
 */
export function PeriodRangeFields({ range }: { range: PeriodRange<string> }) {
  const { preset, custom, setCustom, from, to } = range;
  return (
    <SimpleGrid cols={2}>
      <DatePickerInput label="Du" value={from} disabled={preset !== 'custom'} onChange={(value) => setCustom([value, custom[1]])} />
      <DatePickerInput
        label="Au"
        value={to}
        disabled={preset !== 'custom'}
        onChange={(value) => setCustom([custom[0], value])}
        error={from && to && from > to ? 'Avant la date de début.' : undefined}
      />
    </SimpleGrid>
  );
}
