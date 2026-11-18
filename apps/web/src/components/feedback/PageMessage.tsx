import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface PageMessageProps {
  /** Icon of what happened. */
  icon: ReactNode;
  title: string;
  /** What happened, and why. */
  message: ReactNode;
}

/**
 * Page that cannot be shown (not found, not available in this workspace…): its icon, its title, what happened and a
 * way back home.
 * @param {PageMessageProps} props Component props.
 * @returns {JSX.Element} Message.
 */
export function PageMessage({ icon, title, message }: PageMessageProps) {
  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon size={64} radius="xl" variant="light" color="gray">
        {icon}
      </ThemeIcon>
      <Title order={1} size="h3">
        {title}
      </Title>
      <Text c="dimmed" ta="center">
        {message}
      </Text>
      <Button component={Link} to="/">
        Retour à l’accueil
      </Button>
    </Stack>
  );
}
