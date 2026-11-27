import { DragHandle } from '../dnd/DragHandle';
import { useSortableItem } from '../dnd/use-sortable-item';
import type { ReactNode } from 'react';
import { RemoveButton } from '../actions/RemoveButton';
import { FoldCard } from './FoldCard';

interface CaseCardProps {
  /** Number of the case, from 1. */
  index: number;
  /** The case told in words. */
  summary: string;
  /** It can be folded (several cases). */
  collapsible: boolean;
  opened: boolean;
  onToggle: () => void;
  /** Removes the case; none: it cannot be. Optional. */
  onRemove?: () => void;
  /** Its key among the cases, dragged by its handle to reorder them (within a sortable list). */
  sortId: string;
  /** It can be moved (several cases). */
  sortable: boolean;
  children: ReactNode;
}

/**
 * One case of a repetition (routine, schedule…): « Cas 2 · its summary », folded or unfolded when there are several,
 * moved by its handle (pointer or keyboard: the first one that fits a day wins), removable.
 * @param {CaseCardProps} props Component props.
 * @returns {JSX.Element} Case.
 */
export function CaseCard({ index, summary, collapsible, opened, onToggle, onRemove, sortId, sortable, children }: CaseCardProps) {
  const { ref, style, dragging, handle } = useSortableItem(sortId, !sortable);
  return (
    <FoldCard
      title={`Cas ${index} · ${summary}`}
      collapsible={collapsible}
      opened={opened}
      onToggle={onToggle}
      cardRef={ref}
      style={style}
      raised={dragging}
      before={sortable && <DragHandle item={`Cas ${index}`} {...handle} size="sm" />}
      actions={onRemove && <RemoveButton label="Retirer" size="sm" aria-label={`Retirer le cas ${index}`} onClick={onRemove} />}
    >
      {children}
    </FoldCard>
  );
}
