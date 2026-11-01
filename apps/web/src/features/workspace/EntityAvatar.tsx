import { Avatar, type AvatarProps } from '@mantine/core';

interface EntityAvatarProps extends Omit<AvatarProps, 'src' | 'name' | 'color'> {
  name: string;
  iconUrl: string | null;
  color?: string | null;
}

/**
 * Client or project icon; without icon, initials colored by the entity color or derived from the name.
 * @param {EntityAvatarProps} props Component props.
 * @param {string} props.name Entity name.
 * @param {string | null} props.iconUrl Uploaded icon URL.
 * @param {string | null} [props.color] Entity color. Optional.
 * @returns {JSX.Element} Avatar.
 */
export function EntityAvatar({ name, iconUrl, color, ...props }: EntityAvatarProps) {
  return (
    <Avatar
      src={iconUrl}
      name={name}
      color={color ?? 'initials'}
      alt=""
      imageProps={{ draggable: false }}
      {...props}
    />
  );
}
