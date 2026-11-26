import { Badge, Tooltip, type MantineColor, type MantineSize } from '@mantine/core';

interface ProgressBadgeProps {
  /** How many are done. */
  done: number;
  /** Out of how many. */
  total: number;
  /** What it says, for the screen readers and as its tooltip (« 2 sous-routines faites sur 3 dues aujourd’hui »). */
  label: string;
  /** Optional. Default = « sm ». */
  size?: MantineSize;
  /** Colour while not all are done. Optional. Default = the primary colour. */
  color?: MantineColor;
  /** Shown with a total of none (« 0/0 »). Optional. Default = false: nothing. */
  withEmpty?: boolean;
}

/**
 * Progress « 2/3 », the same everywhere something is done out of a planned number (the routines of the day in the
 * menu, a parent routine from its sub-routines, a shopping list): light, green once all are done; its label as its
 * tooltip and for the screen readers. Nothing for a total of none, unless `withEmpty`.
 * @param {ProgressBadgeProps} props Component props.
 * @returns {JSX.Element | null} Badge.
 */
export function ProgressBadge({ done, total, label, size = 'sm', color, withEmpty = false }: ProgressBadgeProps) {
  if (total <= 0 && !withEmpty) return null;
  return (
    <Tooltip label={label} openDelay={400} withinPortal>
      {/* eslint-disable-next-line no-restricted-syntax -- ProgressBadge itself. */}
      <Badge size={size} variant="light" color={total > 0 && done >= total ? 'green' : color} aria-label={label}>
        {done}/{total}
      </Badge>
    </Tooltip>
  );
}
