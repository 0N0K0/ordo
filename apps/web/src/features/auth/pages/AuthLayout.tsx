import { Paper, Stack, Text, Title } from '@mantine/core';
import { Outlet } from 'react-router';
import classes from './AuthLayout.module.css';

/**
 * Centered card layout for the logged-out pages.
 * @returns {JSX.Element} Layout wrapping the child route.
 */
export function AuthLayout() {
  return (
    <main className={classes.root}>
      <Paper className={classes.card} withBorder shadow="sm" p="xl" radius="md">
        <Stack gap="lg">
          <Text fw={700} size="lg">
            Ordo
          </Text>
          <Outlet />
        </Stack>
      </Paper>
    </main>
  );
}

interface AuthHeaderProps {
  title: string;
  description?: string;
}

/**
 * Title and optional description at the top of an auth card.
 * @param {AuthHeaderProps} props Component props.
 * @param {string} props.title Page title.
 * @param {string} [props.description] Short explanation. Optional.
 * @returns {JSX.Element} Header.
 */
export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <Stack gap={4}>
      <Title order={1} size="h3">
        {title}
      </Title>
      {description && (
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      )}
    </Stack>
  );
}
