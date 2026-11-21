import { Group, Popover, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ReactNode } from 'react';
import classes from './RunningPill.module.css';

interface RunningPillProps {
  /** Name of the button opening the details (screen readers): « Détails du chrono ». */
  label: string;
  /** What runs: a time chrono (red dot) or a timer counting down (orange dot). Optional. Default = chrono. */
  tone?: 'chrono' | 'countdown';
  /** Paused: the dot greyed, still. Optional. */
  paused?: boolean;
  /** What it runs on, before the clock (hidden on a phone). Optional. */
  subject?: ReactNode;
  /** Clock (time spent, time left) or count. */
  clock: ReactNode;
  /** Details shown in the popover the pill opens. */
  details: ReactNode;
  /** Width of the popover. Optional. Default = 380. */
  detailsWidth?: number;
  /** Commands after the pill (pause, stop). Optional. */
  controls?: ReactNode;
}

/**
 * Pill of the app header for what runs (decision FT), the same for the time chronos and the timers: a pulsing dot, what
 * it runs on and its clock (opening its details), then its commands.
 * @param {RunningPillProps} props Component props.
 * @returns {JSX.Element} Pill.
 */
export function RunningPill({ label, tone = 'chrono', paused = false, subject, clock, details, detailsWidth = 380, controls }: RunningPillProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  return (
    <Group gap={4} wrap="nowrap" className={classes.running} data-paused={paused || undefined} data-tone={tone}>
      <Popover opened={opened} onChange={(value) => !value && close()} width={detailsWidth} position="bottom-end" shadow="md" trapFocus>
        <Popover.Target>
          <UnstyledButton className={classes.summary} onClick={toggle} aria-label={label}>
            <span className={classes.dot} aria-hidden />
            {subject && (
              <Text size="sm" truncate maw={160} visibleFrom="sm">
                {subject}
              </Text>
            )}
            <Text size="sm" ff="monospace" fw={600}>
              {clock}
            </Text>
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown>{details}</Popover.Dropdown>
      </Popover>
      {controls}
    </Group>
  );
}
