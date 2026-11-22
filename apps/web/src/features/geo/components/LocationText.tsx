import { StackedLines } from '../../../components/data-table/cells/StackedValues';
import { useLocationLines } from '../hooks/use-location-lines';

/**
 * Location of a row shown read only: its zones of a saved place one under the other, else its text.
 * @param {{ location: string | null, size?: 'xs' | 'sm', c?: string }} props Text of the location, size and color of its text (optional, default = « sm », the text's).
 * @returns {JSX.Element} Location.
 */
export function LocationText({ location, size = 'sm', c }: { location: string | null; size?: 'xs' | 'sm'; c?: string }) {
  return <StackedLines lines={useLocationLines(location)} size={size} c={c} />;
}
