import { IconAction } from '../../../components/actions/IconAction';
import { Collapse, Paper } from '@mantine/core';
import { SlidersHorizontalIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface LookToggleProps {
  /** Tooltip. */
  label: string;
  /** For the screen readers (« Affichage de … »). */
  ariaLabel: string;
  opened: boolean;
  onToggle: () => void;
}

/**
 * Button showing or hiding the display settings of a kind of slots (its color and look in the calendar).
 * @param {LookToggleProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function LookToggle({ label, ariaLabel, opened, onToggle }: LookToggleProps) {
  return (
    <IconAction label={label} variant={opened ? 'light' : 'subtle'} aria-label={ariaLabel} aria-expanded={opened} onClick={onToggle}>
      <SlidersHorizontalIcon aria-hidden />
    </IconAction>
  );
}

/**
 * Display settings opened by a LookToggle, on a tinted background.
 * @param {{ opened: boolean, children: ReactNode }} props Component props: shown, and the settings.
 * @returns {JSX.Element} Panel.
 */
export function LookPanel({ opened, children }: { opened: boolean; children: ReactNode }) {
  return (
    <Collapse expanded={opened}>
      <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
        {children}
      </Paper>
    </Collapse>
  );
}
