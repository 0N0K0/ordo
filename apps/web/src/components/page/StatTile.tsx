import { Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { TextSkeleton } from '../feedback/Skeletons';
import classes from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Detail under the value, in a color (red: something to do). */
  hint?: ReactNode;
  hintColor?: string;
  /** Color of the value (red: below zero). Optional. */
  valueColor?: string;
  to?: string;
  loading?: boolean;
}

/**
 * Key figure of the home page, linking to its page.
 * @param {StatTileProps} props Component props.
 * @returns {JSX.Element} Tile.
 */
export function StatTile({ label, value, hint, hintColor = 'dimmed', valueColor, to, loading }: StatTileProps) {
  const content = (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} truncate>
        {label}
      </Text>
      {loading ? (
        <TextSkeleton title lines={0} />
      ) : (
        <Text fw={700} fz="xl" lh={1.2} c={valueColor} truncate>
          {value}
        </Text>
      )}
      <Text size="xs" c={hintColor} truncate>
        {loading ? ' ' : (hint ?? ' ')}
      </Text>
    </Stack>
  );
  return to ? (
    <Paper withBorder radius="md" p="md" component={Link} to={to} className={classes.tile}>
      {content}
    </Paper>
  ) : (
    <Paper withBorder radius="md" p="md">
      {content}
    </Paper>
  );
}
