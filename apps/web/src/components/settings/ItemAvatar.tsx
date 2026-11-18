import { EntityAvatar } from './EntityAvatar';

/**
 * Avatar of an item of a settings list (or of a project, a client…) in a list, a select or a pill: its image, or its
 * initials on its color.
 * @param {{ name: string, iconUrl?: string | null, color?: string | null, size?: number }} props Name, image, color, and size in px. Optional. Default = 18.
 * @returns {JSX.Element} Avatar.
 */
export function ItemAvatar({ name, iconUrl, color, size = 18 }: { name: string; iconUrl?: string | null; color?: string | null; size?: number }) {
  return <EntityAvatar name={name} iconUrl={iconUrl ?? null} color={color ?? 'gray'} size={size} radius="sm" style={{ flexShrink: 0 }} />;
}
