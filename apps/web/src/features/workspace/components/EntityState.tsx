import { BlockSkeleton, TextSkeleton } from '../../../components/feedback/Skeletons';
import { Group, Skeleton, Stack } from '@mantine/core';

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
