import { SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { dateRangeProps } from './date-range';
import type { PeriodRange } from './use-period-range';

/**
 * « Du » and « Au » of an export period: shown for a preset, typed for « Dates choisies », the end following the
 * start (dateRangeProps).
 * @param {{ range: PeriodRange<string> }} props Period (usePeriodRange).
 * @returns {JSX.Element} Fields.
 */
export function PeriodRangeFields({ range }: { range: PeriodRange<string> }) {
  const { preset, setCustom, from, to } = range;
  const bounds = dateRangeProps({ value: [from, to], onChange: setCustom });
  return (
    <SimpleGrid cols={2}>
      <DatePickerInput label="Du" disabled={preset !== 'custom'} {...bounds.start} />
      <DatePickerInput label="Au" disabled={preset !== 'custom'} {...bounds.end} />
    </SimpleGrid>
  );
}
