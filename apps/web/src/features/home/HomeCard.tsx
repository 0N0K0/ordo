import { ActionIcon, Anchor, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { ArrowRightIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useContext, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DragHandleContext } from './drag-handle';
import classes from './Home.module.css';

interface HomeCardProps {
  title: string;
  icon: ReactNode;
  /** Page with everything, and its link label. */
  to?: string;
  linkLabel?: string;
  /** Skeleton while the data loads. */
  loading?: boolean;
  children: ReactNode;
}

/**
 * Card of the home page: a title with its icon, a link to the full page, and a condensed content; in a
 * sortable grid, a handle moves it.
 * @param {HomeCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
export function HomeCard({ title, icon, to, linkLabel = 'Tout voir', loading, children }: HomeCardProps) {
  const handle = useContext(DragHandleContext);
  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {handle && (
              <Tooltip label="Déplacer">
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Déplacer la carte ${title}`} className={classes.handle} {...handle.attributes} {...handle.listeners}>
                  <DotsSixVerticalIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            )}
            <ThemeIcon variant="light" radius="md">
              {icon}
            </ThemeIcon>
            <Title order={2} size="h4">
              {title}
            </Title>
          </Group>
          {to && (
            <Anchor component={Link} to={to} size="sm">
              <Group gap={4} wrap="nowrap">
                {linkLabel}
                <ArrowRightIcon aria-hidden />
              </Group>
            </Anchor>
          )}
        </Group>
        {loading ? (
          <Stack gap="xs">
            <Skeleton height={20} />
            <Skeleton height={20} />
            <Skeleton height={20} />
          </Stack>
        ) : (
          children
        )}
      </Stack>
    </Paper>
  );
}

interface HomeEmptyProps {
  icon: ReactNode;
  children: ReactNode;
}

/**
 * Empty content of a card.
 * @param {HomeEmptyProps} props Component props.
 * @returns {JSX.Element} Message.
 */
export function HomeEmpty({ icon, children }: HomeEmptyProps) {
  return (
    <Group gap="xs" c="dimmed" wrap="nowrap" py="xs">
      {icon}
      <Text size="sm">{children}</Text>
    </Group>
  );
}

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Detail under the value, in a color (red: something to do). */
  hint?: ReactNode;
  hintColor?: string;
  to?: string;
  loading?: boolean;
}

/**
 * Key figure of the home page, linking to its page.
 * @param {StatTileProps} props Component props.
 * @returns {JSX.Element} Tile.
 */
export function StatTile({ label, value, hint, hintColor = 'dimmed', to, loading }: StatTileProps) {
  const content = (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} truncate>
        {label}
      </Text>
      {loading ? (
        <Skeleton height={28} width="70%" />
      ) : (
        <Text fw={700} fz="xl" lh={1.2} truncate>
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

/**
 * Small figure of a card.
 * @param {{ label: string, value: ReactNode, color?: string }} props Component props.
 * @returns {JSX.Element} Figure.
 */
export function Figure({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Stack gap={0} miw={0}>
      <Text size="xs" c="dimmed" truncate>
        {label}
      </Text>
      <Text fw={600} c={color} truncate>
        {value}
      </Text>
    </Stack>
  );
}
