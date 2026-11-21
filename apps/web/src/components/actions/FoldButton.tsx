import type { ActionIconProps } from '@mantine/core';
import { FoldChevron } from './FoldChevron';
import { foldAction, foldLabel } from './fold-label';
import { IconAction } from './IconAction';

interface FoldButtonProps {
  /** Unfolded. */
  expanded: boolean;
  /** Folds or unfolds. */
  onToggle: () => void;
  /** What it folds (« Projet A »): the hidden label says « Réduire « Projet A » ». Optional. */
  item?: string;
  /** What it folds when not a name, with its determiner (« les sous-éléments »): « Développer les sous-éléments ». Optional. Default = from the action and `item`. */
  about?: string;
  /** In a clickable or draggable row: its clicks and pointer presses stay on the button. Optional. */
  inRow?: boolean;
  /** Size. Optional. Default = sm. */
  size?: ActionIconProps['size'];
}

/**
 * Button folding a row, a group or a branch, the same everywhere: « Développer » / « Réduire » in its
 * tooltip, a chevron turning down when unfolded.
 * @param {FoldButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function FoldButton({ expanded, onToggle, item, about, inRow = false, size = 'sm' }: FoldButtonProps) {
  return (
    <IconAction
      label={foldAction(expanded)}
      item={item}
      aria-label={about ? foldLabel(expanded, about) : undefined}
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
