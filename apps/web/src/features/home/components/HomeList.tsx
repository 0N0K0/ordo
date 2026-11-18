import { Box, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { plural } from '../../../lib/text';
import classes from './Home.module.css';

/** Rows shown at most in a list of a home card; the others are counted below. */
export const HOME_ROWS = 10;

interface HomeListProps<T> {
  items: T[];
  /** Row of an item (with its key). */
  render: (item: T) => ReactNode;
}

/**
 * List of a home card: its first rows, then « + N autres ».
 * @param {HomeListProps<T>} props Component props.
 * @returns {JSX.Element} List.
 */
export function HomeList<T>({ items, render }: HomeListProps<T>) {
  const more = items.length - HOME_ROWS;
  return (
    <Stack gap={0}>
      {items.slice(0, HOME_ROWS).map(render)}
      {more > 0 && (
        <Text size="xs" c="dimmed" pt={4}>
          + {more} {plural(more, 'autre')}
        </Text>
      )}
    </Stack>
  );
}

interface HomeRowProps {
  /** Page the row opens. */
  to: To;
  title: ReactNode;
  /** Line below the title, small. Optional. */
  subtitle?: ReactNode;
  /** Value on the right (amount, badge, date). Optional. */
  value?: ReactNode;
  /** Bold title and a subtitle not dimmed (an unread mail). Optional. */
  emphasis?: boolean;
}

/**
 * Row of a home card: a link with a title, a subtitle below and a value on the right.
 * @param {HomeRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function HomeRow({ to, title, subtitle, value, emphasis = false }: HomeRowProps) {
  return (
    <Link to={to} className={classes.row}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Stack gap={0} miw={0}>
          <Text size="sm" fw={emphasis ? 600 : undefined} truncate>
            {title}
          </Text>
          {subtitle && (
            <Text size="xs" c={emphasis ? undefined : 'dimmed'} truncate>
              {subtitle}
            </Text>
          )}
        </Stack>
        {value !== undefined && <Box style={{ flexShrink: 0 }}>{value}</Box>}
      </Group>
    </Link>
  );
}
