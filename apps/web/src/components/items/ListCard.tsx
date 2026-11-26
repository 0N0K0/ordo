import { Paper, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './ListCard.module.css';

/** What a card opens: a click on it, named for the screen readers (its content stays plain text, outside the button). */
type ListCardOpen = { onClick: () => void; label: string } | { onClick?: undefined; label?: undefined };

type ListCardProps = ListCardOpen & {
  children: ReactNode;
  /** Muted (an item turned off). Optional. Default = false. */
  muted?: boolean;
};

/**
 * A card of a list of cards, stacked one under the other (the columns of the page « Alarmes »: an alarm, a saved
 * timer, a reminder to come), the same everywhere: bordered, rounded, padded; muted for an item turned off. With
 * `onClick`, a button named `label` covers the whole card (its content is not inside the button, so it may hold any
 * block): tinted under the pointer, outlined on keyboard focus.
 * @param {ListCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function ListCard({ children, onClick, label, muted = false }: ListCardProps) {
  const className = [classes.root, muted && classes.muted, onClick && classes.clickable].filter(Boolean).join(' ');
  return (
    <Paper withBorder radius="md" p="md" className={className}>
      {onClick && <UnstyledButton className={classes.cover} onClick={onClick} aria-label={label} />}
      {children}
    </Paper>
  );
}
