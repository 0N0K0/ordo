import { Avatar, type AvatarProps } from '@mantine/core';

interface EntityAvatarProps extends Omit<AvatarProps, 'src' | 'name' | 'color'> {
  name: string;
  iconUrl: string | null;
  color?: string | null;
  /** Whole image shown, fitted (client logos), rather than cropped to fill. */
  contain?: boolean;
}

/**
 * Client or project icon; without icon, initials colored by the entity color or derived from the name.
 * @param {EntityAvatarProps} props Component props.
 * @param {string} props.name Entity name.
 * @param {string | null} props.iconUrl Uploaded icon URL.
 * @param {string | null} [props.color] Entity color. Optional.
 * @param {boolean} [props.contain] Whole image shown, not cropped. Optional.
 * @returns {JSX.Element} Avatar.
 */
export function EntityAvatar({ name, iconUrl, color, contain, ...props }: EntityAvatarProps) {
  return (
    <Avatar
      src={iconUrl}
      name={name}
      color={color ?? 'initials'}
      alt=""
      imageProps={{ draggable: false }}
      styles={contain ? { image: { objectFit: 'contain' } } : undefined}
      {...props}
    />
  );
}
