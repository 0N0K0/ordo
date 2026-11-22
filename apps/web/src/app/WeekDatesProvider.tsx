import { DatesProvider } from '@mantine/dates';
import type { ReactNode } from 'react';

/**
 * Date pickers in French, their weeks always from Monday to Sunday (the week of the workspace only sets the calendar
 * and the « this week » periods).
 * @param {{ children: ReactNode }} props Component props.
 * @returns {JSX.Element} Provider.
 */
export function WeekDatesProvider({ children }: { children: ReactNode }) {
  return <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>{children}</DatesProvider>;
}
