import { PeriodField } from './PeriodField';
import type { PeriodRange } from './use-period-range';

/**
 * « Dates » of an export: its days shown for a preset, chosen for « Dates choisies » (`PeriodField`, both days
 * required).
 * @param {{ range: PeriodRange<string> }} props Period (usePeriodRange).
 * @returns {JSX.Element} Field.
 */
export function PeriodRangeFields({ range }: { range: PeriodRange<string> }) {
  const { preset, setCustom, from, to } = range;
  return <PeriodField label="Dates" required disabled={preset !== 'custom'} value={[from, to]} onChange={([start, end]) => setCustom([start, end])} />;
}
