import { Paper, Stack, Text, Title } from '@mantine/core';
import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { FormSkeleton } from '../../../components/feedback/Skeletons';
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
          {/* A page loads its code when first opened. */}
          <Suspense fallback={<FormSkeleton fields={2} />}>
            <Outlet />
          </Suspense>
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
