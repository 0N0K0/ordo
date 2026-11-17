import { Avatar, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Size of the avatar of a person in the options of a select.
 */
const OPTION_AVATAR = 20;

/**
 * Option of a person in a select: avatar, name, and a hint (handle…).
 * @param {{ name: string, label: string, avatarUrl?: string | null, hint?: string }} props Name (initials), text, avatar, hint.
 * @returns {JSX.Element} Option.
 */
export function PersonOption({ name, label, avatarUrl, hint }: { name: string; label: string; avatarUrl?: string | null; hint?: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar src={avatarUrl} name={name} color="initials" size={OPTION_AVATAR} />
      <Text size="sm">{label}</Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Group>
  );
}

/**
 * Avatar of a person in a list of people (a cell, a field), next to the name.
 * @param {{ name: string, avatarUrl?: string | null }} props Name (initials), avatar.
 * @returns {JSX.Element} Avatar.
 */
export function PersonAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return <Avatar src={avatarUrl} name={name} color="initials" size={16} style={{ flexShrink: 0 }} />;
}

interface PersonRowProps {
  /** Name, for the initials of the avatar. */
  name: string;
  /** Name shown (« … (moi) »). Optional. Default = the name. */
  label?: ReactNode;
  avatarUrl?: string | null;
  /** Badges after the name (« Moi », « Membre »…). Optional. */
  badges?: ReactNode;
  /** Lines under the name (handle, use…). Optional. */
  details?: ReactNode;
}

/**
 * Row of a person in a list (contributors of a project, of the workspace): avatar, name, badges, details under it.
 * @param {PersonRowProps} props Component props.
 * @returns {JSX.Element} Row content.
 */
export function PersonRow({ name, label = name, avatarUrl, badges, details }: PersonRowProps) {
  return (
    <>
      <Avatar src={avatarUrl} name={name} color="initials" />
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={500} truncate>
            {label}
          </Text>
          {badges}
        </Group>
        {details}
      </Stack>
    </>
  );
}
