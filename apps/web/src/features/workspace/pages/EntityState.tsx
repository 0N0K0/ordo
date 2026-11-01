import { Button, Group, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';

/**
 * Skeleton of a detail page while the workspace loads.
 * @returns {JSX.Element} Skeleton.
 */
export function EntitySkeleton() {
  return (
    <Stack gap="lg" aria-label="Chargement">
      <Group gap="md">
        <Skeleton height={84} width={84} radius="md" />
        <Stack gap="xs" style={{ flex: 1 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={14} width="25%" />
        </Stack>
      </Group>
      <Skeleton height={120} radius="md" />
    </Stack>
  );
}

/**
 * Shown when the client or project of the URL does not exist.
 * @param {object} props Component props.
 * @param {string} props.what Kind of entity ("Ce client", "Ce projet").
 * @returns {JSX.Element} Not found state.
 */
export function EntityNotFound({ what }: { what: string }) {
  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon size={64} radius="xl" variant="light" color="gray">
        <MagnifyingGlassIcon size="55%" aria-hidden />
      </ThemeIcon>
      <Title order={1} size="h3">
        Introuvable
      </Title>
      <Text c="dimmed" ta="center">
        {what} n’existe pas ou a été supprimé.
      </Text>
      <Button component={Link} to="/">
        Retour à l’accueil
      </Button>
    </Stack>
  );
}
