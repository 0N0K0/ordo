import { CaretRightIcon } from '@phosphor-icons/react';
import classes from './FoldChevron.module.css';

/**
 * Chevron of a row, a group or a section that folds: pointing right when folded, down when unfolded (turning).
 * @param {{ expanded: boolean }} props Component props: unfolded.
 * @returns {JSX.Element} Chevron.
 */
export function FoldChevron({ expanded }: { expanded: boolean }) {
  return <CaretRightIcon className={classes.chevron} data-expanded={expanded || undefined} aria-hidden />;
}
