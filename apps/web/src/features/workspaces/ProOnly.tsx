import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { HouseLineIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useActiveWorkspace } from './api';

/**
 * Page of a professional workspace only (invoicing, clients): in a personal one, says so with a way back home.
 * @param {{ children: ReactNode }} props Page.
 * @returns {JSX.Element} Page, or the explanation.
 */
export function ProOnly({ children }: { children: ReactNode }) {
  const { workspace, perso } = useActiveWorkspace();
  if (!perso) return children;
  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon size={64} radius="xl" variant="light" color="gray">
        <HouseLineIcon size="55%" aria-hidden />
      </ThemeIcon>
      <Title order={1} size="h3">
        Indisponible dans un espace personnel
      </Title>
      <Text c="dimmed" ta="center">
        L’espace « {workspace?.name} » est personnel : il n’a ni facturation, ni clients, ni société.
      </Text>
      <Button component={Link} to="/">
        Retour à l’accueil
      </Button>
    </Stack>
  );
}
