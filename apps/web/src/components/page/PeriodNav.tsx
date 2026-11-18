import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { CaretLeftIcon, CaretRightIcon, CalendarDotIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface PeriodNavProps {
  /** The period shown (its name, or a picker of it). */
  children: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  /** Back to today's period. */
  onToday: () => void;
  /** Today's period is shown (« Aujourd’hui » is disabled). Optional. Default = false. */
  current?: boolean;
  /** No period after (the future is not shown). Optional. Default = false. */
  last?: boolean;
  /** What is moved, for the labels of the arrows: « Période précédente », « Jour précédent ». Optional. */
  labels?: { previous: string; next: string };
}

/**
 * Navigation between periods (the calendar, the chart of the treasury, the history of the routines), the same
 * everywhere: « Aujourd’hui », then the previous period, the one shown and the next one.
 * @param {PeriodNavProps} props Component props.
 * @returns {JSX.Element} Navigation.
 */
export function PeriodNav({ children, onPrevious, onNext, onToday, current = false, last = false, labels = { previous: 'Période précédente', next: 'Période suivante' } }: PeriodNavProps) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Button variant="default" leftSection={<CalendarDotIcon aria-hidden />} disabled={current} onClick={onToday}>
        Aujourd’hui
      </Button>
      <Group gap={2} wrap="nowrap">
        <Tooltip label={labels.previous}>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label={labels.previous} onClick={onPrevious}>
            <CaretLeftIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        {children}
        <Tooltip label={labels.next}>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label={labels.next} disabled={last} onClick={onNext}>
            <CaretRightIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
