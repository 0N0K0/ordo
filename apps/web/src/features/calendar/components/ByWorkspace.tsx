import { Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { WorkspaceKindIcon } from '../../features/workspaces/components/WorkspaceKindIcon';

/** Workspace an item comes from: its id, its name and, when known, its kind (its icon). */
interface ItemWorkspace {
  id: string;
  name: string;
  kind?: string;
}

/**
 * Items of the other workspaces (calendars, kinds of slots… to subscribe to), grouped by workspace under its name, in
 * the order of the items.
 * @param {{ items: readonly T[], workspaceOf: (item: T) => ItemWorkspace, children: (item: T) => ReactNode }} props Items, their workspace, and the row of an item.
 * @returns {JSX.Element} Groups.
 */
export function ByWorkspace<T>({ items, workspaceOf, children }: { items: readonly T[]; workspaceOf: (item: T) => ItemWorkspace; children: (item: T) => ReactNode }) {
  const groups = new Map<string, { workspace: ItemWorkspace; items: T[] }>();
  for (const item of items) {
    const workspace = workspaceOf(item);
    groups.set(workspace.id, { workspace, items: [...(groups.get(workspace.id)?.items ?? []), item] });
  }
  return (
    <Stack gap="sm">
      {[...groups.values()].map(({ workspace, items: own }) => (
        <Stack key={workspace.id} gap={4}>
          <Group gap="xs">
            {workspace.kind && <WorkspaceKindIcon kind={workspace.kind as 'PRO' | 'PERSO'} />}
            <Text size="sm" fw={600}>
              {workspace.name}
            </Text>
          </Group>
          {own.map(children)}
        </Stack>
      ))}
    </Stack>
  );
}
