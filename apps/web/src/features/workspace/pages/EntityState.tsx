import { BlockSkeleton, TextSkeleton } from '../../../components/feedback/Skeletons';
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
      <Group gap="md" wrap="nowrap">
        {/* As the avatar of the header (its xl size). */}
        <Skeleton height={84} width={84} radius="md" style={{ flex: 'none' }} />
        <div style={{ flex: 1 }}>
          <TextSkeleton title lines={1} />
        </div>
      </Group>
      <BlockSkeleton height={5} />
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
