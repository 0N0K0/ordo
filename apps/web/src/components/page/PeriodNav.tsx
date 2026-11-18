import { IconAction } from '../actions/IconAction';
import { Group } from '@mantine/core';
import { CaretLeftIcon, CaretRightIcon, CalendarDotIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';

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
      <ActionButton priority="secondary" icon={<CalendarDotIcon aria-hidden />} disabled={current} onClick={onToday}>
        Aujourd’hui
      </ActionButton>
      <Group gap={2} wrap="nowrap">
        <IconAction label={labels.previous} size="lg" onClick={onPrevious}>
          <CaretLeftIcon aria-hidden />
        </IconAction>
        {children}
        <IconAction label={labels.next} size="lg" disabled={last} onClick={onNext}>
          <CaretRightIcon aria-hidden />
        </IconAction>
      </Group>
    </Group>
  );
}
