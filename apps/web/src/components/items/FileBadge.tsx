import { Badge, type MantineSize } from '@mantine/core';
import { PaperclipIcon } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';
import { RemoveButton } from '../actions/RemoveButton';
import * as fmt from '../../lib/format';
import { ellipsis } from '../../lib/text';

interface FileBadgeProps {
  /** File name, cut beyond `max` characters (whole in its tooltip). */
  name: string;
  /** Size in bytes, shown after the name (the files of a mail). Optional. */
  size?: number | null;
  /** Most characters of the name shown. Optional. Default = 24. */
  max?: number;
  /** Opens it as a link. Optional. */
  href?: string;
  /** Target of the link (`_blank`: a new tab). Optional. */
  target?: string;
  /** Opens it (its viewer, a download). Optional: without it nor `href`, the badge is not clickable. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Removes it, from the gray cross on its right. Optional. */
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Tooltip of the cross. Optional. Default = « Retirer ». */
  removeLabel?: string;
  /** Badge size. Optional. Default = sm. */
  badgeSize?: MantineSize;
}

/**
 * Badge of a file, the same everywhere (attachments, receipts, files of a mail): a paperclip, its name (cut), its size
 * when given, opened in a click, removed from its cross.
 * @param {FileBadgeProps} props Component props.
 * @returns {JSX.Element} Badge.
 */
export function FileBadge({ name, size, max = 24, href, target, onClick, onRemove, removeLabel = 'Retirer', badgeSize = 'sm' }: FileBadgeProps) {
  const shown = ellipsis(name, max);
  const clickable = Boolean(href || onClick);
  const link = href ? { component: 'a' as const, href, target, rel: target ? 'noopener noreferrer' : undefined } : {};
  return (
    <Badge
      {...link}
      size={badgeSize}
      variant="light"
      color="gray"
      tt="none"
      title={shown === name ? undefined : name}
      leftSection={<PaperclipIcon aria-hidden />}
      rightSection={onRemove && <RemoveButton variant="field" size="xs" label={removeLabel} aria-label={`Retirer ${name}`} onClick={onRemove} />}
      style={clickable ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
      {shown}
      {size != null && ` · ${fmt.fileSize(size)}`}
    </Badge>
  );
}
