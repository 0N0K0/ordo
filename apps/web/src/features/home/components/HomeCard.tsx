import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Anchor, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { DragHandle } from '../../../components/actions/DragHandle';
import { useContext, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DragHandleContext } from '../lib/drag-handle';

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
            {handle && <DragHandle label={`Déplacer la carte ${title}`} size="sm" {...handle} />}
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
        {loading ? <ListSkeleton items={3} dense /> : children}
      </Stack>
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
