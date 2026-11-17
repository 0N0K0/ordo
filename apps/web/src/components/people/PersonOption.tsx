import { Avatar, Group, Text } from '@mantine/core';

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
