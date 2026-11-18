import type { ActionIconProps } from '@mantine/core';
import { FoldChevron } from './FoldChevron';
import { IconAction } from './IconAction';

interface FoldButtonProps {
  /** Unfolded. */
  expanded: boolean;
  /** Folds or unfolds. */
  onToggle: () => void;
  /** What it folds (« Projet A »): the hidden label says « Réduire « Projet A » ». Optional. */
  item?: string;
  /** Hidden label when the element is not a name (« Développer les sous-éléments »). Optional. Default = from the action and `item`. */
  'aria-label'?: string;
  /** In a clickable or draggable row: its clicks and pointer presses stay on the button. Optional. */
  inRow?: boolean;
  /** Size. Optional. Default = sm. */
  size?: ActionIconProps['size'];
}

/**
 * Button folding a row, a group or a branch, the same everywhere (decision AE): « Développer » / « Réduire » in its
 * tooltip, a chevron turning down when unfolded.
 * @param {FoldButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function FoldButton({ expanded, onToggle, item, 'aria-label': ariaLabel, inRow = false, size = 'sm' }: FoldButtonProps) {
  return (
    <IconAction
      label={expanded ? 'Réduire' : 'Développer'}
      item={item}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      size={size}
      onClick={(event) => {
        if (inRow) event.stopPropagation();
        onToggle();
      }}
      onPointerDown={inRow ? (event) => event.stopPropagation() : undefined}
    >
      <FoldChevron expanded={expanded} />
    </IconAction>
  );
}
