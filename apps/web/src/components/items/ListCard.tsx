import { Paper } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './ListCard.module.css';

interface ListCardProps {
  children: ReactNode;
  /** Opens what the card tells (a side panel): the whole card is then a button. Optional. */
  onClick?: () => void;
  /** Accessible name of the card as a button. Optional. Default = its text. */
  label?: string;
  /** Muted (an item turned off). Optional. Default = false. */
  muted?: boolean;
}

/**
 * A card of a list of cards, stacked one under the other (the columns of the page « Alarmes »: an alarm, a saved
 * timer, a reminder to come), the same everywhere: bordered, rounded, padded; muted for an item turned off; with
 * `onClick`, the whole card is a button (tinted under the pointer, outlined on keyboard focus).
 * @param {ListCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function ListCard({ children, onClick, label, muted = false }: ListCardProps) {
  const className = [classes.root, muted && classes.muted, onClick && classes.clickable].filter(Boolean).join(' ');
  if (onClick)
    return (
      <Paper component="button" type="button" withBorder radius="md" p="md" className={className} onClick={onClick} aria-label={label}>
        {children}
      </Paper>
    );
  return (
    <Paper withBorder radius="md" p="md" className={className}>
      {children}
    </Paper>
  );
}
