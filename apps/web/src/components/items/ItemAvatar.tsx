import { Avatar, type AvatarProps } from '@mantine/core';

interface ItemAvatarProps {
  name: string;
  iconUrl?: string | null;
  /** Color of the initials, without image. Optional. Default = gray. */
  color?: string | null;
  /** Size, in px or a Mantine size. Optional. Default = 18. */
  size?: AvatarProps['size'];
  /** Corner radius. Optional. Default = sm. */
  radius?: AvatarProps['radius'];
  /** Whole image shown, fitted (client logos), rather than cropped to fill. Optional. */
  contain?: boolean;
}

/**
 * Avatar of an item (a settings list item, a project, a client…) in a list, a select, a pill or a header: its image, or
 * its initials on its color.
 * @param {ItemAvatarProps} props Component props.
 * @param {string} props.name Item name (initials, without image).
 * @param {string | null} [props.iconUrl] Image URL. Optional.
 * @param {string | null} [props.color] Item color (Mantine 'initials' derives it from the name). Optional. Default = gray.
 * @param {AvatarProps['size']} [props.size] Size. Optional. Default = 18.
 * @param {AvatarProps['radius']} [props.radius] Corner radius. Optional. Default = sm.
 * @param {boolean} [props.contain] Whole image shown, not cropped. Optional.
 * @returns {JSX.Element} Avatar.
 */
export function ItemAvatar({ name, iconUrl, color, size = 18, radius = 'sm', contain }: ItemAvatarProps) {
  return (
    <Avatar
      src={iconUrl ?? null}
      name={name}
      color={color ?? 'gray'}
      alt=""
      imageProps={{ draggable: false }}
      styles={contain ? { image: { objectFit: 'contain' } } : undefined}
      size={size}
      radius={radius}
      style={{ flexShrink: 0 }}
    />
  );
}
