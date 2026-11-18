import { Box, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { plural } from '../../../lib/text';
import classes from './Home.module.css';
import tile from '../../../components/page/StatTile.module.css';
import { groupBy } from '@ordo/shared';
import { SubSection } from '../../../components/page/SubSection';

/** Rows shown at most in a list of a home card; the others are counted below. */
export const HOME_ROWS = 10;

interface HomeListProps<T> {
  items: T[];
  /** Row of an item (with its key). */
  render: (item: T) => ReactNode;
  /** Groups of the rows shown (the items sorted by it): its key and its title (a day). Optional. */
  group?: { key: (item: T) => string; title: (key: string) => ReactNode };
}

/**
 * List of a home card: its first rows (under the titles of their groups), then « + N autres ».
 * @param {HomeListProps<T>} props Component props.
 * @returns {JSX.Element} List.
 */
export function HomeList<T>({ items, render, group }: HomeListProps<T>) {
  const more = items.length - HOME_ROWS;
  const shown = items.slice(0, HOME_ROWS);
  return (
    <Stack gap={group ? 'sm' : 0}>
      {group
        ? [...groupBy(shown, group.key)].map(([key, rows]) => (
            <SubSection key={key} title={group.title(key)} gap={0}>
              {rows.map(render)}
            </SubSection>
          ))
        : shown.map(render)}
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
  label: ReactNode;
  /** Line below the label, small. Optional. */
  subtitle?: ReactNode;
  /** Value on the right (amount, badge, date). Optional. */
  value?: ReactNode;
  /** Bold label and a subtitle not dimmed (an unread mail). Optional. */
  emphasis?: boolean;
}

/**
 * Row of a home card: a link with a label, a subtitle below and a value on the right.
 * @param {HomeRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function HomeRow({ to, label, subtitle, value, emphasis = false }: HomeRowProps) {
  return (
    <Link to={to} className={`${tile.tile} ${classes.row}`}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Stack gap={0} miw={0}>
          <Text size="sm" fw={emphasis ? 600 : undefined} truncate>
            {label}
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
