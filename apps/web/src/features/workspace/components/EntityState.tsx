import { BlockSkeleton, TextSkeleton } from '../../../components/feedback/Skeletons';
import { Group, Skeleton, Stack } from '@mantine/core';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { PageMessage } from '../../../components/feedback/PageMessage';

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
  return <PageMessage icon={<MagnifyingGlassIcon size="55%" aria-hidden />} title="Introuvable" message={`${what} n’existe pas ou a été supprimé.`} />;
}
