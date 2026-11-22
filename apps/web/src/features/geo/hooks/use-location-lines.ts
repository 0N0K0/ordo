import { locationLines, usePlaces } from '../api';

/**
 * Lines of a location as a cell shows it, one under the other: a line per zone of a saved place, else its text.
 * @param {string | null} text Text of the location.
 * @returns {string[]} Lines.
 */
export function useLocationLines(text: string | null): string[] {
  const { data: places } = usePlaces();
  return locationLines(text, places ?? []);
}
