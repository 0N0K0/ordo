import { DatesProvider } from '@mantine/dates';
import { readWeek } from '@ordo/shared';
import type { ReactNode } from 'react';
import { useActiveWorkspace } from '../features/workspaces/api';
import { pickerFirstDay } from '../lib/week';

/**
 * Date pickers in French, their weeks starting on the first day of those of the workspace.
 * @param {{ children: ReactNode }} props Component props.
 * @returns {JSX.Element} Provider.
 */
export function WeekDatesProvider({ children }: { children: ReactNode }) {
  const { workspace } = useActiveWorkspace();
  return <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: workspace ? pickerFirstDay(readWeek(workspace)) : 1 }}>{children}</DatesProvider>;
}
